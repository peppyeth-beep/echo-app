'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Copy, ShieldAlert, Lock, UserPlus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../hooks/useSocket';

type Message = { id: string; sender: 'me' | 'them' | 'sys'; text?: string; image?: string; time: string };
type Step = 'home' | 'waiting' | 'chat' | 'end';

export default function GhostChat() {
  const socket = useSocket();
  const [step, setStep] = useState<Step>('home');
  const [roomCode, setRoomCode] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // --- SOCKET LOGIC ---
  useEffect(() => {
    if (!socket) return;
    socket.connect();

    socket.on('room_created', (code) => {
      setRoomCode(code);
      setStep('waiting');
    });

    socket.on('start_chat', () => {
      setStep('chat');
      setMessages([{ id: '0', sender: 'sys', time: getTime(), text: 'Connection Secured. History is off.' }]);
    });

    socket.on('receive_message', (data) => {
      setMessages((prev) => [...prev, { id: Date.now().toString(), sender: 'them', ...data, time: getTime() }]);
    });

    socket.on('partner_left', () => {
      setStep('end');
      socket.disconnect(); // Force disconnect to ensure security
    });

    socket.on('error', (msg) => {
      setError(msg);
      setTimeout(() => setError(''), 3000);
    });

    return () => { socket.offAny(); };
  }, [socket]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // --- ACTIONS ---
  const createRoom = () => socket?.emit('create_room');

  const joinRoom = () => {
    if (joinInput.length !== 6) return setError('Code must be 6 digits');
    socket?.emit('join_room', joinInput);
  };

  const sendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !socket) return;
    socket.emit('send_message', { text: input });
    setMessages((prev) => [...prev, { id: Date.now().toString(), sender: 'me', text: input, time: getTime() }]);
    setInput('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket) return;
    if (file.size > 2 * 1024 * 1024) return alert("Max 2MB");

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      socket.emit('send_message', { image: base64 });
      setMessages((prev) => [...prev, { id: Date.now().toString(), sender: 'me', image: base64, time: getTime() }]);
    };
    reader.readAsDataURL(file);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    alert('Code copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono flex justify-center items-center p-4">
      <div className="w-full max-w-md h-[90vh] bg-zinc-950 border border-green-900 rounded-lg shadow-[0_0_20px_rgba(0,255,0,0.1)] flex flex-col overflow-hidden relative">

        {/* Header */}
        <div className="p-4 border-b border-green-900 flex justify-between items-center bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <ShieldAlert size={20} />
            <span className="font-bold tracking-widest">GHOST_PROTOCOL</span>
          </div>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>

        <AnimatePresence mode="wait">

          {/* 1. HOME SCREEN */}
          {step === 'home' && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col p-6 justify-center gap-6">
              <div className="text-center mb-8">
                <Lock size={64} className="mx-auto mb-4 text-green-700" />
                <h1 className="text-2xl font-bold mb-2">Encrypted Channel</h1>
                <p className="text-green-800 text-sm">No Logs. No History. RAM Only.</p>
              </div>

              <button onClick={createRoom} className="w-full py-4 border border-green-500 hover:bg-green-900/20 text-green-400 font-bold rounded flex items-center justify-center gap-3 transition-all">
                <UserPlus size={20} /> CREATE SECURE ROOM
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-green-900"></div></div>
                <div className="relative flex justify-center"><span className="bg-zinc-950 px-2 text-green-800 text-sm">OR JOIN</span></div>
              </div>

              <div className="flex gap-2">
                <input
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="ENTER 6-DIGIT CODE"
                  className="flex-1 bg-black border border-green-800 p-4 text-center text-lg tracking-[0.5em] focus:border-green-500 outline-none placeholder:tracking-normal"
                />
                <button onClick={joinRoom} className="px-6 bg-green-800 text-black font-bold hover:bg-green-600 transition-colors">→</button>
              </div>

              {error && <p className="text-red-500 text-center text-sm mt-2 font-bold animate-pulse">{error}</p>}
            </motion.div>
          )}

          {/* 2. WAITING FOR FRIEND */}
          {step === 'waiting' && (
            <motion.div key="waiting" initial={{ x: 100 }} animate={{ x: 0 }} exit={{ x: -100 }} className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <h2 className="text-sm text-green-700 mb-4">WAITING FOR TARGET...</h2>

              <div onClick={copyCode} className="bg-green-900/10 border-2 border-dashed border-green-500 p-8 rounded-xl cursor-pointer hover:bg-green-900/20 transition-all group">
                <h1 className="text-5xl font-bold tracking-widest select-all">{roomCode}</h1>
                <div className="flex items-center justify-center gap-2 mt-4 text-green-600 group-hover:text-green-400">
                  <Copy size={16} /> <span>CLICK TO COPY</span>
                </div>
              </div>

              <p className="mt-8 text-xs text-green-800 max-w-[200px]">
                Share this code securely. Room locks automatically after connection.
              </p>
            </motion.div>
          )}

          {/* 3. CHAT ROOM */}
          {step === 'chat' && (
            <motion.div key="chat" className="flex-1 flex flex-col h-full bg-black/50">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : msg.sender === 'sys' ? 'justify-center' : 'justify-start'}`}>
                    {msg.sender === 'sys' ? (
                      <span className="text-[10px] text-green-900 border border-green-900 px-2 py-1">{msg.text}</span>
                    ) : (
                      <div className={`max-w-[80%] break-words ${msg.sender === 'me' ? 'text-right' : 'text-left'}`}>
                        {msg.text && (
                          <div className={`p-3 rounded-none border ${msg.sender === 'me' ? 'border-green-500 bg-green-900/10' : 'border-zinc-800 bg-zinc-900/50'}`}>
                            {msg.text}
                          </div>
                        )}
                        {msg.image && <img src={msg.image} className="max-w-[200px] border border-green-900 opacity-80 hover:opacity-100" />}
                        <span className="text-[10px] text-green-900 block mt-1">{msg.time}</span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <form onSubmit={sendMessage} className="p-3 bg-zinc-900/30 border-t border-green-900 flex gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-green-800 hover:text-green-500"><ImageIcon size={20} /></button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="ENCRYPTED MESSAGE..." className="flex-1 bg-transparent outline-none text-green-500 placeholder:text-green-900" />
                <button type="submit" disabled={!input.trim()} className="text-green-500 hover:text-green-400 disabled:opacity-30"><Send size={20} /></button>
              </form>
            </motion.div>
          )}

          {/* 4. SESSION DESTROYED */}
          {step === 'end' && (
            <motion.div key="end" className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-red-950/20">
              <ShieldAlert size={64} className="text-red-600 mb-6 animate-pulse" />
              <h2 className="text-3xl font-bold text-red-500 mb-2">CONNECTION SEVERED</h2>
              <p className="text-red-800 mb-8">Room deleted. Logs wiped. No evidence remains.</p>
              <button onClick={() => window.location.reload()} className="px-8 py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors">
                INITIATE NEW SESSION
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}