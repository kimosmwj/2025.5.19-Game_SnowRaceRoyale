/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { Layers, Plus, Link as LinkIcon, User } from 'lucide-react';

interface LobbyProps {
  userId: string;
  onStartGame: (roomId: string, isHost: boolean) => void;
  onLogout: () => void;
}

export default function Lobby({ userId, onStartGame, onLogout }: LobbyProps) {
  const [roomCode, setRoomCode] = useState('');

  const handleHost = () => {
    // Generate a random 6-character room code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    onStartGame(code, true);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim()) {
      onStartGame(roomCode.trim().toUpperCase(), false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E4E3E0] font-sans p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-white border-2 border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] overflow-hidden"
      >
        <div className="bg-[#141414] text-white p-6 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <Layers className="text-[#4cc9f0]" />
                <h1 className="text-xl font-bold uppercase tracking-widest">Game Lobby</h1>
            </div>
            <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-2 opacity-70">
                    <User size={14} /> {userId}
                </span>
                <button onClick={onLogout} className="underline hover:text-[#4cc9f0]">Sign Out</button>
            </div>
        </div>

        <div className="grid md:grid-cols-2 divide-x-2 divide-[#141414]">
            {/* Host Section */}
            <div className="p-8 space-y-6">
                <div className="space-y-2">
                    <h2 className="text-2xl font-black uppercase">Create Game</h2>
                    <p className="text-xs opacity-60">Host a new match and share the connection code with a friend.</p>
                </div>
                <button 
                    onClick={handleHost}
                    className="w-full group flex items-center justify-between p-6 bg-[#4cc9f0] border-2 border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] hover:translate-y-[-2px] hover:translate-x-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] transition-all cursor-pointer"
                >
                    <span className="text-xl font-bold uppercase text-[#141414]">Host Mode</span>
                    <Plus className="text-[#141414]" />
                </button>
                <div className="p-4 bg-gray-50 border border-dashed border-[#141414] text-[10px] uppercase tracking-wider opacity-50">
                    Host status: Become Player 1
                </div>
            </div>

            {/* Join Section */}
            <div className="p-8 space-y-6 bg-gray-50/50">
                <div className="space-y-2">
                    <h2 className="text-2xl font-black uppercase">Join Game</h2>
                    <p className="text-xs opacity-60">Enter a P2P host code to connect to an existing session.</p>
                </div>
                <form onSubmit={handleJoin} className="space-y-4">
                    <input 
                        type="text" 
                        placeholder="PASTE CODE HERE"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value)}
                        className="w-full p-4 border-2 border-[#141414] text-center text-xl font-bold placeholder:opacity-30 focus:outline-none focus:bg-[#141414] focus:text-white transition-colors"
                    />
                    <button 
                        type="submit"
                        className="w-full group flex items-center justify-between p-6 bg-[#f9c74f] border-2 border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] hover:translate-y-[-2px] hover:translate-x-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] transition-all cursor-pointer"
                    >
                        <span className="text-xl font-bold uppercase text-[#141414]">Client Mode</span>
                        <LinkIcon className="text-[#141414]" />
                    </button>
                </form>
                <div className="p-4 bg-white border border-dashed border-[#141414] text-[10px] uppercase tracking-wider opacity-50">
                    Client status: Become Player 2
                </div>
            </div>
        </div>
      </motion.div>
    </div>
  );
}
