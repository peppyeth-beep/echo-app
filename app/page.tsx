'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft, Image as ImageIcon, Smile, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { useSocket } from '../hooks/useSocket';

type Message = { 
  id: string; 
  sender: 'me' | 'them' | 'sys'; 
  text?: string; 
  image?: string; // New field for images
  time: string 
};
type Step = 'landing' | 'role' | 'emotion' | 'matching' | 'chat' | 'end';

export default function EchoApp() {
  const socket = useSocket();
  const [step, setStep] = useState<Step>('landing');
  const [role, setRole] = useState<'vent' | 'listen' | null>(null);
  const [emotion, setEmotion] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // --- SOCKET LOGIC ---
  useEffect(() => {
    if (!socket) return;
    socket.connect();

    socket.on('match_found', () => {
      setStep('chat');
      setMessages([{ id: '0', sender: 'sys', time: getTime(), text: 'Connected. This space is safe.' }]);
    });

    // Handle Text & Images
    socket.on('receive_message', (data: { text?: string, image?: string }) => {
      setMessages((prev) => [...prev, { 
        id: Date.now().toString(), 
        sender: 'them', 
        text: data.text, 
        image: data.image,
        time: getTime() 
      }]);
      setPartnerTyping(false);
    });

    socket.on('partner_typing', (status) => setPartnerTyping(status));
    
    socket.on('partner_disconnected', () => {
      setMessages((prev) => [...prev, { id: Date.now().toString(), sender: 'sys', text: 'Partner disconnected.', time: getTime() }]);
    });

    return () => { socket.offAny(); };
  }, [socket]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, partnerTyping, showEmoji]);

  // --- HANDLERS ---
  const sendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim()) || !socket) return;
    
    // Send text
    socket.emit('send_message', { text: input });
    setMessages((prev) => [...prev, { id: Date.now().toString(), sender: 'me', text: input, time: getTime() }]);
    
    setInput('');
    setShowEmoji(false);
    socket.emit('typing_stop');
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!socket) return;
    socket.emit('typing_start');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { socket.emit('typing_stop'); }, 1000);
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setInput((prev) => prev + emojiData.emoji);
  };

  // --- IMAGE UPLOAD LOGIC (Base64) ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket) return;

    // Limit size to 1MB to prevent crashing
    if (file.size > 1024 * 1024) {
      alert("Image too large. Please send an image under 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      socket.emit('send_message', { image: base64 });
      setMessages((prev) => [...prev, { id: Date.now().toString(), sender: 'me', image: base64, time: getTime() }]);
    };
    reader.readAsDataURL(file);
  };

  const enterQueue = () => {
    if (!socket) return;
    setStep('matching');
    socket.emit('join_queue', { role, emotion });
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans flex justify-center items-center overflow-hidden selection:bg-blue-500/30">
      <div className="w-full h-[100dvh] max-w-md bg-zinc-950 relative shadow-2xl overflow-hidden flex flex-col">
        
        <AnimatePresence mode="wait">
          
          {/* LANDING, ROLE, EMOTION, MATCHING SCREENS (Keep exactly as before) */}
          {/* I am omitting the first 4 screens here to save space - PASTE YOUR PREVIOUS CODE FOR THESE SECTIONS HERE or ask me to reprint them if you need */}
          {step === 'landing' && (
             <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center p-8">
               <h1 className="text-6xl font-bold tracking-tighter mb-2 bg-gradient-to-b from-white to-zinc-600 bg-clip-text text-transparent">Echo</h1>
               <button onClick={() => setStep('role')} className="w-full py-4 bg-white text-black font-bold text-lg rounded-2xl mt-12">Start Session</button>
             </motion.div>
          )}
          
          {step === 'role' && (
             <motion.div key="role" className="flex-1 flex flex-row h-full">
               <div className="flex-1 bg-black flex items-center justify-center border-r border-zinc-800" onClick={() => { setRole('vent'); setStep('emotion'); }}><span className="text-2xl font-bold">VENT</span></div>
               <div className="flex-1 bg-white text-black flex items-center justify-center" onClick={() => { setRole('listen'); setStep('emotion'); }}><span className="text-2xl font-bold">LISTEN</span></div>
             </motion.div>
          )}

          {step === 'emotion' && (
             <motion.div key="emotion" className="flex-1 flex flex-col p-6">
                <div className="grid grid-cols-2 gap-3 mb-auto mt-20">
                  {['Anxiety', 'Loneliness', 'Anger', 'Happy'].map((em) => (
                    <button key={em} onClick={() => setEmotion(em)} className={`p-6 rounded-2xl border ${emotion === em ? 'bg-white text-black' : 'bg-zinc-900 border-zinc-800'}`}>{em}</button>
                  ))}
                </div>
                <button disabled={!emotion} onClick={enterQueue} className="w-full py-4 bg-white text-black font-bold text-lg rounded-2xl disabled:opacity-50">Find Match</button>
             </motion.div>
          )}

          {step === 'matching' && (
             <motion.div key="matching" className="flex-1 flex flex-col items-center justify-center">
                <div className="w-24 h-24 border-4 border-zinc-900 border-t-blue-500 rounded-full animate-spin"></div>
                <h2 className="mt-8 text-xl font-bold">Connecting...</h2>
             </motion.div>
          )}

          {/* CHAT SCREEN (UPDATED) */}
          {step === 'chat' && (
            <motion.div key="chat" initial={{ y: 500 }} animate={{ y: 0 }} className="flex-1 flex flex-col bg-black h-full">
              {/* Header */}
              <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="font-semibold text-sm">Anonymous</span>
                </div>
                <button onClick={() => window.location.reload()} className="text-xs text-red-500">Leave</button>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : msg.sender === 'sys' ? 'justify-center' : 'justify-start'}`}>
                    {msg.sender === 'sys' ? (
                      <span className="text-[10px] text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full">{msg.text}</span>
                    ) : (
                      <div className={`max-w-[75%] flex flex-col gap-1 ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                        
                        {/* TEXT MESSAGE */}
                        {msg.text && (
                          <div className={`px-4 py-3 rounded-2xl text-[15px] ${msg.sender === 'me' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-zinc-800 text-zinc-200 rounded-bl-none'}`}>
                            {msg.text}
                          </div>
                        )}

                        {/* IMAGE MESSAGE */}
                        {msg.image && (
                          <div className="relative group">
                            <img src={msg.image} alt="Sent" className={`max-w-[200px] rounded-xl border border-zinc-800 ${msg.sender === 'them' ? 'blur-md hover:blur-none transition-all cursor-pointer' : ''}`} />
                            {msg.sender === 'them' && <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:hidden"><span className="text-[10px] bg-black/50 px-2 py-1 rounded text-white">Click to reveal</span></div>}
                          </div>
                        )}
                        
                        <span className="text-[10px] text-zinc-600">{msg.time}</span>
                      </div>
                    )}
                  </div>
                ))}
                {partnerTyping && <div className="text-zinc-500 text-xs ml-4">Typing...</div>}
                <div ref={endRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 bg-black border-t border-zinc-900">
                {/* Emoji Picker Popup */}
                <AnimatePresence>
                  {showEmoji && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-20 left-4 z-20">
                      <div className="relative">
                        <button onClick={() => setShowEmoji(false)} className="absolute -top-2 -right-2 bg-zinc-800 rounded-full p-1 z-30"><X size={14}/></button>
                        <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.DARK} width={300} height={350} searchDisabled skinTonesDisabled />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={sendMessage} className="flex gap-2 items-end bg-zinc-900 rounded-3xl p-2 pl-4 transition-all">
                  
                  {/* Photo Button */}
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors mb-0.5">
                    <ImageIcon size={20} />
                  </button>
                  <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />

                  {/* Emoji Button */}
                  <button type="button" onClick={() => setShowEmoji(!showEmoji)} className={`p-2 rounded-full transition-colors mb-0.5 ${showEmoji ? 'text-white bg-zinc-800' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
                    <Smile size={20} />
                  </button>

                  <input 
                    value={input} 
                    onChange={handleTyping}
                    onFocus={() => setShowEmoji(false)}
                    placeholder="Type a message..." 
                    className="flex-1 bg-transparent text-white placeholder:text-zinc-500 outline-none text-sm py-3 max-h-24" 
                  />
                  
                  <button type="submit" disabled={!input.trim()} className="p-3 bg-blue-600 rounded-full text-white disabled:opacity-50 disabled:bg-zinc-800 transition-all hover:scale-105 active:scale-95 mb-0.5">
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}