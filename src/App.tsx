/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import Login from './components/Login';
import Game from './components/Game';
import Lobby from './components/Lobby';

export default function App() {
  const [user, setUser] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  if (!user) {
    return <Login onLogin={(id) => setUser(id)} />;
  }

  if (!roomId) {
    return (
      <Lobby 
        userId={user} 
        onStartGame={(id, host) => {
          setRoomId(id);
          setIsHost(host);
        }} 
        onLogout={() => setUser(null)}
      />
    );
  }

  return <Game userId={user} roomId={roomId} isHost={isHost} onExit={() => setRoomId(null)} />;
}

