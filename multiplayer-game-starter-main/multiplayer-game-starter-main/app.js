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
const playerInputs = {}; // NEW: Store player input state

const MINGLE_DURATION_SECONDS = 120;
const OBJECTIVE_DURATION_SECONDS = 60;
const REQUIRED_PLAYER_COUNT = 5;

let gamePhase = 'WAITING';
let gameTimer = null;
const safeRoom = { x: 200, y: 150, width: 400, height: 300 };

// --- GAME LOGIC FUNCTIONS (Unchanged from previous version) ---
function startGame() { /* ... same as before ... */ }
function startObjectivePhase() { /* ... same as before ... */ }
function endGame() { /* ... same as before ... */ }

// --- SERVER GAME LOOP ---
const TICK_RATE = 60;
const PLAYER_SPEED = 5;

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
  console.log('a user connected');
  
  // Initialize a storage for this player's inputs
  playerInputs[socket.id] = {
    w: { pressed: false }, a: { pressed: false },
    s: { pressed: false }, d: { pressed: false }
  };

  socket.on('initGame', (username) => {
    // ... same initGame logic ...
  });

  socket.on('disconnect', () => {
    console.log('a user disconnected');
    delete players[socket.id];
    delete playerInputs[socket.id]; // Clean up inputs
    io.emit('updatePlayers', players);
  });
  
  // REMOVED old 'keydown' listener
  
  // NEW listener for the entire keyboard state
  socket.on('input', (keys) => {
    if (playerInputs[socket.id]) {
      playerInputs[socket.id] = keys;
    }
  });

  // Mingle logic remains the same
  // ... (Your existing 'requestMingle' and 'respondMingle' socket listeners go here) ...
});

// Update clients at a slightly different rate than the game loop
setInterval(() => {
  if (Object.keys(players).length > 0) {
    io.emit('updatePlayers', players);
  }
}, 15);

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});


// Helper functions (you can copy these into the server file)
function startGame() {
  console.log('Minimum players reached. Starting Mingle Phase.');
  gamePhase = 'MINGLE';
  io.emit('gamePhaseUpdate', { phase: gamePhase, duration: MINGLE_DURATION_SECONDS });
  clearTimeout(gameTimer);
  gameTimer = setTimeout(startObjectivePhase, MINGLE_DURATION_SECONDS * 1000);
}

function startObjectivePhase() {
  console.log('Mingle Phase over. Starting Objective Phase.');
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
  console.log('Objective Phase over. Determining winner.');
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
