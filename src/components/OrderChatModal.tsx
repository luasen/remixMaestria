import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { handleFirestoreError, OperationType } from '../services/db';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  orderBy, 
  limit, 
  doc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  getDoc 
} from 'firebase/firestore';
import { 
  X, 
  Send, 
  MessageSquare, 
  User, 
  Bike, 
  ShieldCheck, 
  Clock, 
  Check, 
  CheckCheck,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OrderChatModalProps {
  orderId: string;
  orderNumber: string;
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
  readBy: string[];
}

interface Typist {
  id: string;
  userName: string;
  userRole: string;
  updatedAt: string;
  isTyping: boolean;
}

export default function OrderChatModal({ orderId, orderNumber, customerName, isOpen, onClose }: OrderChatModalProps) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isOrderDelivered, setIsOrderDelivered] = useState(false);
  const [motoboyId, setMotoboyId] = useState<string | null>(null);
  const [motoboyOnline, setMotoboyOnline] = useState<boolean | null>(null);
  const [typists, setTypists] = useState<Typist[]>([]);
  const [notificationSound, setNotificationSound] = useState<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load alert sound for notifications
  useEffect(() => {
    // Standard ambient short ping sound
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav');
    audio.volume = 0.3;
    setNotificationSound(audio);
  }, []);

  // 1. Listen to Order status changes (real-time lock when delivered)
  useEffect(() => {
    if (!orderId || !isOpen) return;

    const orderRef = doc(db, 'orders', orderId);
    const unsubscribe = onSnapshot(orderRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const delivered = data.status === 'delivered' || data.statusEntrega === 'entregue';
        setIsOrderDelivered(delivered);
        if (data.motoboyId) {
          setMotoboyId(data.motoboyId);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `orders/${orderId}`);
    });

    return () => unsubscribe();
  }, [orderId, isOpen]);

  // 2. Listen to Motoboy's online/offline presence
  useEffect(() => {
    if (!motoboyId || !isOpen) return;

    const userRef = doc(db, 'users', motoboyId);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setMotoboyOnline(data.online === true);
      }
    }, (error) => {
      console.warn("Could not fetch motoboy presence:", error);
    });

    return () => unsubscribe();
  }, [motoboyId, isOpen]);

  // 3. Listen to Chat Messages in real-time & Mark as Read
  useEffect(() => {
    if (!isOpen || !orderId || !user) return;

    const messagesRef = collection(db, 'orders', orderId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(150));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: ChatMessage[] = [];
      let playsSound = false;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const msgId = docSnap.id;
        const readBy: string[] = data.readBy || [];

        fetchedMessages.push({
          id: msgId,
          senderId: data.senderId,
          senderName: data.senderName,
          senderRole: data.senderRole,
          text: data.text,
          createdAt: data.createdAt,
          readBy: readBy,
        });

        // If I am not the sender, and I haven't read this message yet
        if (data.senderId !== user.uid && !readBy.includes(user.uid)) {
          playsSound = true;
          // Mark as Read in Firestore
          const docRef = doc(db, 'orders', orderId, 'messages', msgId);
          updateDoc(docRef, {
            readBy: arrayUnion(user.uid)
          }).catch(err => console.error("Error updating read receipt:", err));
        }
      });

      // Play sound if a new message from other user is added
      if (playsSound && notificationSound) {
        notificationSound.play().catch(e => console.log("Sound play blocked:", e));
      }

      setMessages(fetchedMessages);
    }, (error) => {
      console.error("Error listening to chat messages:", error);
      try {
        handleFirestoreError(error, OperationType.GET, `orders/${orderId}/messages`);
      } catch (e) {
        // Error formatted and logged
      }
    });

    return () => unsubscribe();
  }, [isOpen, orderId, user, notificationSound]);

  // 4. Listen to Typing Status of other users
  useEffect(() => {
    if (!isOpen || !orderId || !user) return;

    const typingRef = collection(db, 'orders', orderId, 'typing');
    const unsubscribe = onSnapshot(typingRef, (snapshot) => {
      const activeTypists: Typist[] = [];
      const now = new Date().getTime();

      snapshot.forEach((docSnap) => {
        const id = docSnap.id;
        const data = docSnap.data();
        
        // Skip ourselves
        if (id === user.uid) return;

        const updatedAt = new Date(data.updatedAt).getTime();
        // Only consider active if set to typing and was updated in the last 6 seconds
        if (data.isTyping && (now - updatedAt) < 6000) {
          activeTypists.push({
            id,
            userName: data.userName,
            userRole: data.userRole,
            updatedAt: data.updatedAt,
            isTyping: data.isTyping,
          });
        }
      });

      setTypists(activeTypists);
    }, (error) => {
      console.warn("Error listening to typing status:", error);
    });

    return () => unsubscribe();
  }, [isOpen, orderId, user]);

  // 5. Scroll to bottom on new messages/typing changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typists]);

  // 6. Handle input typing state transitions
  const handleTyping = async () => {
    if (!user || !orderId || isOrderDelivered) return;

    // Reset old timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set typing state to true in Firestore
    try {
      const typingDocRef = doc(db, 'orders', orderId, 'typing', user.uid);
      await setDoc(typingDocRef, {
        isTyping: true,
        userName: profile?.name || user.displayName || 'Usuário',
        userRole: profile?.role || 'cliente',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error("Error setting typing status:", e);
    }

    // Set timer to set isTyping to false
    typingTimeoutRef.current = setTimeout(async () => {
      try {
        const typingDocRef = doc(db, 'orders', orderId, 'typing', user.uid);
        await setDoc(typingDocRef, {
          isTyping: false,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.error("Error resetting typing status:", e);
      }
    }, 3000);
  };

  // Cleanup typing on unmount/close
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (user && orderId) {
        const typingDocRef = doc(db, 'orders', orderId, 'typing', user.uid);
        setDoc(typingDocRef, {
          isTyping: false,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      }
    };
  }, [orderId, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isSending || isOrderDelivered) return;

    setIsSending(true);
    const textToSend = newMessage.trim();
    setNewMessage('');

    // Clear typing indicator immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    const typingDocRef = doc(db, 'orders', orderId, 'typing', user.uid);
    setDoc(typingDocRef, {
      isTyping: false,
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(() => {});

    try {
      const messagesRef = collection(db, 'orders', orderId, 'messages');
      await addDoc(messagesRef, {
        senderId: user.uid,
        senderName: profile?.name || user.displayName || 'Usuário',
        senderRole: profile?.role || 'cliente',
        text: textToSend,
        createdAt: new Date().toISOString(),
        readBy: [user.uid], // Initially read by sender
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(textToSend); // Put back in input if it failed
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'superadmin':
        return <span className="text-[8px] font-extrabold uppercase bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-md tracking-wider">Super Admin</span>;
      case 'admin':
        return <span className="text-[8px] font-extrabold uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md tracking-wider">Suporte</span>;
      case 'motoboy':
        return <span className="text-[8px] font-extrabold uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md tracking-wider">Motoboy</span>;
      default:
        return <span className="text-[8px] font-extrabold uppercase bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-md tracking-wider">Cliente</span>;
    }
  };

  // Get timestamp of the last message
  const getLastMessageTime = () => {
    if (messages.length === 0) return null;
    const lastMsg = messages[messages.length - 1];
    return new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const lastMessageTime = getLastMessageTime();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm">
        {/* Backdrop close */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0.8 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[85vh] sm:h-[620px] border border-gray-100 z-10"
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-100 bg-white flex items-center justify-between shadow-sm relative z-10">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-600 border border-orange-500/10">
                  <MessageSquare className="h-5 w-5" />
                </div>
                {motoboyId && (
                  <span className={`absolute -bottom-1 -right-1 block h-3.5 w-3.5 rounded-full border-2 border-white ring-1 ring-black/5 ${motoboyOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-sans text-sm font-black text-gray-900">
                    Chat de Entrega
                  </h3>
                  <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-500/5">
                    {orderNumber.slice(-6).toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[10px] text-gray-400 font-extrabold uppercase">
                    Cliente: {customerName}
                  </p>
                  {motoboyId && (
                    <>
                      <span className="h-1 w-1 rounded-full bg-gray-300" />
                      <span className={`text-[10px] font-bold ${motoboyOnline ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {motoboyOnline ? 'Motoboy Online' : 'Motoboy Offline'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="h-10 w-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 active:scale-95 transition border border-gray-100 shadow-sm"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Sub-Header / Last Message & Status banner */}
          <div className="bg-gray-50/50 px-5 py-2.5 border-b border-gray-100 flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase">
            <span>
              {lastMessageTime ? `Última mensagem às ${lastMessageTime}` : 'Sem mensagens'}
            </span>
            {isOrderDelivered ? (
              <span className="text-rose-600 flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-500/5">
                <AlertCircle className="h-3.5 w-3.5" />
                Conversa Finalizada
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1.5 animate-pulse bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-500/5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Chat Ativo
              </span>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-5 bg-gray-50/20 flex flex-col gap-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center my-auto">
                <div className="rounded-2xl bg-orange-500/10 border border-orange-100 p-4 mb-3 text-orange-500 shadow-inner">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h4 className="text-xs font-bold text-gray-700">Inicie uma conversa</h4>
                <p className="text-[10px] text-gray-400 max-w-[240px] mt-1 leading-relaxed font-semibold">
                  Mande uma mensagem para alinhar detalhes da entrega em tempo real.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === user?.uid;
                const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                // Read Receipts logic
                const isRead = msg.readBy && msg.readBy.length > 1;

                // Speech bubble styles based on sender role
                let bubbleClass = "bg-white text-gray-800 border border-gray-100 rounded-tl-none";
                if (isMe) {
                  if (profile?.role === 'admin' || profile?.role === 'superadmin') {
                    bubbleClass = "bg-amber-600 text-white rounded-tr-none";
                  } else if (profile?.role === 'motoboy') {
                    bubbleClass = "bg-indigo-600 text-white rounded-tr-none";
                  } else {
                    bubbleClass = "bg-orange-600 text-white rounded-tr-none";
                  }
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[82%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                  >
                    {/* Sender Header */}
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] font-extrabold text-gray-400 px-1">
                      {!isMe && <span>{msg.senderName}</span>}
                      {!isMe && getRoleBadge(msg.senderRole)}
                      {isMe && <span className="text-[9px] text-orange-600 font-black">Você</span>}
                    </div>

                    {/* Chat Bubble */}
                    <div
                      className={`px-4 py-3 rounded-[1.25rem] text-xs leading-relaxed font-semibold shadow-sm break-words w-full ${bubbleClass}`}
                    >
                      {msg.text}
                    </div>

                    {/* Timestamp & Status Checkmarks */}
                    <div className="flex items-center gap-1 mt-1 text-[9px] text-gray-400 font-bold px-1 select-none">
                      <Clock className="h-2.5 w-2.5 text-gray-300" />
                      <span>{formattedTime}</span>
                      {isMe && (
                        <span className="ml-1 shrink-0">
                          {isRead ? (
                            <CheckCheck className="h-3 w-3 text-blue-500" />
                          ) : (
                            <Check className="h-3 w-3 text-gray-400" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Real-time typing indicators */}
            {typists.map((typist) => (
              <div key={typist.id} className="flex flex-col items-start self-start max-w-[80%] animate-pulse">
                <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-gray-400 px-1">
                  <span>{typist.userName}</span>
                  {getRoleBadge(typist.userRole)}
                </div>
                <div className="bg-white text-gray-400 border border-gray-100 rounded-[1.25rem] rounded-tl-none px-4 py-2 text-xs font-semibold flex items-center gap-1 shadow-sm">
                  <span>Digitando</span>
                  <span className="flex gap-0.5 items-center justify-center mt-1">
                    <span className="h-1 w-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1 w-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1 w-1 bg-gray-400 rounded-full animate-bounce" />
                  </span>
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Form or Closed Alert */}
          {isOrderDelivered ? (
            <div className="p-5 border-t border-gray-100 bg-rose-50/50 flex flex-col items-center justify-center text-center gap-1">
              <span className="flex items-center justify-center h-8 w-8 rounded-full bg-rose-100 text-rose-600 mb-1">
                <AlertCircle className="h-4.5 w-4.5" />
              </span>
              <h5 className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Este chat foi finalizado</h5>
              <p className="text-[10px] text-gray-400 font-semibold max-w-xs leading-relaxed">
                O pedido foi entregue e finalizado. Mensagens não podem mais ser enviadas ou recebidas por motivos de segurança e histórico de serviço.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-gray-100 bg-white flex items-center gap-2 shadow-inner"
            >
              <input
                type="text"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                }}
                placeholder="Digite sua mensagem profissional..."
                className="flex-1 rounded-2xl border border-gray-100 bg-gray-50/50 py-3 px-4 text-xs font-semibold text-gray-800 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/10"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || isSending}
                className="h-11 w-11 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center transition shadow-lg shadow-orange-500/15 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
