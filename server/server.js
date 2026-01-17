const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e7 // 10MB for images
});

// --- STATE MANAGEMENT (RAM ONLY) ---
// We store rooms here. If server restarts, ALL data is lost (Good for privacy).
// Format: { '123456': { users: [socketId1, socketId2], locked: false } }
let activeRooms = {};

// Helper: Generate 6-digit random code
const generateRoomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // 1. CREATE A PRIVATE ROOM
  socket.on('create_room', () => {
    const roomCode = generateRoomCode();

    // Create the room in RAM
    activeRooms[roomCode] = { users: [socket.id], locked: false };

    socket.join(roomCode);
    socket.emit('room_created', roomCode);
    console.log(`Room ${roomCode} created by ${socket.id}`);
  });

  // 2. JOIN A PRIVATE ROOM
  socket.on('join_room', (roomCode) => {
    const room = activeRooms[roomCode];

    // Security Checks
    if (!room) {
      socket.emit('error', 'Invalid Code. Room does not exist.');
      return;
    }
    if (room.locked || room.users.length >= 2) {
      socket.emit('error', 'Room is full or locked.');
      return;
    }

    // Join logic
    room.users.push(socket.id);
    socket.join(roomCode);

    // Lock the room so no one else can enter (Spy Mode)
    room.locked = true;

    // Notify both users
    io.to(roomCode).emit('start_chat');
    console.log(`User ${socket.id} joined room ${roomCode}`);
  });

  // 3. SECURE MESSAGING
  socket.on('send_message', (data) => {
    // Only send to the specific room the user is in
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    if (rooms.length > 0) {
      const roomCode = rooms[0];
      socket.to(roomCode).emit('receive_message', data);
    }
  });

  // 4. DISCONNECT & NUKE DATA
  socket.on('disconnecting', () => {
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);

    for (const roomCode of rooms) {
      if (activeRooms[roomCode]) {
        // Notify the other person
        socket.to(roomCode).emit('partner_left');

        // DESTROY THE ROOM IMMEDIATELY
        // This ensures data is deleted from RAM instantly
        delete activeRooms[roomCode];
        console.log(`Room ${roomCode} destroyed.`);
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`SECURE SERVER RUNNING ON PORT ${PORT}`);
});