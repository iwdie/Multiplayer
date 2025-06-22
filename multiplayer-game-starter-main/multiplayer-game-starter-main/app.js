const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');

const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 });

const port = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// --- STATE AND CONFIGURATION VARIABLES ---
let players = {};
let groups = {};
let groupRequests = {};
let groupIdCounter = 1;
const playerInputs = {}; // Store player input state

const MINGLE_DURATION_SECONDS = 120;
const OBJECTIVE_DURATION_SECONDS = 60;
const REQUIRED_PLAYER_COUNT = 5;

let gamePhase = 'WAITING';
let gameTimer = null;
const safeRoom = { x: 200, y: 150, width: 400, height: 300 };
const PLAYER_SPEED = 5;
const TICK_RATE = 60;

// --- SERVER GAME LOOP ---
function gameLoop() {
  for (const id in players) {
    const inputs = playerInputs[id];
    if (inputs) {
      if (inputs.w.pressed) players[id].y -= PLAYER_SPEED;
      if (inputs.a.pressed) players[id].x -= PLAYER_SPEED;
      if (inputs.s.pressed) players[id].y += PLAYER_SPEED;
      if (inputs.d.pressed) players[id].x += PLAYER_SPEED;
    }
  }
}
setInterval(gameLoop, 1000 / TICK_RATE);
// ---

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  playerInputs[socket.id] = { w: {pressed:false}, a: {pressed:false}, s: {pressed:false}, d: {pressed:false} };

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
    io.emit('updatePlayers', players);
    if (Object.keys(players).length === REQUIRED_PLAYER_COUNT && gamePhase === 'WAITING') {
      startGame();
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    delete players[socket.id];
    delete playerInputs[socket.id];
    io.emit('updatePlayers', players);
  });
  
  socket.on('input', (keys) => {
    if (playerInputs[socket.id]) {
      playerInputs[socket.id] = keys;
    }
  });

  socket.on('requestMingle', (data) => {
    if (gamePhase !== 'MINGLE') return;
    const { targetId, type } = data;
    const requesterId = socket.id;
    const requester = players[requesterId];
    const target = players[targetId];
    if (!requester || !target || requester.busy || target.busy) return;
    const requestId = `${requesterId}-${targetId}`;
    requester.busy = true; target.busy = true;
    groupRequests[requestId] = {
      requesterId, targetId, type,
      timeout: setTimeout(() => {
        delete groupRequests[requestId];
        if(players[requesterId]) players[requesterId].busy = false;
        if(players[targetId]) players[targetId].busy = false;
        io.to(requesterId).emit('mingleTimeout', players[targetId]?.username);
        io.to(targetId).emit('mingleTimeout', players[requesterId]?.username);
        io.emit('updatePlayers', players);
      }, 10000),
    };
    io.to(targetId).emit('mingleRequested', { from: requesterId, username: requester.username, requestType: type });
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
    if(requester) requester.busy = false;
    if(target) target.busy = false;
    if (accepted && requester && target) {
      let newGroupId;
      if (!requester.groupId && !target.groupId) {
        newGroupId = `group-${groupIdCounter++}`;
        groups[newGroupId] = [{ id: requesterId, username: requester.username }, { id: targetId, username: target.username }];
        requester.groupId = newGroupId; target.groupId = newGroupId;
      } else if (!requester.groupId && target.groupId) {
        newGroupId = target.groupId;
        groups[newGroupId].push({ id: requesterId, username: requester.username });
        requester.groupId = newGroupId;
      } else if (requester.groupId && !target.groupId) {
        newGroupId = requester.groupId;
        groups[newGroupId].push({ id: targetId, username: target.username });
        target.groupId = newGroupId;
      } else if (requester.groupId && target.groupId && requester.groupId !== target.groupId) {
        const oldGroup = groups[requester.groupId];
        newGroupId = target.groupId;
        groups[newGroupId].push(...oldGroup);
        oldGroup.forEach(m => { if(players[m.id]) players[m.id].groupId = newGroupId; });
        delete groups[requester.groupId];
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
}, 45); // Send updates slightly less often than game loop

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

function startGame() {
  console.log('Starting Mingle Phase.');
  gamePhase = 'MINGLE';
  io.emit('gamePhaseUpdate', { phase: gamePhase, duration: MINGLE_DURATION_SECONDS });
  clearTimeout(gameTimer);
  gameTimer = setTimeout(startObjectivePhase, MINGLE_DURATION_SECONDS * 1000);
}
function startObjectivePhase() {
  console.log('Starting Objective Phase.');
  gamePhase = 'OBJECTIVE';
  let lonerId = null;
  for (const id in players) { if (!players[id].groupId) { lonerId = id; break; } }
  if (lonerId) {
    console.log(`Eliminating loner: ${players[lonerId]?.username}`);
    delete players[lonerId];
    io.emit('playerEliminated', lonerId);
  }
  io.emit('gamePhaseUpdate', { phase: gamePhase, duration: OBJECTIVE_DURATION_SECONDS });
  clearTimeout(gameTimer);
  gameTimer = setTimeout(endGame, OBJECTIVE_DURATION_SECONDS * 1000);
}
function endGame() {
  console.log('Game Over.');
  gamePhase = 'GAMEOVER';
  const playersInRoom = [];
  for (const id in players) {
    const p = players[id];
    if (p.x > safeRoom.x && p.x < safeRoom.x + safeRoom.width && p.y > safeRoom.y && p.y < safeRoom.y + safeRoom.height) {
      playersInRoom.push(p);
    }
  }
  let winningGroup = false;
  if (playersInRoom.length === 4) {
    const firstGroupId = playersInRoom[0].groupId;
    if (firstGroupId && playersInRoom.every(p => p.groupId === firstGroupId)) {
      winningGroup = true;
    }
  }
  if (winningGroup) {
    io.emit('gameOver', { message: 'Your group survived!' });
  } else {
    io.emit('gameOver', { message: 'Your group failed to assemble in time!' });
  }
}
