import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  app.use(express.json());

  // --- Auth Logic ---
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1FM6pUWt414vao1ePQps_D5KeXOFeg5UcZJFU2y5ox1o/export?format=csv';
  let authData: { id: string; pass: string }[] = [];

  async function fetchAuthData() {
    try {
      const response = await axios.get(SHEET_URL);
      const rows = response.data.split(/\r?\n/).map((row: string) => row.split(','));
      // Header: NO, ID, PW
      authData = rows.slice(1).map((cols: string[]) => ({
        id: cols[1]?.trim(),
        pass: cols[2]?.trim()
      })).filter(u => u.id && u.pass);
      console.log('Auth data cached:', authData.length, 'users');
    } catch (error) {
      console.error('Error fetching auth data:', error);
    }
  }

  fetchAuthData();
  setInterval(fetchAuthData, 60000); // Refresh every minute

  app.post('/api/auth', (req, res) => {
    const { id, password } = req.body;
    const user = authData.find(u => u.id === id && u.pass === password);
    if (user) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  });

  // --- Game State Management ---
  const rooms = new Map<string, any>();
  const GAME_DURATION = 300; // 5 minutes

  const PLATFORMS = [
    { x: 0, y: 550, w: 800, h: 50 }, // Ground
    { x: 100, y: 450, w: 200, h: 20 },
    { x: 500, y: 450, w: 200, h: 20 },
    { x: 300, y: 350, w: 200, h: 20 },
    { x: 100, y: 250, w: 200, h: 20 },
    { x: 500, y: 250, w: 200, h: 20 },
    { x: 300, y: 150, w: 200, h: 20 }
  ];

  const ITEM_TYPES = [
    { type: 'RED_FOOD', score: 10, color: '#ff4444' },
    { type: 'YELLOW_FOOD', score: 20, color: '#ffff44' },
    { type: 'GREEN_DIAMOND', score: 50, color: '#44ff44' },
    { type: 'BOMB', score: -50, color: '#333' }
  ];

  function createRoom(roomId: string) {
    const state = {
      players: {} as any,
      items: [] as any[],
      timer: GAME_DURATION,
      gameActive: false,
      nextItemId: 0,
      platforms: PLATFORMS
    };
    rooms.set(roomId, state);
    return state;
  }

  function spawnItem(room: any) {
    if (room.items.length > 15) return;
    const type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
    const platform = room.platforms[Math.floor(Math.random() * room.platforms.length)];
    const x = platform.x + Math.random() * (platform.w - 20) + 10;
    const y = platform.y - 20;
    
    room.items.push({
      id: room.nextItemId++,
      type: type.type,
      score: type.score,
      color: type.color,
      x,
      y,
      radius: 8
    });
  }

  function resetRoomGame(room: any) {
    room.timer = GAME_DURATION;
    room.items = [];
    room.gameActive = true;
    
    Object.values(room.players).forEach((p: any) => {
      p.score = 0;
      p.vy = 0;
      p.onGround = false;
      // Host at 200, Client/NPC at 600
      if (p.id.startsWith('npc-')) {
        p.x = 600;
        p.isPlayer1 = false;
      } else {
        p.x = p.isPlayer1 ? 200 : 600;
      }
      p.y = 520; // Correct ground level for 30px height (550 - 30)
    });
  }

  // NPC Logic for a specific room
  function updateRoomNPC(room: any, roomId: string) {
    const npcId = Object.keys(room.players).find(id => id.startsWith('npc-'));
    if (!npcId) return;

    const npc = room.players[npcId];
    
    // Simplistic target finding
    const food = room.items.filter((i: any) => i.type !== 'BOMB');
    let target = null;
    if (food.length > 0) {
      target = food[0]; // Just target first food for simplicity
    }

    if (target) {
      if (npc.x < target.x - 5) npc.x += 2;
      else if (npc.x > target.x + 5) npc.x -= 2;
      
      if (target.y < npc.y - 20 && Math.random() > 0.95 && npc.onGround) {
        npc.vy = -12;
        npc.onGround = false;
      }
    }

    // NPC Collection Logic
    const items = room.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const dx = (npc.x + 15) - item.x;
      const dy = (npc.y + 15) - item.y;
      if (Math.hypot(dx, dy) < 28) {
        npc.score += item.score;
        io.to(roomId).emit('item:collected', { playerId: npc.id, item });
        items.splice(i, 1);
      }
    }

    npc.vy += 0.5;
    npc.y += npc.vy;
    
    npc.onGround = false;
    for (const p of room.platforms) {
      if (npc.x + 30 > p.x && npc.x < p.x + p.w &&
          npc.y + 30 > p.y && npc.y + 30 < p.y + p.h &&
          npc.vy >= 0) {
        npc.y = p.y - 30;
        npc.vy = 0;
        npc.onGround = true;
      }
    }

    if (npc.x < 0) npc.x = 800;
    if (npc.x > 800) npc.x = 0;
  }

  // Global Game Loops
  setInterval(() => {
    rooms.forEach((room, roomId) => {
      if (room.gameActive) {
        if (room.timer > 0) {
          room.timer -= 1/60;
        } else {
          room.gameActive = false;
          io.to(roomId).emit('game:ended', room.players);
        }

        if (room.gameActive) {
          if (Math.random() < 0.02) spawnItem(room);
          updateRoomNPC(room, roomId);
        }
      }

      io.to(roomId).emit('game:state', {
        players: room.players,
        items: room.items,
        timer: Math.max(0, Math.floor(room.timer)),
        gameActive: room.gameActive
      });
    });
  }, 1000 / 60);

  io.on('connection', (socket) => {
    socket.on('player:join', (data) => {
      const { roomId, name, isHost } = data;
      socket.join(roomId);
      
      let room = rooms.get(roomId);
      if (!room) {
        room = createRoom(roomId);
        rooms.set(roomId, room);
      }

      // 1. Add current player to the room players object FIRST
      const humanCountBefore = Object.values(room.players).filter((p: any) => !p.id.startsWith('npc-')).length;
      
      room.players[socket.id] = {
        id: socket.id,
        name: name || 'Player',
        x: isHost ? 200 : 600,
        y: 520,
        vy: 0,
        score: 0,
        isPlayer1: isHost || humanCountBefore === 0,
        onGround: false,
        roomId: roomId
      };

      // 2. Now count humans to decide NPC behavior
      const humanPlayers = Object.values(room.players).filter((p: any) => !p.id.startsWith('npc-'));
      
      if (humanPlayers.length >= 2) {
        // Human vs Human: Remove NPCs
        const npcs = Object.keys(room.players).filter(id => id.startsWith('npc-'));
        npcs.forEach(npcId => delete room.players[npcId]);
        resetRoomGame(room);
        io.to(roomId).emit('game:reset', { message: 'Competition begins! NPCs removed.' });
      } else {
        // Solo/Host: Ensure NPC is present
        const npcs = Object.keys(room.players).filter(id => id.startsWith('npc-'));
        if (npcs.length === 0) {
          const npcId = 'npc-' + Math.random().toString(36).substr(2, 5);
          room.players[npcId] = {
            id: npcId,
            name: 'NPC_COM',
            x: 600,
            y: 500,
            vy: 0,
            score: 0,
            isPlayer1: false,
            onGround: false
          };
        }
        resetRoomGame(room);
      }

      socket.emit('init', { platforms: PLATFORMS });
    });

    socket.on('player:move', (data) => {
      const { roomId } = data;
      const room = rooms.get(roomId);
      if (room && room.players[socket.id]) {
        const p = room.players[socket.id];
        p.x = data.x;
        p.y = data.y;
        p.onGround = data.onGround;
      }
    });

    socket.on('player:collect', (data) => {
      const { roomId, itemId } = data;
      const room = rooms.get(roomId);
      if (room) {
        const itemIdx = room.items.findIndex((i: any) => i.id === itemId);
        if (itemIdx !== -1) {
          const item = room.items[itemIdx];
          const p = room.players[socket.id];
          if (p) {
            p.score += item.score;
            io.to(roomId).emit('item:collected', { playerId: socket.id, item });
          }
          room.items.splice(itemIdx, 1);
        }
      }
    });

    socket.on('disconnect', () => {
      // Find room user was in
      rooms.forEach((room, roomId) => {
        if (room.players[socket.id]) {
          delete room.players[socket.id];
          const humansInRoom = Object.keys(room.players).filter(id => !id.startsWith('npc-'));
          if (humansInRoom.length === 0) {
            rooms.delete(roomId);
          }
        }
      });
    });
  });


  // --- Static & Vite ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
