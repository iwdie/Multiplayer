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

// --- GAME OBJECTS ---
const x = canvas.width / 2;
const y = canvas.height / 2;
const horse = new horses(x, y, 180, 180, './images/horseswithbg-removebg-preview.png', 'rgba(248, 232, 84, 0.89)');
const safeRoom = new Room(200, 150, 400, 300, 'rgba(0, 255, 0, 0.15)');
const backgroundMusic = new Audio('./sounds/mingle_sound.mp3');
backgroundMusic.loop = true;
backgroundMusic.volume = 0.5;

// --- UI ELEMENTS ---
const startMusicButton = document.createElement('button');
startMusicButton.style.backgroundColor = 'black';
startMusicButton.textContent = '🎶';
startMusicButton.style.color = 'rgb(241, 23, 150)';
startMusicButton.style.position = 'absolute';
startMusicButton.style.top = '10px';
startMusicButton.style.left = '10px';
startMusicButton.style.padding = '10px';
startMusicButton.style.fontSize = '16px';
startMusicButton.style.cursor = 'pointer';
document.body.appendChild(startMusicButton);
const mingleBtn = document.getElementById('mingle-btn');


// --- SOCKET EVENT LISTENERS ---
socket.on('gamePhaseUpdate', (data) => {
  console.log(`New game phase: ${data.phase}, Duration: ${data.duration}`);
  gamePhase = data.phase;
  timerValue = data.duration;
  if (clientTimerInterval) clearInterval(clientTimerInterval);
  if (gamePhase === 'MINGLE' || gamePhase === 'OBJECTIVE') {
    clientTimerInterval = setInterval(() => {
      if (timerValue > 0) timerValue--;
    }, 1000);
  }
});

socket.on('playerEliminated', (playerId) => {
  console.log(`Player ${playerId} was eliminated.`);
  if (players[playerId]) delete players[playerId];
});

socket.on('gameOver', (data) => {
  console.log(data.message);
  const gameOverScreen = document.createElement('div');
  gameOverScreen.style.cssText = "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px; background-color: rgba(0, 0, 0, 0.9); color: white; font-size: 30px; border-radius: 10px; text-align: center; box-shadow: 0 0 15px red;";
  gameOverScreen.innerHTML = `<p>${data.message}</p>`;
  document.body.appendChild(gameOverScreen);
  cancelAnimationFrame(animationId);
});

socket.on('updatePlayers', (BackendPlayers) => {
  for (const id in BackendPlayers) {
    const backendPlayer = BackendPlayers[id];
    if (!players[id]) {
      players[id] = new Player(backendPlayer.x, backendPlayer.y, 50, 50, './images/image (2).png');
    }
    const player = players[id];
    player.serverX = backendPlayer.x;
    player.serverY = backendPlayer.y;
    player.groupId = backendPlayer.groupId;
    player.username = backendPlayer.username;
    player.busy = backendPlayer.busy;
    player.isRequestReceived = backendPlayer.isRequestReceived;
  }
  for (const id in players) {
    if (!BackendPlayers[id]) {
      delete players[id];
    }
  }
});

startMusicButton.addEventListener('click', () => {
  backgroundMusic.play().catch(error => console.error('Error playing music:', error));
  startMusicButton.style.display = 'none';
});

// --- NEW, ROBUST MINGLE LOGIC ---
let isDialogOpen = false;
let currentMingleTargetId = null;
let potentialMingleTarget = null;

function updateMingleState() {
    const localPlayer = players[socket.id];
    if (!localPlayer || isDialogOpen || currentMingleTargetId) {
        mingleBtn.disabled = true;
        mingleBtn.classList.remove('enabled');
        return;
    }

    let closestDistance = Infinity;
    let bestTarget = null;

    for (const id in players) {
        if (id === socket.id) continue;
        const otherPlayer = players[id];
        
        const isEligible = !otherPlayer.busy && !otherPlayer.isRequestReceived && !(localPlayer.groupId && localPlayer.groupId === otherPlayer.groupId);
        
        if (isEligible && localPlayer.isMinglingWith(otherPlayer)) {
            const dx = localPlayer.x - otherPlayer.x;
            const dy = localPlayer.y - otherPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                bestTarget = id;
            }
        }
    }
    
    potentialMingleTarget = bestTarget;

    if (potentialMingleTarget) {
        mingleBtn.disabled = false;
        mingleBtn.classList.add('enabled');
    } else {
        mingleBtn.disabled = true;
        mingleBtn.classList.remove('enabled');
    }
}


if (mingleBtn) {
    mingleBtn.addEventListener('click', () => {
        if (potentialMingleTarget) {
            const localPlayer = players[socket.id];
            const otherPlayer = players[potentialMingleTarget];
            if (!localPlayer || !otherPlayer) return;

            let requestType = '';
            if (!localPlayer.groupId && !otherPlayer.groupId) requestType = 'newGroup';
            else if (localPlayer.groupId && !otherPlayer.groupId) requestType = 'inviteToGroup';
            else if (!localPlayer.groupId && otherPlayer.groupId) requestType = 'joinGroup';
            else requestType = 'mergeGroups';

            socket.emit('requestMingle', { targetId: potentialMingleTarget, type: requestType });
            currentMingleTargetId = potentialMingleTarget;
            mingleBtn.disabled = true;
            mingleBtn.classList.remove('enabled');
        }
    });
}


socket.on('groupUpdate', (groups) => {
    const groupList = document.querySelector('#groupList');
    const myGroupInfo = document.querySelector('#myGroupInfo');
    groupList.innerHTML = '';
    myGroupInfo.innerHTML = '';
    const localPlayer = players[socket.id];
    let inAGroup = false;
    if (localPlayer && localPlayer.groupId && groups[localPlayer.groupId]) {
        inAGroup = true;
        const myGroup = groups[localPlayer.groupId];
        myGroupInfo.innerHTML = `<h4 style="color: rgb(255, 0, 149); text-align: center;">My Group: ${localPlayer.groupId}</h4><ul style="margin: 5px 0; padding-left: 20px; list-style: disc;">${myGroup.map((member) => `<li>${players[member.id]?.username || '...'} ${member.id === socket.id ? '(You)' : ''}</li>`).join('')}</ul>`;
    } else {
        myGroupInfo.innerHTML = '<p style="text-align: center;">Not currently in a group.</p>';
    }
    const otherGroupsDiv = document.createElement('div');
    otherGroupsDiv.innerHTML = '<h3 style="text-align: center; color: rgb(255, 0, 149);">Other Groups</h3>';
    if (Object.keys(groups).length === 0 || (Object.keys(groups).length === 1 && inAGroup)) {
        otherGroupsDiv.innerHTML += '<p style="text-align: center;">No other groups yet.</p>';
    } else {
        for (const groupId in groups) {
            if (localPlayer && groupId === localPlayer.groupId) continue;
            const group = groups[groupId];
            const groupDiv = document.createElement('div');
            groupDiv.style.cssText = "margin-bottom: 15px; padding: 10px; background-color: rgba(255, 255, 255, 0.1); border-radius: 5px; box-shadow: 0 0 5px rgba(255, 255, 255, 0.2);";
            groupDiv.innerHTML = `<strong style="color: rgb(255, 0, 149);">Group ID:</strong> ${groupId}<br><strong style="color: rgb(255, 0, 149);">Members:</strong><ul style="margin: 5px 0; padding-left: 20px; list-style: disc;">${group.map((member) => `<li>${players[member.id]?.username || '...'}</li>`).join('')}</ul>`;
            otherGroupsDiv.appendChild(groupDiv);
        }
    }
    groupList.appendChild(otherGroupsDiv);
});

socket.on('mingleRequested', (data) => {
    if (isDialogOpen) return;
    const { from, username, requestType } = data;
    currentMingleTargetId = from;
    let dialogText = '';
    switch (requestType) {
        case 'newGroup': dialogText = `${username} wants to form a new group with you! Do you accept?`; break;
        case 'joinGroup': dialogText = `${username} wants to join your group! Do you accept?`; break;
        case 'inviteToGroup': dialogText = `${username} invites you to join their group! Do you accept?`; break;
        case 'mergeGroups': dialogText = `${username} from another group wants to merge with yours! Do you accept?`; break;
        default: dialogText = `${username} wants to mingle! Do you accept?`;
    }
    openMingleDialog(from, username, dialogText);
});

socket.on('mingleRequestSent', (data) => showTemporaryMessage(`Request sent to ${data.username}.`));
socket.on('mingleSuccess', () => { currentMingleTargetId = null; showTemporaryMessage('Mingle successful!'); });
socket.on('mingleDeclined', (username) => { showTemporaryMessage(`${username} declined your request.`); currentMingleTargetId = null; });
socket.on('mingleTimeout', (username) => { showTemporaryMessage(`Mingle request to ${username} timed out.`); currentMingleTargetId = null; });
socket.on('mingleError', (message) => { showTemporaryMessage(`Mingle Error: ${message}`); currentMingleTargetId = null; });

function openMingleDialog(fromPlayerId, fromUsername, dialogMessage) {
    isDialogOpen = true;
    const dialog = document.createElement('div');
    dialog.id = 'mingleDialog';
    dialog.style.cssText = "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px; background-color: rgba(0, 0, 0, 0.8); color: white; border-radius: 4px; text-align: center; box-shadow: 0 0 15px pink; z-index: 200;";
    dialog.innerHTML = `<p>${dialogMessage}</p><button id="mingleYes" style="margin: 10px; padding: 10px; background-color: blue; color: white; cursor: pointer;">Yes</button><button id="mingleNo" style="margin: 10px; padding: 10px; background-color: red; color: white; cursor: pointer;">No</button>`;
    document.body.appendChild(dialog);
    const closeDialog = () => {
        document.body.removeChild(dialog);
        isDialogOpen = false;
        currentMingleTargetId = null;
    };
    document.getElementById('mingleYes').onclick = () => {
        socket.emit('respondMingle', { requestId: `${fromPlayerId}-${socket.id}`, accepted: true });
        closeDialog();
    };
    document.getElementById('mingleNo').onclick = () => {
        socket.emit('respondMingle', { requestId: `${fromPlayerId}-${socket.id}`, accepted: false });
        closeDialog();
    };
}

function showTemporaryMessage(message) {
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = "position: absolute; top: 20%; left: 50%; transform: translate(-50%, -50%); padding: 10px 20px; background-color: rgba(0, 0, 0, 0.7); color: white; border-radius: 5px; z-index: 300;";
    msgDiv.textContent = message;
    document.body.appendChild(msgDiv);
    setTimeout(() => { if (msgDiv.parentNode) { msgDiv.parentNode.removeChild(msgDiv); } }, 3000);
}

function drawTimer() {
  if (gamePhase === 'WAITING' || gamePhase === 'GAMEOVER') return;
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
    updateMingleState();
  }

  for (const id in players) {
    const player = players[id];
    if (typeof player.serverX !== 'undefined') {
      player.x += (player.serverX - player.x) * 0.1;
      player.y += (player.serverY - player.y) * 0.1;
    }
    player.draw();
  }

  drawTimer();
}

// --- KEYBOARD CONTROLS ---
const keys = { w: { pressed: false }, a: { pressed: false }, s: { pressed: false }, d: { pressed: false } };
setInterval(() => {
  if (players[socket.id]) {
    socket.emit('input', keys);
  }
}, 15);
window.addEventListener('keydown', (event) => {
  if (!players[socket.id]) return;
  
  // Handle movement keys
  const key = event.code.replace('Key', '').toLowerCase();
  if (keys.hasOwnProperty(key)) {
    keys[key].pressed = true;
  }
  
  // --- NEW: Handle Spacebar for Mingle ---
  if (event.code === 'Space') {
    event.preventDefault(); // Prevent page from scrolling
    if (mingleBtn && !mingleBtn.disabled) {
      mingleBtn.click();
    }
  }
});
window.addEventListener('keyup', (event) => {
  if (!players[socket.id]) return;
  const key = event.code.replace('Key', '').toLowerCase();
  if (keys.hasOwnProperty(key)) keys[key].pressed = false;
});

// --- Mobile Orientation and Fullscreen Logic ---
function lockScreenToLandscape() {
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch((error) => console.error('Could not lock screen:', error));
    }
}
function enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => console.error(`Fullscreen failed: ${err.message}`));
    } else if (elem.webkitRequestFullscreen) { // Safari
        elem.webkitRequestFullscreen();
    }
}

// --- INITIALIZATION ---
document.querySelector('#usernameForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isMobile) {
      enterFullscreen();
      lockScreenToLandscape();
  }
  socket.emit('findGame', document.querySelector('#usernameInput').value);
  document.querySelector('#usernameForm').style.display = 'none';
});

animate();
