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
const minglingPairs = {};

io.on('connection', (socket) => {
  console.log('a user connected'); 
 

  io.emit('updatePlayers', players);
  
  socket.on('initGame', (username) => {
    players[socket.id] = { x: 500*Math.random(), y: 500*Math.random(),username}
  });

  socket.on('disconnect', (reason) => {
    delete players[socket.id];
  });

  socket.on('keydown', (keycode) => {
    switch(keycode){
      case 'KeyW':
        players[socket.id].y -= 10;
        break;
      case 'KeyA':
        players[socket.id].x -= 10;
        break;
      case 'KeyS':
        players[socket.id].y += 10;
        break;
      case 'KeyD':
        players[socket.id].x += 10;
    }
  });
   // Handle mingle request
   socket.on('requestMingle', (targetId) => {
    if (players[targetId] && players[socket.id]) {
      minglingPairs[socket.id] = targetId;
      minglingPairs[targetId] = socket.id;

      // Notify both players about the mingle request
      io.to(socket.id).emit('mingleRequested', players[targetId]);
      io.to(targetId).emit('mingleRequested', players[socket.id]);
    }
  });

  // Handle mingle response
  socket.on('respondMingle', (data) => {
    const { targetId, accepted } = data;

    if (minglingPairs[socket.id] === targetId) {
      if (accepted) {
        // Both players agreed to mingle
        io.to(socket.id).emit('mingleSuccess', players[targetId]);
        io.to(targetId).emit('mingleSuccess', players[socket.id]);
      } else {
        // Mingle request declined
        io.to(socket.id).emit('mingleDeclined', players[targetId]);
        io.to(targetId).emit('mingleDeclined', players[socket.id]);
      }

      // Clear mingle pair
      delete minglingPairs[socket.id];
      delete minglingPairs[targetId];
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
