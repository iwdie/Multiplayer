const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');

const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 });

const port = 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// --- STATE AND CONFIGURATION VARIABLES ---
let players = {};
let groups = {};
let groupRequests = {};
let groupIdCounter = 1;

const MINGLE_DURATION_SECONDS = 120; // 2 minutes for mingling
const OBJECTIVE_DURATION_SECONDS = 60; // 1 minute for the objective
const REQUIRED_PLAYER_COUNT = 5;

let gamePhase = 'WAITING'; // WAITING, MINGLE, OBJECTIVE, GAMEOVER
let gameTimer = null;
const safeRoom = { x: 200, y: 150, width: 400, height: 300 }; // The safe room definition

// --- GAME LOGIC FUNCTIONS ---

function startGame() {
  console.log('Minimum players reached. Starting Mingle Phase.');
  gamePhase = 'MINGLE';
  // Notify all clients that the game is starting
  io.emit('gamePhaseUpdate', {
    phase: gamePhase,
    duration: MINGLE_DURATION_SECONDS
  });

  // Set a timer for the Mingle Phase
  clearTimeout(gameTimer);
  gameTimer = setTimeout(startObjectivePhase, MINGLE_DURATION_SECONDS * 1000);
}

function startObjectivePhase() {
  console.log('Mingle Phase over. Starting Objective Phase.');
  gamePhase = 'OBJECTIVE';

  // Find and eliminate the "loner"
  let lonerId = null;
  for (const id in players) {
    if (!players[id].groupId) {
      lonerId = id;
      break;
    }
  }

  if (lonerId) {
    console.log(`Eliminating loner: ${players[lonerId]?.username || 'a player'}`);
    delete players[lonerId];
    io.emit('playerEliminated', lonerId); // Notify clients to remove the player
  } else if (Object.keys(players).length > 4) {
      // Fallback in case groups didn't form perfectly, eliminate one player
      const playerIds = Object.keys(players);
      const playerToEliminateId = playerIds[Math.floor(Math.random() * playerIds.length)];
      console.log(`No single loner found, eliminating random player: ${players[playerToEliminateId]?.username}`);
      delete players[playerToEliminateId];
      io.emit('playerEliminated', playerToEliminateId);
  }


  // Notify remaining clients about the new phase
  io.emit('gamePhaseUpdate', {
    phase: gamePhase,
    duration: OBJECTIVE_DURATION_SECONDS
  });

  // Set a timer for the Objective Phase
  clearTimeout(gameTimer);
  gameTimer = setTimeout(endGame, OBJECTIVE_DURATION_SECONDS * 1000);
}

function endGame() {
  console.log('Objective Phase over. Determining winner.');
  gamePhase = 'GAMEOVER';

  const playersInRoom = [];
  for (const id in players) {
    const player = players[id];
    // Check if player is inside the safe room boundaries
    if (
      player.x > safeRoom.x && player.x < safeRoom.x + safeRoom.width &&
      player.y > safeRoom.y && player.y < safeRoom.y + safeRoom.height
    ) {
      playersInRoom.push(player);
    }
  }

  let winningGroup = false;
  // Check if exactly 4 players are in the room
  if (playersInRoom.length === 4) {
    const firstGroupId = playersInRoom[0].groupId;
    // Check if the groupId is valid and if all players share it
    if (firstGroupId && playersInRoom.every(p => p.groupId === firstGroupId)) {
      winningGroup = true;
    }
  }

  if (winningGroup) {
    console.log('A group has won!');
    io.emit('gameOver', { message: 'Your group survived!' });
  } else {
    console.log('No group survived.');
    // Eliminate all remaining players if they failed
    for (const id in players){
        io.emit('playerEliminated', id);
    }
    io.emit('gameOver', { message: 'Your group failed to assemble in time!' });
  }
}


io.on('connection', (socket) => {
  console.log('a user connected');
  
  socket.on('initGame', (username) => {
    if (gamePhase !== 'WAITING') {
        socket.emit('error', 'A game is already in progress.');
        return;
    }
    players[socket.id] = {
      x: 500 * Math.random(),
      y: 500 * Math.random(),
      username,
      groupId: null,
      busy: false,
      isRequestSent: false,
      isRequestReceived: false,
      groupRequestSentTo: null
    };

    // Notify all clients of the new player
    io.emit('updatePlayers', players);

    // Check if we have enough players to start the game
    if (Object.keys(players).length === REQUIRED_PLAYER_COUNT && gamePhase === 'WAITING') {
      startGame();
    }
  });

  socket.on('disconnect', () => {
    console.log('a user disconnected');
    if (players[socket.id]) {
      if (players[socket.id].groupId && groups[players[socket.id].groupId]) {
        groups[players[socket.id].groupId] = groups[players[socket.id].groupId].filter((member) => member.id !== socket.id);
        if (groups[players[socket.id].groupId].length < 2) {
            delete groups[players[socket.id].groupId];
        }
        io.emit('groupUpdate', groups);
      }
      delete players[socket.id];
      io.emit('updatePlayers', players);
    }
    // Note: Add logic here to handle disconnects during an active game, e.g., reset or end game.
  });
  
  socket.on('keydown', (keycode) => {
    if (!players[socket.id]) return;

    switch (keycode) {
      case 'KeyW': players[socket.id].y -= 5; break;
      case 'KeyA': players[socket.id].x -= 5; break;
      case 'KeyS': players[socket.id].y += 5; break;
      case 'KeyD': players[socket.id].x += 5; break;
    }
  });

  socket.on('requestMingle', (data) => {
    if (gamePhase !== 'MINGLE') return; // Mingle requests only allowed during Mingle phase

    const { targetId, type } = data;
    const requesterId = socket.id;
    const requester = players[requesterId];
    const target = players[targetId];

    if (!requester || !target) return;
    if (requester.busy || target.busy || requester.isRequestSent || target.isRequestReceived) return;

    const requestId = `${requesterId}-${targetId}`;
    requester.busy = true;
    target.busy = true;
    requester.isRequestSent = true;
    requester.groupRequestSentTo = targetId;
    target.isRequestReceived = true;

    groupRequests[requestId] = {
      requesterId,
      targetId,
      type,
      timeout: setTimeout(() => {
        delete groupRequests[requestId];
        if (players[requesterId]) {
          players[requesterId].busy = false;
          players[requesterId].isRequestSent = false;
          players[requesterId].groupRequestSentTo = null;
        }
        if (players[targetId]) {
          players[targetId].busy = false;
          players[targetId].isRequestReceived = false;
        }
        io.to(requesterId).emit('mingleTimeout', players[targetId]?.username);
        io.to(targetId).emit('mingleTimeout', players[requesterId]?.username);
        io.emit('updatePlayers', players);
      }, 10000),
    };

    io.to(targetId).emit('mingleRequested', {
      from: requesterId,
      username: requester.username,
      requestType: type,
      requesterGroupId: requester.groupId
    });

    io.to(requesterId).emit('mingleRequestSent', { to: targetId, username: target.username });
    io.emit('updatePlayers', players);
  });

  socket.on('respondMingle', (data) => {
    const { requestId, accepted } = data;
    const request = groupRequests[requestId];

    if (!request) return;

    const { requesterId, targetId } = request;
    const requester = players[requesterId];
    const target = players[targetId];

    clearTimeout(request.timeout);
    delete groupRequests[requestId];

    if (requester) {
      requester.busy = false;
      requester.isRequestSent = false;
      requester.groupRequestSentTo = null;
    }
    if (target) {
      target.busy = false;
      target.isRequestReceived = false;
    }

    if (accepted && requester && target) {
      let newGroupId;
      if (!requester.groupId && !target.groupId) {
        newGroupId = `group-${groupIdCounter++}`;
        groups[newGroupId] = [];
        groups[newGroupId].push({ id: requesterId, username: requester.username });
        groups[newGroupId].push({ id: targetId, username: target.username });
        requester.groupId = newGroupId;
        target.groupId = newGroupId;
      } else if (!requester.groupId && target.groupId) {
        newGroupId = target.groupId;
        groups[newGroupId].push({ id: requesterId, username: requester.username });
        requester.groupId = newGroupId;
      } else if (requester.groupId && !target.groupId) {
        newGroupId = requester.groupId;
        groups[newGroupId].push({ id: targetId, username: target.username });
        target.groupId = newGroupId;
      } else if (requester.groupId && target.groupId && requester.groupId !== target.groupId) {
        const oldRequesterGroup = groups[requester.groupId];
        newGroupId = target.groupId;
        groups[newGroupId].push(...oldRequesterGroup);
        oldRequesterGroup.forEach(member => {
          if(players[member.id]) players[member.id].groupId = newGroupId;
        });
        delete groups[requester.groupId];
        requester.groupId = newGroupId;
      } else {
        io.to(socket.id).emit('mingleError', 'Both players are already in the same group.');
        io.emit('updatePlayers', players);
        return;
      }
      io.emit('mingleSuccess', { groupId: newGroupId, groupMembers: groups[newGroupId] });
      io.emit('groupUpdate', groups);
    } else {
      io.to(requesterId).emit('mingleDeclined', target?.username);
      io.to(targetId).emit('mingleDeclined', requester?.username);
    }
    io.emit('updatePlayers', players);
  });
});


setInterval(() => {
  if (Object.keys(players).length > 0) {
    io.emit('updatePlayers', players);
  }
}, 15);

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
