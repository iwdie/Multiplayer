const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')
const socket = io()

canvas.width = innerWidth
canvas.height = innerHeight

// --- CLIENT-SIDE STATE ---
let gamePhase = 'WAITING';
let timerValue = 0;
let clientTimerInterval = null;
const players = {}; 
const serverPlayers = {}; // NEW: Store the authoritative state from the server

// --- GAME OBJECTS ---
const horse = new horses(x, y, 180, 180, './images/horseswithbg-removebg-preview.png', 'rgba(248, 232, 84, 0.89)');
const safeRoom = new Room(200, 150, 400, 300, 'rgba(0, 255, 0, 0.15)');

// --- SOCKET EVENT LISTENERS ---

// UPDATED: Now stores server state separately
socket.on('updatePlayers', (BackendPlayers) => {
  for (const id in BackendPlayers) {
    const backendPlayer = BackendPlayers[id];
    if (!players[id]) {
      // Create a local player object if it's new
      players[id] = new Player(backendPlayer.x, backendPlayer.y, 50, 50, './images/image (2).png');
      players[id].username = backendPlayer.username;
    }
    // Store the server's authoritative state
    serverPlayers[id] = backendPlayer;
  }
  // Clean up disconnected players
  for (const id in players) {
    if (!BackendPlayers[id]) {
      delete players[id];
      delete serverPlayers[id];
    }
  }
});

// Other event listeners (gamePhaseUpdate, gameOver, etc.) remain the same
// ...

// --- MAIN ANIMATE LOOP ---
let animationId;
function animate() {
  animationId = requestAnimationFrame(animate);
  c.fillStyle = 'rgba(243, 206, 167, 0.76)';
  c.fillRect(0, 0, canvas.width, canvas.height);
  
  safeRoom.draw();
  horse.update();
  horse.draw();

  if (gamePhase === 'MINGLE') {
    checkMingle();
  }

  // NEW: Smoothing logic
  for (const id in players) {
    const player = players[id];
    const serverPlayer = serverPlayers[id];

    if (serverPlayer) {
      // Interpolate the local player's position towards the server's position
      // This creates a smooth correction instead of a jerky snap
      player.x += (serverPlayer.x - player.x) * 0.1;
      player.y += (serverPlayer.y - player.y) * 0.1;
    }
    
    player.draw();
  }

  drawTimer();
}
// ---

// --- KEYBOARD CONTROLS (Client no longer moves directly) ---
const keys = { w: { pressed: false }, a: { pressed: false }, s: { pressed: false }, d: { pressed: false } };

// This interval now ONLY sends input to the server
setInterval(() => {
  if (players[socket.id]) {
    socket.emit('input', keys);
  }
}, 15);

window.addEventListener('keydown', (event) => {
  if (!players[socket.id]) return;
  const key = event.code.replace('Key', '').toLowerCase();
  if (keys.hasOwnProperty(key)) keys[key].pressed = true;
});

window.addEventListener('keyup', (event) => {
  if (!players[socket.id]) return;
  const key = event.code.replace('Key', '').toLowerCase();
  if (keys.hasOwnProperty(key)) keys[key].pressed = false;
});

// --- INITIALIZATION ---
document.querySelector('#usernameForm').addEventListener('submit', (event) => {
  event.preventDefault();
  socket.emit('initGame', document.querySelector('#usernameInput').value);
  document.querySelector('#usernameForm').style.display = 'none';
});

animate();

// ... (Your other functions like drawTimer, openMingleDialog, etc., remain here) ...
