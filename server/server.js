const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow connections from anywhere (Frontend)
    methods: ["GET", "POST"]
  },
  // Increase payload size to allow image uploads (Default is 1MB)
  maxHttpBufferSize: 1e7 // 10MB
});

// --- MATCHING LOGIC ---

// Separate queues for each emotion
// Structure: { 'vent': { 'Anxiety': [] }, 'listen': { 'Anxiety': [] } }
let queues = {
  vent: {},
  listen: {}
};

const addToQueue = (socketId, role, emotion) => {
  // Ensure the array exists for this specific emotion
  if (!queues[role][emotion]) {
    queues[role][emotion] = [];
  }
  // Add user to the end of the line
  queues[role][emotion].push(socketId);
  console.log(`User ${socketId} joined ${role} queue for ${emotion}`);
};

const findMatch = (socketId, role, emotion) => {
  // If I am a Ranter, I need a Listener (and vice versa)
  const targetRole = role === 'vent' ? 'listen' : 'vent';

  // Look for someone waiting in the target queue with the SAME emotion
  const targetQueue = queues[targetRole][emotion];

  if (targetQueue && targetQueue.length > 0) {
    // Found a match! Pop them from the queue
    const partnerId = targetQueue.shift();

    const roomId = `room_${socketId}_${partnerId}`;

    // Connect both users to the private room
    const mySock = io.sockets.sockets.get(socketId);
    const partnerSock = io.sockets.sockets.get(partnerId);

    if (mySock && partnerSock) {
      mySock.join(roomId);
      partnerSock.join(roomId);

      // Notify both users
      io.to(roomId).emit('match_found', { roomId });
      console.log(`Match created: ${roomId}`);
      return true;
    }
  }
  return false;
};

// --- SOCKET EVENTS ---

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // 1. Join Queue
  socket.on('join_queue', ({ role, emotion }) => {
    // Try to find a match INSTANTLY
    const matched = findMatch(socket.id, role, emotion);

    if (!matched) {
      // If no immediate match, add to queue and wait
      addToQueue(socket.id, role, emotion);
    }
  });

  // 2. Chat Message (Text OR Image)
  socket.on('send_message', (data) => {
    // data = { text: "..." } OR { image: "base64..." }

    // Find the room this user is in (excluding their own ID)
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);

    if (rooms.length > 0) {
      // Forward the exact data object to the other person in the room
      socket.to(rooms[0]).emit('receive_message', data);
    }
  });

  // 3. Typing Indicators
  socket.on('typing_start', () => {
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    if (rooms.length > 0) socket.to(rooms[0]).emit('partner_typing', true);
  });

  socket.on('typing_stop', () => {
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    if (rooms.length > 0) socket.to(rooms[0]).emit('partner_typing', false);
  });

  // 4. Disconnect
  socket.on('disconnect', () => {
    console.log(`User Disconnected: ${socket.id}`);

    // Notify partner if they were in a chat
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    if (rooms.length > 0) {
      socket.to(rooms[0]).emit('partner_disconnected');
    }

    // Note: In a full production app, you should also remove the user
    // from the `queues` object if they disconnect while waiting.
    // For this MVP, it's fine (matchmaking will just fail silently if matched with a ghost).
  });
});

// Use Cloud Port OR Local 4000
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`SERVER RUNNING ON PORT ${PORT}`);
});