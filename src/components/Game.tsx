/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { audio } from '../lib/audio';
import { Trophy, Timer, User, Link as LinkIcon } from 'lucide-react';

interface GameProps {
  userId: string;
  roomId: string; 
  isHost: boolean;
  onExit: () => void;
}

export default function Game({ userId, roomId, isHost, onExit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Use REFS for game state to avoid stale closures in requestAnimationFrame
  const DEFAULT_PLATFORMS = [
    { x: 0, y: 550, w: 800, h: 50 }, // Ground
    { x: 100, y: 450, w: 200, h: 20 },
    { x: 500, y: 450, w: 200, h: 20 },
    { x: 300, y: 350, w: 200, h: 20 },
    { x: 100, y: 250, w: 200, h: 20 },
    { x: 500, y: 250, w: 200, h: 20 },
    { x: 300, y: 150, w: 200, h: 20 }
  ];

  const gameStateRef = useRef<any>(null);
  const platformsRef = useRef<any[]>(DEFAULT_PLATFORMS);
  const particlesRef = useRef<any[]>([]);
  const scorePopupsRef = useRef<any[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [syncing, setSyncing] = useState(true);

  const playerRef = useRef({
    x: isHost ? 200 : 600,
    y: 500,
    vx: 0,
    vy: 0,
    width: 30,
    height: 30,
    onGround: false
  });

  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const s = io();
    setSocket(s);
    socketRef.current = s;

    const onConnect = () => {
      s.emit('player:join', { name: userId, roomId, isHost });
      // Audio needs user interaction, will init on first key/click
    };

    if (s.connected) onConnect();
    else s.on('connect', onConnect);

    s.on('init', (data) => {
      platformsRef.current = data.platforms;
    });

    s.on('game:reset', () => {
        setIsGameOver(false);
    });

    s.on('game:state', (state) => {
      gameStateRef.current = state;
      setSyncing(!state.gameActive);
      
      const newScores: any = {};
      Object.values(state.players).forEach((p: any) => {
        newScores[p.name] = p.score;
      });
      setScores(newScores);
    });

    s.on('item:collected', ({ playerId, item }) => {
      if (item.type === 'BOMB') {
        audio.playExplosion();
        createParticles(item.x, item.y, '#ff4444', 30, true);
        addScorePopup(item.x, item.y, '-50', '#ff4444');
      } else {
        audio.playCollect();
        createParticles(item.x, item.y, item.color, 15, false);
        addScorePopup(item.x, item.y, `+${item.score}`, '#44ff44');
      }
    });

    s.on('game:ended', () => {
      setIsGameOver(true);
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      try { audio.init(); } catch (err) { console.error(err); }
      
      const code = e.code;
      const key = e.key.toLowerCase();
      keys.current[code] = true;
      keys.current[key] = true;
      if (key === ' ') keys.current['Space'] = true;
      if (key === 'w') keys.current['ArrowUp'] = true;
      if (key === 'a') keys.current['ArrowLeft'] = true;
      if (key === 's') keys.current['ArrowDown'] = true;
      if (key === 'd') keys.current['ArrowRight'] = true;
      
      // Prevent scrolling with arrows/space
      if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', ' ', 'w', 'a', 's', 'd'].includes(key) || 
         ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      const key = e.key.toLowerCase();
      keys.current[code] = false;
      keys.current[key] = false;
      if (key === ' ') keys.current['Space'] = false;
      if (key === 'w') keys.current['ArrowUp'] = false;
      if (key === 'a') keys.current['ArrowLeft'] = false;
      if (key === 's') keys.current['ArrowDown'] = false;
      if (key === 'd') keys.current['ArrowRight'] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Auto-focus canvas on mount
    setTimeout(() => {
      if (canvasRef.current) canvasRef.current.focus();
    }, 500);

    let frameId: number;
    const loop = () => {
      try {
        updatePlayer();
        draw();
      } catch (err) {
        console.error("Game loop error:", err);
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    console.log("Game loop started");

    return () => {
      s.disconnect();
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const addScorePopup = (x: number, y: number, text: string, color: string) => {
    scorePopupsRef.current.push({ x, y, text, color, life: 1.0 });
  };

  const createParticles = (x: number, y: number, color: string, count: number, isExplosion: boolean) => {
    const newParticles = [];
    for (let i = 0; i < count; i++) {
        newParticles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * (isExplosion ? 15 : 6),
          vy: (Math.random() - 0.5) * (isExplosion ? 15 : 6),
          life: 1.0,
          color,
          size: Math.random() * 4 + 2,
          isRing: isExplosion && Math.random() > 0.3
        });
    }
    particlesRef.current = [...particlesRef.current, ...newParticles].slice(-150);
  };

  const updatePlayer = () => {
    const p = playerRef.current;
    
    // Movement
    const k = keys.current;
    if (k['ArrowLeft'] || k['KeyA'] || k['a']) p.vx = -4.5;
    else if (k['ArrowRight'] || k['KeyD'] || k['d']) p.vx = 4.5;
    else p.vx *= 0.85;

    p.x += p.vx;

    const jumpPressed = k['Space'] || k[' '] || k['ArrowUp'] || k['KeyW'] || k['w'];
    if (jumpPressed && p.onGround) {
      p.vy = -10.5;
      p.onGround = false;
      audio.playJump();
      audio.playMusic(); // Ensure music starts
    }

    p.vy += 0.5;
    p.y += p.vy;

    // Collisions
    p.onGround = false;
    for (const plat of platformsRef.current) {
      if (p.x + p.width > plat.x && p.x < plat.x + plat.w &&
          p.y + p.height > plat.y && p.y + p.height < plat.y + plat.h &&
          p.vy >= 0) {
        p.y = plat.y - p.height;
        p.vy = 0;
        p.onGround = true;
      }
    }

    if (p.x < 0) p.x = 800;
    if (p.x > 800) p.x = 0;
    if (p.y > 800) {
      p.x = isHost ? 200 : 600;
      p.y = 500;
      p.vy = 0;
      p.vx = 0;
    }

    // Syncing and Collecting
    const state = gameStateRef.current;
    const s = socketRef.current;
    if (state && s && state.gameActive) {
      // Force sync position if server significantly differs (e.g. game reset)
      const serverSelf = state.players[s.id];
      if (serverSelf) {
        const dist = Math.hypot(p.x - serverSelf.x, p.y - serverSelf.y);
        if (dist > 100) {
           p.x = serverSelf.x;
           p.y = serverSelf.y;
           p.vx = 0;
           p.vy = 0;
        }
      }

      for (const item of state.items) {
        const dx = (p.x + p.width/2) - item.x;
        const dy = (p.y + p.height/2) - item.y;
        // Increase collection radius slightly for better feel
        if (Math.hypot(dx, dy) < 28) {
          s.emit('player:collect', { roomId, itemId: item.id });
        }
      }
      s.emit('player:move', { roomId, x: p.x, y: p.y, onGround: p.onGround });
    }

    // Particles & Popups
    particlesRef.current = particlesRef.current.map(pt => ({
      ...pt,
      x: pt.x + pt.vx,
      y: pt.y + pt.vy,
      life: pt.life - 0.02
    })).filter(pt => pt.life > 0);

    scorePopupsRef.current = scorePopupsRef.current.map(sp => ({
        ...sp,
        y: sp.y - 1,
        life: sp.life - 0.02
    })).filter(sp => sp.life > 0);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = gameStateRef.current;
    const s = socketRef.current;

    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, 800, 600);

    ctx.fillStyle = '#222';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    platformsRef.current.forEach(p => {
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    });

    // Draw Items (Food/Bombs)
    if (state && state.items) {
      state.items.forEach((item: any) => {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = item.color;
        
        if (item.type === 'BOMB') {
            // Draw Bomb
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
            ctx.fill();
            // Spikes
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 2;
            for(let i=0; i<8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(item.x, item.y);
                ctx.lineTo(item.x + Math.cos(angle) * 18, item.y + Math.sin(angle) * 18);
                ctx.stroke();
            }
        } else {
            // Draw Food (Orb)
            const pulse = Math.sin(Date.now() / 200) * 2;
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(item.x, item.y, item.radius + pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();
      });
    }

    // Draw Other Players
    if (state && state.players && s) {
      const myId = s.id;
      Object.keys(state.players).forEach(id => {
        if (id === myId) return;
        const p = state.players[id];
        if (p) drawCharacter(ctx, p.x, p.y, p.isPlayer1, false, p.name);
      });
    }

    // Draw Self (Local Prediction)
    const me = playerRef.current;
    // Determine character type from props if server state isn't available yet
    let myIsP1 = isHost;
    if (state && s && state.players[s.id]) {
      myIsP1 = state.players[s.id].isPlayer1;
    }
    
    drawCharacter(ctx, me.x, me.y, myIsP1, true, userId);

    particlesRef.current.forEach(pt => {
      ctx.globalAlpha = pt.life;
      if (pt.isRing) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (1 - pt.life) * 40, 0, Math.PI * 2);
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      }
    });

    scorePopupsRef.current.forEach(sp => {
        ctx.globalAlpha = sp.life;
        ctx.fillStyle = sp.color;
        ctx.font = 'bold 16px monospace';
        ctx.fillText(sp.text, sp.x - 10, sp.y);
    });

    ctx.globalAlpha = 1;
  };

  const drawCharacter = (ctx: CanvasRenderingContext2D, x: number, y: number, isP1: boolean, isSelf: boolean, name: string) => {
    // Name tag
    ctx.fillStyle = isSelf ? '#fff' : 'rgba(255,255,255,0.7)';
    ctx.font = isSelf ? 'bold 12px monospace' : '10px monospace';
    ctx.textAlign = 'center';
    const label = isSelf ? `${name} (YOU)` : name;
    ctx.fillText(label, x + 15, y - 10);

    ctx.save();
    if (isP1) {
      // P1: Blue Square Robot
      ctx.fillStyle = isSelf ? '#4cc9f0' : '#4361ee';
      ctx.fillRect(x, y, 30, 30);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, 30, 30);
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 5, y + 8, 8, 8);
      ctx.fillRect(x + 17, y + 8, 8, 8);
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 8, y + 10, 3, 3);
      ctx.fillRect(x + 20, y + 10, 3, 3);
    } else {
      // P2: Yellow Round Alien
      ctx.beginPath();
      ctx.arc(x + 15, y + 15, 15, 0, Math.PI * 2);
      ctx.fillStyle = isSelf ? '#f9c74f' : '#f8961e';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Eye
      ctx.beginPath();
      ctx.arc(x + 15, y + 12, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 15, y + 12, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
    }
    ctx.restore();
    ctx.textAlign = 'start';
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const state = gameStateRef.current;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white p-4 font-mono">
      <div className="w-full max-w-[800px] flex justify-between items-center mb-4 bg-[#141414] p-4 border-l-4 border-[#4cc9f0] shadow-lg">
        <div className="flex gap-12">
            <div className="flex flex-col">
            <div className="flex items-center gap-2 text-[10px] opacity-40 uppercase tracking-widest">
                <Timer size={12} /> Time
            </div>
            <div className="text-3xl font-black text-[#4cc9f0] tabular-nums">
                {state ? formatTime(state.timer) : '5:00'}
            </div>
            </div>
            
            <div className="flex gap-8">
                {Object.entries(scores).map(([name, score], i) => (
                    <div key={name} className="flex flex-col">
                        <div className="flex items-center gap-2 text-[10px] opacity-40 uppercase tracking-widest">
                            <User size={12} /> {name}
                        </div>
                        <div className={`text-2xl font-black ${i === 0 ? 'text-[#4cc9f0]' : 'text-[#f9c74f]'}`}>
                            {score}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="flex gap-4 items-center">
            <div className="flex flex-col items-center bg-black/20 p-2 border border-white/5">
                <span className="text-[8px] opacity-40 uppercase">P2P Host Code</span>
                <div className="flex items-center gap-2">
                    <span className="font-black text-white text-lg tracking-widest">{roomId}</span>
                    <button 
                        onClick={copyCode}
                        className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                        title="Copy Code"
                    >
                        {copied ? <span className="text-[8px] text-green-400">COPIED</span> : <LinkIcon size={12} />}
                    </button>
                </div>
            </div>
            <button 
                onClick={onExit}
                className="px-4 py-2 bg-transparent border border-white/20 text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-all cursor-pointer font-bold"
            >
                Quit
            </button>
        </div>
      </div>

      <div 
        className="relative border-8 border-[#141414] shadow-[0_0_50px_rgba(0,0,0,0.5)] cursor-pointer"
        onClick={() => {
            const canvas = canvasRef.current;
            if (canvas) canvas.focus();
        }}
      >
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={600} 
          className="bg-[#0f0f0f] outline-none"
          tabIndex={0}
          autoFocus
          onKeyDown={(e: any) => {
            // Fallback for some iframe environments
            try { audio.init(); } catch (err) {}
          }}
        />
        
        {isGameOver && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
            <Trophy className="text-yellow-400 mb-6 drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]" size={80} />
            <h2 className="text-6xl font-black uppercase mb-4 tracking-tighter">Match Result</h2>
            <div className="space-y-3 mb-12 w-full max-w-sm">
                {Object.entries(scores)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([name, score], i) => (
                    <div key={name} className={`flex justify-between items-center px-6 py-4 ${i === 0 ? 'bg-yellow-400 text-black font-black' : 'bg-white/10 border border-white/20'}`}>
                        <span className="uppercase tracking-widest">{i + 1}. {name}</span>
                        <span className="text-2xl">{score}</span>
                    </div>
                ))}
            </div>
            <div className="flex gap-4">
                <button 
                    onClick={() => window.location.reload()}
                    className="px-10 py-4 bg-[#4cc9f0] text-black font-black uppercase tracking-widest hover:scale-105 transition-transform cursor-pointer"
                >
                    Rematch
                </button>
                <button 
                    onClick={onExit}
                    className="px-10 py-4 border border-white font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all cursor-pointer"
                >
                    Main Menu
                </button>
            </div>
          </div>
        )}

        {syncing && !isGameOver && (
            <div 
                className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-[2px] cursor-pointer"
                onClick={() => {
                    if (canvasRef.current) canvasRef.current.focus();
                }}
            >
                <div className="text-4xl font-black uppercase tracking-[0.4em] mb-4 text-[#4cc9f0]">Click to Start</div>
                <div className="text-[12px] opacity-80 uppercase tracking-[0.2em] animate-pulse">Wait for connection...</div>
                <div className="mt-8 grid grid-cols-3 gap-2 opacity-40">
                    <div className="border border-white p-2 text-center text-[10px]">W</div>
                    <div className="border border-white p-2 text-center text-[10px]">A</div>
                    <div className="border border-white p-2 text-center text-[10px]">S</div>
                    <div className="border border-white p-2 text-center text-[10px]">D</div>
                </div>
            </div>
        )}
        
        <div className="absolute top-4 left-4 flex gap-4 pointer-events-none">
            <div className={`px-2 py-1 text-[10px] font-bold uppercase transition-all border-2 ${isHost ? 'bg-[#4cc9f0] border-[#4cc9f0] text-black' : 'bg-transparent border-white/20 text-white/40'}`}>
                {isHost ? 'Server Host' : 'Client Connected'}
            </div>
        </div>
      </div>

      <div className="mt-6 flex gap-12 text-[10px] opacity-30 uppercase tracking-[0.2em] font-bold">
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#4cc9f0]"></div> Player 1 (Blue)
        </div>
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#f9c74f]"></div> Player 2 / NPC (Yellow)
        </div>
        <div className="flex items-center gap-2">
            [Arrow Keys / WASD] Move & Jump
        </div>
      </div>
    </div>
  );
}
