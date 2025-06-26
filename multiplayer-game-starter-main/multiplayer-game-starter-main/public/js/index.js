const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')
const socket = io()

// --- RESPONSIVE SIZING & GAME SETTINGS ---
let gameSettings = {};

function calculateSizes() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const baseUnit = Math.min(canvas.width, canvas.height) / 100;
    gameSettings = {
        playerSize: baseUnit * 6,
        horseSize: baseUnit * 25,
        roomWidth: baseUnit * 50,
        roomHeight: baseUnit * 40,
        get roomX() { return (canvas.width - this.roomWidth) / 10; },
        get roomY() { return (canvas.height - this.roomHeight) / 2; }
    };

    if(safeRoom) {
        safeRoom.width = gameSettings.roomWidth;
        safeRoom.height = gameSettings.roomHeight;
        safeRoom.x = gameSettings.roomX;
        safeRoom.y = gameSettings.roomY;
    }
    if(horse) {
        horse.size = gameSettings.horseSize;
        horse.x = canvas.width / 2;
        horse.y = canvas.height / 2;
    }
    for(const id in players) {
        if(players[id]) players[id].size = gameSettings.playerSize;
    }
}

// --- CLIENT-SIDE STATE ---
let players = {}; 
let gamePhase = 'IDLE'; // IDLE, WAITING, MINGLE, OBJECTIVE, GAMEOVER
let lobbyId = null;
let timerValue = 0;
let clientTimerInterval = null;

// --- GAME OBJECTS ---
const horse = new horses(0, 0, 0, './images/horseswithbg-removebg-preview.png', 'rgba(248, 232, 84, 0.89)');
const safeRoom = new Room(0, 0, 0, 0, 'rgba(202, 56, 139, 0.15)');
const backgroundMusic = new Audio('./sounds/mingle_sound.mp3');
backgroundMusic.loop = true;
backgroundMusic.volume = 0.5;

// --- DOM ELEMENTS ---
const usernameForm = document.querySelector('#usernameForm');
const usernameInput = document.querySelector('#usernameInput');
const startMusicButton = document.createElement('button');
startMusicButton.style.cssText = "position: absolute; top: 10px; left: 10px; padding: 10px; font-size: 16px; background-color: black; color: rgb(241, 23, 150); cursor: pointer; border: none; border-radius: 5px;";
startMusicButton.textContent = '🎶';
document.body.appendChild(startMusicButton);

const mingleBtn = document.getElementById('mingle-btn');
const voiceChatContainer = document.getElementById('voice-chat-container');
const joinVoiceBtn = document.getElementById('join-voice-btn');
const gameOverScreen = document.createElement('div');
gameOverScreen.style.cssText = "display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px; background-color: rgba(0, 0, 0, 0.9); color: white; font-size: 30px; border-radius: 10px; text-align: center; box-shadow: 0 0 15px red; z-index: 300;";
document.body.appendChild(gameOverScreen);


// --- SOCKET EVENT LISTENERS ---
socket.on('joinedLobby', (data) => {
    console.log(`Joined lobby: ${data.lobbyId}`);
    lobbyId = data.lobbyId;
    gamePhase = 'WAITING';
    usernameForm.style.display = 'none';

    if (data.discordLink && voiceChatContainer && joinVoiceBtn) {
        voiceChatContainer.style.display = 'block';
        joinVoiceBtn.onclick = () => window.open(data.discordLink, '_blank');
    }
});

socket.on('lobbyReset', () => {
    if(voiceChatContainer) voiceChatContainer.style.display = 'none';
    usernameForm.style.display = 'flex';
    players = {};
    lobbyId = null;
    gamePhase = 'IDLE';
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
        gameOverScreen.style.display = 'none';
        socket.emit('findGame', usernameInput.value || 'Player');
    });
});

socket.on('updatePlayers', (BackendPlayers) => {
    for (const id in BackendPlayers) {
        if (!players[id]) {
            players[id] = new Player(BackendPlayers[id].x, BackendPlayers[id].y, gameSettings.playerSize, './images/image (2).png');
        }
        const player = players[id];
        player.serverX = BackendPlayers[id].x;
        player.serverY = BackendPlayers[id].y;
        player.groupId = BackendPlayers[id].groupId;
        player.username = BackendPlayers[id].username;
        player.busy = BackendPlayers[id].busy;
    }
    for (const id in players) {
        if (!BackendPlayers[id]) {
            delete players[id];
        }
    }
});


// --- MINGLE & UI LOGIC ---
let isDialogOpen = false;
let currentMingleTargetId = null;
let potentialMingleTarget = null;

function updateMingleState() {
    if(!mingleBtn) return;
    const localPlayer = players[socket.id];
    if (!localPlayer || isDialogOpen || currentMingleTargetId) {
        mingleBtn.disabled = true;
        mingleBtn.classList.remove('enabled');
        return;
    }
    let closestDistance = Infinity, bestTarget = null;
    for (const id in players) {
        if (id === socket.id) continue;
        const otherPlayer = players[id];
        const isEligible = !otherPlayer.busy && !(localPlayer.groupId && localPlayer.groupId === otherPlayer.groupId);
        if (isEligible && localPlayer.isMinglingWith(otherPlayer)) {
            const distance = Math.sqrt(Math.pow(localPlayer.x - otherPlayer.x, 2) + Math.pow(localPlayer.y - otherPlayer.y, 2));
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

socket.on('groupUpdate', (groups) => {
    const groupList = document.querySelector('#groupList');
    if(!groupList) return;
    const myGroupInfo = document.querySelector('#myGroupInfo');
    groupList.innerHTML = '';
    myGroupInfo.innerHTML = '';
    const localPlayer = players[socket.id];
    let inAGroup = false;
    if (localPlayer && localPlayer.groupId && groups && groups[localPlayer.groupId]) {
        inAGroup = true;
        const myGroup = groups[localPlayer.groupId];
        myGroupInfo.innerHTML = `<h4 style="color: rgb(255, 0, 149); text-align: center;">My Group</h4><ul style="margin: 5px 0; padding-left: 20px; list-style: disc;">${myGroup.map((member) => `<li>${member.username} ${member.id === socket.id ? '(You)' : ''}</li>`).join('')}</ul>`;
    } else {
        myGroupInfo.innerHTML = '<p style="text-align: center;">Not currently in a group.</p>';
    }
    const otherGroupsDiv = document.createElement('div');
    otherGroupsDiv.innerHTML = '<h3 style="text-align: center; color: rgb(255, 0, 149);">Other Groups</h3>';
    if (!groups || Object.keys(groups).length === 0 || (Object.keys(groups).length === 1 && inAGroup)) {
        otherGroupsDiv.innerHTML += '<p style="text-align: center;">No other groups yet.</p>';
    } else {
        for (const groupId in groups) {
            if (localPlayer && groupId === localPlayer.groupId) continue;
            const group = groups[groupId];
            const groupDiv = document.createElement('div');
            groupDiv.style.cssText = "margin-bottom: 15px; padding: 10px; background-color: rgba(255, 255, 255, 0.1); border-radius: 5px; box-shadow: 0 0 5px rgba(255, 255, 255, 0.2);";
            groupDiv.innerHTML = `<strong style="color: rgb(255, 0, 149);">Group ID:</strong> ${groupId}<br><strong style="color: rgb(255, 0, 149);">Members:</strong><ul style="margin: 5px 0; padding-left: 20px; list-style: disc;">${group.map((member) => `<li>${member.username}</li>`).join('')}</ul>`;
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
        if(document.body.contains(dialog)) document.body.removeChild(dialog);
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


// --- CONTROLS ---
const keys = { w: { pressed: false }, a: { pressed: false }, s: { pressed: false }, d: { pressed: false } };
setInterval(() => {
    if (gamePhase === 'MINGLE' || gamePhase === 'OBJECTIVE') {
        socket.emit('input', keys);
    }
}, 15);
window.addEventListener('keydown', (e) => {
    const key = e.code.replace('Key', '').toLowerCase();
    if(keys.hasOwnProperty(key)) keys[key].pressed = true;
    if (e.code === 'Space' && mingleBtn && !mingleBtn.disabled) {
        e.preventDefault();
        mingleBtn.click();
    }
});
window.addEventListener('keyup', (e) => {
    const key = e.code.replace('Key', '').toLowerCase();
    if(keys.hasOwnProperty(key)) keys[key].pressed = false;
});


// --- MAIN ANIMATE LOOP ---
function animate() {
    requestAnimationFrame(animate);
    c.fillStyle = 'rgba(237, 137, 30, 0.76)';
    c.fillRect(0, 0, canvas.width, canvas.height);
  
    if (gamePhase !== 'IDLE') {
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
    } else {
        horse.update();
        horse.draw();
    }
}


// --- INITIALIZATION & RESIZE ---
function handleResize() {
    calculateSizes();
}
window.addEventListener('resize', handleResize);

startMusicButton.addEventListener('click', () => {
    backgroundMusic.play().catch(error => console.error('Error playing music:', error));
    startMusicButton.style.display = 'none';
});

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


usernameForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const username = usernameInput.value;
    if (username) {
        socket.emit('findGame', username);
        usernameForm.style.display = 'none';
    }
});

handleResize();
animate();
