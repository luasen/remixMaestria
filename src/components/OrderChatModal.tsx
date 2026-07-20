import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, addDoc, orderBy, limit } from 'firebase/firestore';
import { X, Send, MessageSquare, User, Bike, ShieldCheck, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OrderChatModalProps {
  orderId: string;
  orderNumber: string; // Display friendly ID like PED-123
  customerName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'cliente' | 'motoboy' | 'admin' | 'superadmin';
  text: string;
  createdAt: string;
}

export default function OrderChatModal({ orderId, orderNumber, customerName, isOpen, onClose }: OrderChatModalProps) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load and listen to messages in real-time
  useEffect(() => {
    if (!isOpen || !orderId) return;

    const messagesRef = collection(db, 'orders', orderId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedMessages.push({
          id: doc.id,
          senderId: data.senderId,
          senderName: data.senderName,
          senderRole: data.senderRole,
          text: data.text,
          createdAt: data.createdAt,
        });
      });
      setMessages(fetchedMessages);
    }, (error) => {
      console.error("Error listening to chat messages:", error);
    });

    return () => unsubscribe();
  }, [isOpen, orderId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isSending) return;

    setIsSending(true);
    const textToSend = newMessage.trim();
    setNewMessage('');

    try {
      const messagesRef = collection(db, 'orders', orderId, 'messages');
      await addDoc(messagesRef, {
        senderId: user.uid,
        senderName: profile?.name || user.displayName || 'Usuário',
        senderRole: profile?.role || 'cliente',
        text: textToSend,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error sending message:", error);
      // Put message back in input if it failed
      setNewMessage(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'superadmin':
      case 'admin':
        return <ShieldCheck className="h-3 w-3 text-amber-500 shrink-0" />;
      case 'motoboy':
        return <Bike className="h-3 w-3 text-indigo-500 shrink-0" />;
      default:
        return <User className="h-3 w-3 text-orange-500 shrink-0" />;
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'superadmin':
        return <span className="text-[8px] font-extrabold uppercase bg-rose-100 text-rose-700 px-1 py-0.2 rounded">Super Admin</span>;
      case 'admin':
        return <span className="text-[8px] font-extrabold uppercase bg-amber-100 text-amber-700 px-1 py-0.2 rounded">Admin</span>;
      case 'motoboy':
        return <span className="text-[8px] font-extrabold uppercase bg-indigo-100 text-indigo-700 px-1 py-0.2 rounded">Motoboy</span>;
      default:
        return <span className="text-[8px] font-extrabold uppercase bg-orange-100 text-orange-700 px-1 py-0.2 rounded">Cliente</span>;
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm">
        {/* Backdrop close */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[85vh] sm:h-[600px] border border-gray-100 z-10"
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-100 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-sans text-sm font-black text-gray-900">
                    Chat do Pedido
                  </h3>
                  <span className="text-xs font-extrabold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg">
                    {orderNumber}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                  Cliente: {customerName}
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="h-10 w-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 active:scale-95 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-5 bg-gray-50/50 flex flex-col gap-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center my-auto">
                <div className="rounded-full bg-orange-50 p-4 mb-3 text-orange-500">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h4 className="text-xs font-bold text-gray-700">Nenhuma mensagem ainda</h4>
                <p className="text-[10px] text-gray-400 max-w-[240px] mt-1 leading-relaxed">
                  Envie uma mensagem abaixo para falar com o entregador ou suporte do restaurante.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === user?.uid;
                const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                  >
                    {/* Sender Header (name & badge) */}
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-gray-400 px-1">
                      {!isMe && <span>{msg.senderName}</span>}
                      {!isMe && getRoleBadge(msg.senderRole)}
                      {isMe && <span className="text-[9px] text-orange-600 font-extrabold">Você</span>}
                    </div>

                    {/* Chat Bubble */}
                    <div
                      className={`px-4 py-3 rounded-3xl text-xs leading-relaxed font-medium shadow-sm break-words w-full ${
                        isMe
                          ? 'bg-orange-600 text-white rounded-tr-none'
                          : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-1 mt-1 text-[9px] text-gray-400 font-semibold px-1">
                      <Clock className="h-2.5 w-2.5" />
                      <span>{formattedTime}</span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSendMessage}
            className="p-4 border-t border-gray-100 bg-white flex items-center gap-2"
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 rounded-2xl border border-gray-100 bg-gray-50/50 py-3 px-4 text-xs text-gray-800 outline-none transition focus:border-orange-500 focus:bg-white"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="h-11 w-11 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center transition shadow-lg shadow-orange-500/15 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
