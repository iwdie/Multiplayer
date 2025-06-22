const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')
const socket = io()

canvas.width = innerWidth
canvas.height = innerHeight

// --- CLIENT-SIDE STATE ---
let players = {}; 
let gamePhase = 'IDLE'; // IDLE, WAITING, MINGLE, OBJECTIVE, GAMEOVER
let lobbyId = null;
let timerValue = 0;
let clientTimerInterval = null;

// --- DOM ELEMENTS ---
const usernameForm = document.querySelector('#usernameForm');
const usernameInput = document.querySelector('#usernameInput');
const gameOverScreen = document.createElement('div');
gameOverScreen.style.cssText = "display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px; background-color: rgba(0, 0, 0, 0.9); color: white; font-size: 30px; border-radius: 10px; text-align: center; box-shadow: 0 0 15px red; z-index: 300;";
document.body.appendChild(gameOverScreen);

// --- GAME OBJECTS ---
const x = canvas.width / 2, y = canvas.height / 2;
const horse = new horses(x, y, 180, 180, './images/horseswithbg-removebg-preview.png', 'rgba(248, 232, 84, 0.89)');
const safeRoom = new Room(200, 150, 400, 300, 'rgba(0, 255, 0, 0.15)');

// --- SOCKET EVENT LISTENERS ---
socket.on('joinedLobby', (data) => {
    console.log(`Joined lobby: ${data.lobbyId}`);
    lobbyId = data.lobbyId;
    gamePhase = 'WAITING';
    usernameForm.style.display = 'none';
});

socket.on('gamePhaseUpdate', (data) => {
  console.log(`New game phase: ${data.phase}, Duration: ${data.duration}`);
  gamePhase = data.phase;
  timerValue = data.duration;
  if (clientTimerInterval) clearInterval(clientTimerInterval);
  if (gamePhase === 'MINGLE' || gamePhase === 'OBJECTIVE') {
    clientTimerInterval = setInterval(() => { if (timerValue > 0) timerValue--; }, 1000);
  }
});

socket.on('playerEliminated', (playerId) => {
  if (players[playerId]) delete players[playerId];
});

socket.on('gameOver', (data) => {
  gamePhase = 'GAMEOVER';
  gameOverScreen.innerHTML = `<p>${data.message}</p><button id="playAgainBtn" style="margin-top: 20px; padding: 10px 20px; font-size: 18px; cursor: pointer;">Play Again</button>`;
  gameOverScreen.style.display = 'block';

  document.querySelector('#playAgainBtn').addEventListener('click', () => {
      // Reset client state and show login form to rejoin
      gameOverScreen.style.display = 'none';
      usernameForm.style.display = 'flex';
      players = {};
      lobbyId = null;
      gamePhase = 'IDLE';
  });
});

socket.on('updatePlayers', (serverPlayers) => {
  for (const id in serverPlayers) {
    if (!players[id]) {
      players[id] = new Player(serverPlayers[id].x, serverPlayers[id].y, 50, 50, './images/image (2).png');
    }
    const player = players[id];
    player.serverX = serverPlayers[id].x;
    player.serverY = serverPlayers[id].y;
    player.groupId = serverPlayers[id].groupId;
    player.username = serverPlayers[id].username;
  }
  for (const id in players) {
    if (!serverPlayers[id]) {
      delete players[id];
    }
  }
});

// --- Mingle logic (mostly unchanged, ensure you adapt it if needed)
// ... Your existing mingle logic functions (checkMingle, openMingleDialog, etc.) go here ...

// --- MAIN ANIMATE LOOP ---
function animate() {
  requestAnimationFrame(animate);
  c.fillStyle = 'rgba(243, 206, 167, 0.76)';
  c.fillRect(0, 0, canvas.width, canvas.height);
  
  if (gamePhase !== 'IDLE') {
    safeRoom.draw();
    horse.update();
    horse.draw();

    for (const id in players) {
        const player = players[id];
        if (typeof player.serverX !== 'undefined') {
            player.x += (player.serverX - player.x) * 0.1;
            player.y += (player.serverY - player.y) * 0.1;
        }
        player.draw();
    }
    drawTimer();
  } else {
      // Idle screen logic, maybe just show the horse
      horse.update();
      horse.draw();
  }
}

// --- KEYBOARD CONTROLS ---
const keys = { w: { pressed: false }, a: { pressed: false }, s: { pressed: false }, d: { pressed: false } };
setInterval(() => {
  // Only send input if we are in an active game phase
  if (gamePhase === 'MINGLE' || gamePhase === 'OBJECTIVE') {
    socket.emit('input', keys);
  }
}, 15);

window.addEventListener('keydown', (e) => {
    const key = e.code.replace('Key', '').toLowerCase();
    if(keys.hasOwnProperty(key)) keys[key].pressed = true;
});
window.addEventListener('keyup', (e) => {
    const key = e.code.replace('Key', '').toLowerCase();
    if(keys.hasOwnProperty(key)) keys[key].pressed = false;
});

// --- INITIALIZATION ---
usernameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const username = usernameInput.value;
  if (username) {
    socket.emit('findGame', username);
    usernameForm.style.display = 'none';
  }
});

// Helper function for drawing timer
function drawTimer() {
    if (gamePhase !== 'MINGLE' && gamePhase !== 'OBJECTIVE') return;
    const minutes = Math.floor(timerValue / 60);
    const seconds = timerValue % 60;
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    const boxWidth = 200, boxHeight = 60, boxX = canvas.width / 2 - boxWidth / 2, boxY = 10;
    c.fillStyle = 'rgba(14, 14, 14, 0.91)';
    c.fillRect(boxX, boxY, boxWidth, boxHeight);
    c.shadowColor = 'silver'; c.shadowBlur = 15; c.lineWidth = 5;
    c.strokeStyle = 'rgba(169, 169, 169, 0.9)';
    c.strokeRect(boxX, boxY, boxWidth, boxHeight);
    c.shadowColor = 'transparent'; c.shadowBlur = 0;
    c.font = '40px Arial'; c.textAlign = 'center'; c.fillStyle = 'red';
    c.fillText(formattedTime, canvas.width / 2, boxY + boxHeight / 2 + 10);
}


animate(); // Start the main loop
