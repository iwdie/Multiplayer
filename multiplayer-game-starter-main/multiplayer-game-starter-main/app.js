const express = require('express')
const app = express()
//socket.io setup
const http =  require('http')
const server = http.createServer(app)
const { Server } = require('socket.io')

const io = new Server(server, {pingInterval: 2000, pingTimeout: 5000})

const port = 3000

app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

const players = {};
let playerCount = 0;
const groups = {};
const groupRequests = {}; // Tracks ongoing mingle requests { requestId: { groupId, targetId, timeout } }

let groupIdCounter = 1; // To generate unique group IDs


io.on('connection', (socket) => {
  console.log('a user connected'); 

  
  socket.on('emitTimer', () => {
    endTimer();
  });
  


  io.emit('updatePlayers', players);
  
  socket.on('initGame', (username) => {
    players[socket.id] = { x: 500*Math.random(), y: 500*Math.random(),username,busy: false }
    playerCount++;
    if (playerCount == 5) {
       
        io.emit('startTimer'); // Notify all clients to start the timer
      
      }
  });

  socket.on('disconnect', () => {
    const player = players[socket.id];

    if (player) {
      if (player.groupId && groups[player.groupId]) {
        // Remove player from their group
        groups[player.groupId] = groups[player.groupId].filter((id) => id !== socket.id);

        // Delete the group if it's empty
        if (groups[player.groupId].length === 0) {
          delete groups[player.groupId];
        } else {
          io.emit('groupUpdate', groups); // Notify others about the group update
        }
      }
      delete players[socket.id];
    }
    console.log('A user disconnected');
  });

  
  socket.on('keydown', (keycode) => {
    switch(keycode){
      case 'KeyW':
        players[socket.id].y -= 5;
        break;
      case 'KeyA':
        players[socket.id].x -= 5;
        break;
      case 'KeyS':
        players[socket.id].y += 5;
        break;
      case 'KeyD':
        players[socket.id].x += 5;
    }
  });
  socket.on('requestMingle', (targetId) => {
    const requester = players[socket.id];
    const target = players[targetId];

    if (!requester || !target || requester.busy || target.busy) {
      io.to(socket.id).emit('error', 'Player is busy or invalid.');
      return;
    }

    const requestId = `${socket.id}-${targetId}`;
    requester.busy = true;
    target.busy = true;

    // Store the request with a timeout
    groupRequests[requestId] = {
      groupId: null,
      targetId,
      timeout: setTimeout(() => {
        // Timeout logic
        delete groupRequests[requestId];
        requester.busy = false;
        target.busy = false;
        io.to(socket.id).emit('mingleTimeout');
        io.to(targetId).emit('mingleTimeout');
      }, 10000), // 10 seconds timeout
    };

    io.to(targetId).emit('mingleRequested', { from: socket.id, username: requester.username });
  });

  function endTimer() {
    console.log('Timer ended!');
  
    const unmingledPlayers = Object.keys(players).filter(
      (playerId) => !players[playerId].mingled
    );
  
    // Emit 'gameOver' event to all unmingled players
    unmingledPlayers.forEach((playerId) => {
      io.to(playerId).emit('gameOver', { message: 'Game Over! You did not mingle in time.' });
    });
  
    console.log(`Game Over sent to: ${unmingledPlayers.join(', ')}`);
  }
  // Response to mingle request
  socket.on('respondMingle', (data) => {
    const { requestId, accepted } = data;
    const request = groupRequests[requestId];
    players[requestId].mingled = true;
    players[targetId].mingled = true;

    if (!request) return;

    const { targetId } = request;
    const requester = players[socket.id];
    const target = players[targetId];

    clearTimeout(request.timeout); // Clear timeout for the request
    delete groupRequests[requestId];

    if (accepted && requester && target) {
      // Create or join a group
      if (requester.groupId || target.groupId) {
        const groupId = requester.groupId || target.groupId;
        groups[groupId] = [...new Set([...(groups[groupId] || []), socket.id, targetId])];
        requester.groupId = groupId;
        target.groupId = groupId;
      } else {
        const newGroupId = `group-${groupIdCounter++}`;
        groups[newGroupId] = [socket.id, targetId];
        requester.groupId = newGroupId;
        target.groupId = newGroupId;
      }

      // Notify players about the successful mingle
      io.to(socket.id).emit('mingleSuccess', groups[requester.groupId]);
      io.to(targetId).emit('mingleSuccess', groups[requester.groupId]);

      io.emit('groupUpdate', groups); // Update all players about group changes
    } else {
      // Notify about decline
      if (requester) requester.busy = false;
      if (target) target.busy = false;

      io.to(socket.id).emit('mingleDeclined', target ? target.username : null);
      io.to(targetId).emit('mingleDeclined', requester ? requester.username : null);
    }
  });
  socket.on('playerMingled', (playerId) => {
    if (players[playerId]) {
      players[playerId].mingled = true; // Mark the player as mingled
    }
  });

  console.log(players);
});


 




setInterval(() => {
  io.emit('updatePlayers', players);
}, 15);

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
