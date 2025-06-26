const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const io = new Server(server, { pingInterval: 2000, pingTimeout: 10000 });
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

// --- CORE GAME CONSTANTS ---
const MINGLE_DURATION_SECONDS = 120;
const OBJECTIVE_DURATION_SECONDS = 60;
const REQUIRED_PLAYER_COUNT = 5;
const PLAYER_SPEED = 5;
const TICK_RATE = 20;
const SAFE_ROOM_RECT = { x: 100, y: 150, width: 400, height: 400 };

// --- NEW: Game World Boundaries (The Invisible Walls) ---
const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 900;
const PLAYER_SIZE = 50; // A fixed size for server-side collision checks

// --- DISCORD LINK MANAGEMENT ---
const DISCORD_LINKS = [
    { url: 'https://discord.gg/BS9GAwyY', inUse: false },
    { url: 'https://discord.gg/Mrvr6MfW', inUse: false },
    { url: 'https://discord.gg/mqK76H5b', inUse: false },
    { url: 'https://discord.gg/achZmwb9', inUse: false },
    { url: 'https://discord.gg/nM82w6kB', inUse: false },
];

function getAvailableDiscordLink() {
    const link = DISCORD_LINKS.find(l => !l.inUse);
    if (link) {
        link.inUse = true;
        return link.url;
    }
    return null;
}

function releaseDiscordLink(url) {
    const link = DISCORD_LINKS.find(l => l.url === url);
    if (link) {
        link.inUse = false;
    }
}

// --- LOBBY MANAGEMENT ---
const lobbies = {};

function createLobby() {
    const lobbyId = uuidv4();
    const discordLink = getAvailableDiscordLink();
    if (!discordLink) return null;

    lobbies[lobbyId] = {
        id: lobbyId,
        players: {},
        groups: {},
        groupRequests: {},
        playerInputs: {},
        gamePhase: 'WAITING',
        gameTimer: null,
        groupIdCounter: 1,
        discordLink: discordLink,
    };
    console.log(`Lobby created: ${lobbyId}`);
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
    if (lobby.discordLink) releaseDiscordLink(lobby.discordLink);
    
    io.to(lobbyId).emit('lobbyReset');

    io.sockets.in(lobbyId).sockets.forEach(s => {
        s.leave(lobbyId);
    });

    delete lobbies[lobbyId];
    console.log(`Lobby ${lobbyId} deleted.`);
}

// --- FULLY IMPLEMENTED GAME LOGIC ---
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
    setTimeout(() => resetLobby(lobby.id), 10000);
}

// --- MAIN SERVER GAME LOOP ---
setInterval(() => {
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
                    
                    // --- THE INVISIBLE WALLS ---
                    // This logic ensures the player's center cannot go past the world boundaries.
                    const halfSize = PLAYER_SIZE / 2;
                    player.x = Math.max(halfSize, Math.min(WORLD_WIDTH - halfSize, player.x));
                    player.y = Math.max(halfSize, Math.min(WORLD_HEIGHT - halfSize, player.y));
                }
            }
            io.to(lobby.id).emit('updatePlayers', lobby.players);
        }
    }
}, 1000 / TICK_RATE);

// --- SOCKET CONNECTION HANDLING ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('findGame', (username) => {
        const lobby = findOrCreateLobby();
        if (!lobby) {
            socket.emit('error', 'Server is at full capacity.');
            return;
        }
        socket.join(lobby.id);
        socket.lobbyId = lobby.id;
        lobby.playerInputs[socket.id] = { w: {pressed:false}, a: {pressed:false}, s: {pressed:false}, d: {pressed:false} };
        
        // Spawn players within the world boundaries
        lobby.players[socket.id] = {
            x: Math.random() * (WORLD_WIDTH - PLAYER_SIZE) + PLAYER_SIZE / 2,
            y: Math.random() * (WORLD_HEIGHT - PLAYER_SIZE) + PLAYER_SIZE / 2,
            username, groupId: null, busy: false,
        };
        socket.emit('joinedLobby', { lobbyId: lobby.id, discordLink: lobby.discordLink });
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
    
    socket.on('requestMingle', (data) => {
        const lobby = lobbies[socket.lobbyId];
        if (!lobby || lobby.gamePhase !== 'MINGLE') return;

        const { targetId, type } = data;
        const requesterId = socket.id;
        const requester = lobby.players[requesterId];
        const target = lobby.players[targetId];

        if (!requester || !target || requester.busy || target.busy) return;

        const requestId = `${requesterId}-${targetId}`;
        requester.busy = true; target.busy = true;
        
        lobby.groupRequests[requestId] = {
            requesterId, targetId, type,
            timeout: setTimeout(() => {
                delete lobby.groupRequests[requestId];
                if (lobby.players[requesterId]) lobby.players[requesterId].busy = false;
                if (lobby.players[targetId]) lobby.players[targetId].busy = false;
                io.to(lobby.id).emit('updatePlayers', lobby.players);
            }, 10000),
        };

        io.to(targetId).emit('mingleRequested', { from: requesterId, username: requester.username, requestType: type });
        io.to(requesterId).emit('mingleRequestSent', { to: targetId, username: target.username });
        io.to(lobby.id).emit('updatePlayers', lobby.players);
    });

    socket.on('respondMingle', (data) => {
        const lobby = lobbies[socket.lobbyId];
        if (!lobby) return;

        const { requestId, accepted } = data;
        const request = lobby.groupRequests[requestId];
        if (!request) return;

        const { requesterId, targetId } = request;
        const requester = lobby.players[requesterId];
        const target = lobby.players[targetId];

        clearTimeout(request.timeout);
        delete lobby.groupRequests[requestId];

        if(requester) requester.busy = false;
        if(target) target.busy = false;

        if (accepted && requester && target) {
            let newGroupId;
            if (!requester.groupId && !target.groupId) {
                newGroupId = `${lobby.id}-${lobby.groupIdCounter++}`;
                lobby.groups[newGroupId] = [{ id: requesterId, username: requester.username }, { id: targetId, username: target.username }];
                requester.groupId = newGroupId; target.groupId = newGroupId;
            } else if (!requester.groupId && target.groupId) {
                newGroupId = target.groupId;
                lobby.groups[newGroupId].push({ id: requesterId, username: requester.username });
                requester.groupId = newGroupId;
            } else if (requester.groupId && !target.groupId) {
                newGroupId = requester.groupId;
                lobby.groups[newGroupId].push({ id: targetId, username: target.username });
                target.groupId = newGroupId;
            } else if (requester.groupId && target.groupId && requester.groupId !== target.groupId) {
                const oldGroup = lobby.groups[requester.groupId];
                newGroupId = target.groupId;
                lobby.groups[newGroupId].push(...oldGroup);
                oldGroup.forEach(m => { if(lobby.players[m.id]) lobby.players[m.id].groupId = newGroupId; });
                delete lobby.groups[requester.groupId];
            }
            io.to(lobby.id).emit('mingleSuccess');
            io.to(lobby.id).emit('groupUpdate', lobby.groups);
        } else {
            io.to(requesterId).emit('mingleDeclined', target?.username);
        }
        io.to(lobby.id).emit('updatePlayers', lobby.players);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        const lobby = lobbies[socket.lobbyId];
        if (lobby) {
            delete lobby.players[socket.id];
            delete lobby.playerInputs[socket.id];
            io.to(lobby.id).emit('updatePlayers', lobby.players);
        }
    });
});

server.listen(port, () => console.log(`Game server listening on port ${port}`));
