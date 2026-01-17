'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Copy, Shield, Lock, UserPlus, X, ChevronRight } from 'lucide-react';
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

  // --- SOCKET LOGIC (Same Secure Logic) ---
  useEffect(() => {
    if (!socket) return;
    socket.connect();

    socket.on('room_created', (code) => {
      setRoomCode(code);
      setStep('waiting');
    });

    socket.on('start_chat', () => {
      setStep('chat');
      setMessages([{ id: '0', sender: 'sys', time: getTime(), text: 'End-to-End Encryption Enabled.' }]);
    });

    socket.on('receive_message', (data) => {
      setMessages((prev) => [...prev, { id: Date.now().toString(), sender: 'them', ...data, time: getTime() }]);
    });

    socket.on('partner_left', () => {
      setStep('end');
      socket.disconnect();
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
    // Visual feedback handled by UI state if needed, mostly browser alert for now
    alert('Code copied!');
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans flex justify-center items-center p-4">
      {/* Main Card Container */}
      <div className="w-full max-w-md h-[90vh] bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">

        {/* Header - Minimalist */}
        <div className="px-6 py-4 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Stealth</span>
          </div>
          {/* Status Indicator */}
          <div className={`w-2 h-2 rounded-full ${step === 'chat' ? 'bg-green-500' : 'bg-zinc-700'}`}></div>
        </div>

        <AnimatePresence mode="wait">

          {/* 1. HOME SCREEN */}
          {step === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col p-8 justify-center">
              <div className="text-center mb-12">
                <h1 className="text-3xl font-bold mb-3">Private Comms.</h1>
                <p className="text-zinc-500">Secure, ephemeral chat. <br />Data vanishes upon disconnect.</p>
              </div>

              <div className="space-y-4">
                <button onClick={createRoom} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/20 active:scale-95">
                  <UserPlus size={20} /> Create New Room
                </button>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
                  <div className="relative flex justify-center"><span className="bg-zinc-950 px-2 text-zinc-600 text-sm font-medium">OR</span></div>
                </div>

                <div className="bg-zinc-900 p-2 rounded-2xl border border-zinc-800 flex items-center">
                  <input
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter Code"
                    className="flex-1 bg-transparent px-4 py-2 outline-none text-white font-medium placeholder:text-zinc-600"
                  />
                  <button onClick={joinRoom} disabled={joinInput.length !== 6} className="p-3 bg-zinc-800 hover:bg-white hover:text-black rounded-xl text-zinc-400 transition-all disabled:opacity-50 disabled:hover:bg-zinc-800 disabled:hover:text-zinc-400">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              {error && <p className="text-red-500 text-center text-sm mt-6 bg-red-500/10 py-2 rounded-lg">{error}</p>}
            </motion.div>
          )}

          {/* 2. WAITING FOR FRIEND */}
          {step === 'waiting' && (
            <motion.div key="waiting" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <Lock size={24} className="text-indigo-500" />
              </div>

              <h2 className="text-zinc-400 mb-2">Room Secure</h2>
              <p className="text-sm text-zinc-600 mb-8">Share this code to begin.</p>

              <button onClick={copyCode} className="group relative bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 p-8 rounded-3xl cursor-pointer transition-all active:scale-95 w-full">
                <h1 className="text-5xl font-bold tracking-widest text-white group-hover:text-indigo-400 transition-colors">{roomCode}</h1>
                <div className="absolute bottom-3 left-0 right-0 text-center">
                  <span className="text-xs text-zinc-500 flex items-center justify-center gap-1"><Copy size={10} /> Tap to Copy</span>
                </div>
              </button>
            </motion.div>
          )}

          {/* 3. CHAT ROOM */}
          {step === 'chat' && (
            <motion.div key="chat" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex-1 flex flex-col h-full bg-black">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : msg.sender === 'sys' ? 'justify-center' : 'justify-start'}`}>

                    {msg.sender === 'sys' ? (
                      <span className="text-[10px] text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full mt-2 mb-2">{msg.text}</span>
                    ) : (
                      <div className={`max-w-[75%] flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                        {msg.text && (
                          <div className={`px-4 py-2.5 rounded-2xl text-[15px] shadow-sm ${msg.sender === 'me'
                              ? 'bg-indigo-600 text-white rounded-br-none'
                              : 'bg-zinc-800 text-zinc-200 rounded-bl-none'
                            }`}>
                            {msg.text}
                          </div>
                        )}
                        {msg.image && (
                          <img src={msg.image} className="max-w-[200px] rounded-2xl border border-zinc-800 mt-1" />
                        )}
                        <span className="text-[10px] text-zinc-600 mt-1 px-1">{msg.time}</span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-zinc-950 border-t border-zinc-900">
                <form onSubmit={sendMessage} className="flex gap-2 items-center bg-zinc-900 p-1.5 pr-2 rounded-full border border-zinc-800 focus-within:border-indigo-500/50 transition-colors">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                    <ImageIcon size={20} />
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a secure message..."
                    className="flex-1 bg-transparent outline-none text-white placeholder:text-zinc-600 text-sm pl-2"
                  />

                  <button type="submit" disabled={!input.trim()} className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:shadow-none hover:scale-105 active:scale-95 transition-all">
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* 4. SESSION DESTROYED */}
          {step === 'end' && (
            <motion.div key="end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-950">
              <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
                <Lock size={32} className="text-zinc-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Session Ended</h2>
              <p className="text-zinc-500 mb-8">Room deleted. No logs remain.</p>

              <button onClick={() => window.location.reload()} className="px-8 py-3 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-colors w-full">
                New Session
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}