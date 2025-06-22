const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid'); // Use 'npm install uuid' to add this package

const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 });
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

// --- CORE GAME CONSTANTS ---
const MINGLE_DURATION_SECONDS = 120;
const OBJECTIVE_DURATION_SECONDS = 60;
const REQUIRED_PLAYER_COUNT = 5;
const PLAYER_SPEED = 5;
const TICK_RATE = 60;
const SAFE_ROOM_RECT = { x: 200, y: 150, width: 400, height: 300 };

// --- LOBBY MANAGEMENT ---
const lobbies = {};

function createLobby() {
    const lobbyId = uuidv4();
    lobbies[lobbyId] = {
        id: lobbyId,
        players: {},
        groups: {},
        groupRequests: {},
        playerInputs: {},
        gamePhase: 'WAITING',
        gameTimer: null,
        groupIdCounter: 1,
    };
    return lobbies[lobbyId];
}

function findOrCreateLobby() {
    for (const lobbyId in lobbies) {
        const lobby = lobbies[lobbyId];
        if (lobby.gamePhase === 'WAITING' && Object.keys(lobby.players).length < REQUIRED_PLAYER_COUNT) {
            return lobby;
        }
    }
    return createLobby();
}

function resetLobby(lobbyId) {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    console.log(`Resetting lobby ${lobbyId}`);
    clearTimeout(lobby.gameTimer);
    
    // Create a fresh lobby state, preserving the ID
    lobbies[lobbyId] = {
        ...createLobby(),
        id: lobbyId,
    };
}


// --- LOBBY-SPECIFIC GAME LOGIC ---
function startGame(lobby) {
    console.log(`Lobby ${lobby.id}: Starting Mingle Phase.`);
    lobby.gamePhase = 'MINGLE';
    io.to(lobby.id).emit('gamePhaseUpdate', { phase: lobby.gamePhase, duration: MINGLE_DURATION_SECONDS });
    lobby.gameTimer = setTimeout(() => startObjectivePhase(lobby), MINGLE_DURATION_SECONDS * 1000);
}

function startObjectivePhase(lobby) {
    console.log(`Lobby ${lobby.id}: Starting Objective Phase.`);
    lobby.gamePhase = 'OBJECTIVE';

    let lonerId = null;
    for (const id in lobby.players) {
        if (!lobby.players[id].groupId) {
            lonerId = id;
            break;
        }
    }

    if (lonerId) {
        console.log(`Lobby ${lobby.id}: Eliminating loner ${lobby.players[lonerId]?.username}`);
        delete lobby.players[lonerId];
        io.to(lobby.id).emit('playerEliminated', lonerId);
    }
    
    io.to(lobby.id).emit('gamePhaseUpdate', { phase: lobby.gamePhase, duration: OBJECTIVE_DURATION_SECONDS });
    lobby.gameTimer = setTimeout(() => endGame(lobby), OBJECTIVE_DURATION_SECONDS * 1000);
}

function endGame(lobby) {
    console.log(`Lobby ${lobby.id}: Game Over.`);
    lobby.gamePhase = 'GAMEOVER';

    const playersInRoom = Object.values(lobby.players).filter(p => 
        p.x > SAFE_ROOM_RECT.x && p.x < SAFE_ROOM_RECT.x + SAFE_ROOM_RECT.width &&
        p.y > SAFE_ROOM_RECT.y && p.y < SAFE_ROOM_RECT.y + SAFE_ROOM_RECT.height
    );

    let winningGroup = false;
    if (playersInRoom.length === 4) {
        const firstGroupId = playersInRoom[0].groupId;
        if (firstGroupId && playersInRoom.every(p => p.groupId === firstGroupId)) {
            winningGroup = true;
        }
    }

    const message = winningGroup ? 'Your group survived!' : 'Your group failed to assemble in time!';
    io.to(lobby.id).emit('gameOver', { message });

    // Reset the lobby after a delay so players can see the result
    setTimeout(() => resetLobby(lobby.id), 10000);
}

// --- MAIN SERVER GAME LOOP (Processes all active lobbies) ---
function serverTick() {
    for (const lobbyId in lobbies) {
        const lobby = lobbies[lobbyId];
        if (lobby.gamePhase === 'MINGLE' || lobby.gamePhase === 'OBJECTIVE') {
            for (const playerId in lobby.players) {
                const inputs = lobby.playerInputs[playerId];
                const player = lobby.players[playerId];
                if (inputs && player) {
                    if (inputs.w.pressed) player.y -= PLAYER_SPEED;
                    if (inputs.a.pressed) player.x -= PLAYER_SPEED;
                    if (inputs.s.pressed) player.y += PLAYER_SPEED;
                    if (inputs.d.pressed) player.x += PLAYER_SPEED;
                }
            }
            // Broadcast updates only for this lobby
            io.to(lobby.id).emit('updatePlayers', lobby.players);
        }
    }
}
setInterval(serverTick, 1000 / TICK_RATE);

// --- SOCKET CONNECTION HANDLING ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('findGame', (username) => {
        const lobby = findOrCreateLobby();
        socket.join(lobby.id);
        socket.lobbyId = lobby.id;

        lobby.playerInputs[socket.id] = { w: {pressed:false}, a: {pressed:false}, s: {pressed:false}, d: {pressed:false} };
        lobby.players[socket.id] = {
            x: 500 * Math.random(), y: 500 * Math.random(),
            username, groupId: null, busy: false,
        };

        // Tell the client they've joined
        socket.emit('joinedLobby', { lobbyId: lobby.id, players: lobby.players });
        // Tell everyone in the lobby about the new player
        io.to(lobby.id).emit('updatePlayers', lobby.players);

        if (lobby.gamePhase === 'WAITING' && Object.keys(lobby.players).length === REQUIRED_PLAYER_COUNT) {
            startGame(lobby);
        }
    });

    socket.on('input', (keys) => {
        const lobby = lobbies[socket.lobbyId];
        if (lobby && lobby.playerInputs[socket.id]) {
            lobby.playerInputs[socket.id] = keys;
        }
    });
    
    // Mingle logic now needs to operate on the correct lobby
    // ... (Your requestMingle and respondMingle logic would go here, adapted to use `lobbies[socket.lobbyId]`)

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        const lobby = lobbies[socket.lobbyId];
        if (lobby) {
            delete lobby.players[socket.id];
            delete lobby.playerInputs[socket.id];
            // Tell the rest of the lobby a player left
            io.to(lobby.id).emit('updatePlayers', lobby.players);
        }
    });
});

server.listen(port, () => console.log(`Ringa Ringa Mingle listening on port ${port}`));
