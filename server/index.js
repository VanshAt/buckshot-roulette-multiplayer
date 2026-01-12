const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

app.get('/', (req, res) => {
  res.send('Buckshot Roulette Server');
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', () => {
    const roomId = uuidv4().substring(0, 6);
    rooms.set(roomId, {
      players: [socket.id],
      gameState: null,
      ready: false
    });
    socket.join(roomId);
    socket.emit('roomCreated', roomId);
  });

  socket.on('joinRoom', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('error', 'Room full');
      return;
    }
    room.players.push(socket.id);
    socket.join(roomId);
    socket.emit('roomJoined', roomId);
    io.to(roomId).emit('playerJoined', room.players.length);
    if (room.players.length === 2) {
      startGame(roomId);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Handle disconnect, perhaps end game or wait
  });

  // Game actions
  socket.on('shoot', (target) => {
    const roomId = getRoomId(socket.id);
    if (!roomId) return;
    handleShoot(roomId, socket.id, target);
  });

  socket.on('useItem', (item) => {
    const roomId = getRoomId(socket.id);
    if (!roomId) return;
    handleUseItem(roomId, socket.id, item);
  });
});

function getRoomId(socketId) {
  for (const [roomId, room] of rooms) {
    if (room.players.includes(socketId)) {
      return roomId;
    }
  }
  return null;
}

function startGame(roomId) {
  const room = rooms.get(roomId);
  const numShells = Math.floor(Math.random() * 3) + 2; // 2-4 for round 1, but simplify
  const shells = [];
  for (let i = 0; i < numShells; i++) {
    shells.push(Math.random() < 0.5 ? 'live' : 'blank');
  }
  room.gameState = {
    shells,
    currentShell: 0,
    hp: [6, 6],
    items: [[], []], // items for each player
    turn: 0, // 0 or 1
    round: 1,
    log: [],
    handcuffed: false,
    sawed: false
  };
  io.to(roomId).emit('gameStart', room.gameState);
}

function handleShoot(roomId, socketId, target) {
  const room = rooms.get(roomId);
  const game = room.gameState;
  const playerIndex = room.players.indexOf(socketId);
  if (playerIndex !== game.turn) return;

  const shell = game.shells[game.currentShell];
  game.currentShell++;
  let damage = 1;
  if (game.sawed) {
    damage = 2;
    game.sawed = false;
  }
  if (target === 'self') {
    if (shell === 'live') {
      game.hp[playerIndex] -= damage;
      game.log.push(`Player ${playerIndex + 1} shot themselves with a live shell! HP: ${game.hp[playerIndex]}`);
    } else {
      game.log.push(`Player ${playerIndex + 1} shot themselves with a blank shell.`);
    }
  } else {
    const opponent = 1 - playerIndex;
    if (shell === 'live') {
      game.hp[opponent] -= damage;
      game.log.push(`Player ${playerIndex + 1} shot Player ${opponent + 1} with a live shell! HP: ${game.hp[opponent]}`);
    } else {
      game.log.push(`Player ${playerIndex + 1} shot Player ${opponent + 1} with a blank shell.`);
    }
  }
  game.sawed = false;
  if (game.handcuffed) {
    game.handcuffed = false;
  } else {
    game.turn = 1 - game.turn;
  }
  checkGameEnd(roomId);
  io.to(roomId).emit('updateGame', game);
}

function handleUseItem(roomId, socketId, item) {
  const room = rooms.get(roomId);
  const game = room.gameState;
  const playerIndex = room.players.indexOf(socketId);
  if (playerIndex !== game.turn) return;

  const items = game.items[playerIndex];
  const itemIndex = items.indexOf(item);
  if (itemIndex === -1) return;
  items.splice(itemIndex, 1);

  switch (item) {
    case 'magnifier':
      const nextShell = game.shells[game.currentShell];
      game.log.push(`Player ${playerIndex + 1} used Magnifier: Next shell is ${nextShell}`);
      break;
    case 'beer':
      game.shells.splice(game.currentShell, 1);
      game.log.push(`Player ${playerIndex + 1} used Beer: Shell ejected`);
      break;
    case 'handcuffs':
      game.handcuffed = true;
      game.log.push(`Player ${playerIndex + 1} used Handcuffs: Next turn skipped`);
      break;
    case 'saw':
      game.sawed = true;
      game.log.push(`Player ${playerIndex + 1} used Saw: Next shot deals double damage`);
      break;
    case 'cigarettes':
      game.hp[playerIndex] = Math.min(6, game.hp[playerIndex] + 1);
      game.log.push(`Player ${playerIndex + 1} used Cigarettes: HP +1`);
      break;
  }
  io.to(roomId).emit('updateGame', game);
}

function checkGameEnd(roomId) {
  const room = rooms.get(roomId);
  const game = room.gameState;
  if (game.hp[0] <= 0) {
    io.to(roomId).emit('gameEnd', 1); // player 2 wins
  } else if (game.hp[1] <= 0) {
    io.to(roomId).emit('gameEnd', 0); // player 1 wins
  } else if (game.currentShell >= game.shells.length) {
    // Next round
    game.round++;
    const minShells = 2 + (game.round - 1) * 2;
    const maxShells = minShells + 2;
    const numShells = Math.floor(Math.random() * (maxShells - minShells + 1)) + minShells;
    game.shells = [];
    for (let i = 0; i < numShells; i++) {
      game.shells.push(Math.random() < 0.5 ? 'live' : 'blank');
    }
    game.currentShell = 0;
    game.log.push(`Round ${game.round} starts with ${numShells} shells`);
    // Give items randomly
    for (let p = 0; p < 2; p++) {
      const item = ['magnifier', 'beer', 'handcuffs', 'saw', 'cigarettes'][Math.floor(Math.random() * 5)];
      game.items[p].push(item);
    }
  }
}

server.listen(3001, () => {
  console.log('Server listening on port 3001');
});