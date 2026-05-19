/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import { LogIn, ShieldAlert } from 'lucide-react';

interface LoginProps {
  onLogin: (id: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth', { id, password });
      if (res.data.success) {
        onLogin(id);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败，请检查 ID 或密码。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E4E3E0] font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-[#141414] text-white">
            <LogIn size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight uppercase">Snow Race Royale</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-mono uppercase opacity-50 mb-1">Login ID</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full p-3 border border-[#141414] bg-transparent focus:outline-none focus:bg-[#141414] focus:text-white transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase opacity-50 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-[#141414] bg-transparent focus:outline-none focus:bg-[#141414] focus:text-white transition-colors"
              required
            />
          </div>

          {error && (
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="p-3 bg-red-100 border border-red-500 text-red-700 text-sm flex items-center gap-2"
            >
              <ShieldAlert size={16} />
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full p-3 bg-[#141414] text-white uppercase font-bold tracking-widest hover:bg-opacity-90 disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? 'Authenticating...' : 'Enter Game'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[#141414] border-dashed">
          <p className="text-xs text-center text-[#141414] opacity-70 italic font-serif">
            Note: If you don't have an ID, please contact the administrator to create one.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
