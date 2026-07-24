import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { handleFirestoreError, OperationType } from '../services/db';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  limit, 
  doc, 
  addDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  getDocs 
} from 'firebase/firestore';
import { 
  Search, 
  Calendar, 
  Download, 
  MessageSquare, 
  Bike, 
  User, 
  Send, 
  Clock, 
  Check, 
  CheckCheck, 
  AlertCircle,
  Inbox,
  Filter,
  RefreshCw,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

export default function AdminChatDashboard() {
  const { orders } = useApp();
  const { user, profile } = useAuth();
  
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  
  // Real-time Chat States for the selected order
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [typists, setTypists] = useState<Typist[]>([]);
  const [isOrderDelivered, setIsOrderDelivered] = useState(false);
  
  // Unread badge map for all chats
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Filter orders to only get those with chats (tipoPedido === 'entrega' and motoboyId exists)
  const chatOrders = orders.filter(
    (order) => order.tipoPedido === 'entrega' && order.motoboyId
  );

  // Setup unread listeners for all chat orders to show dynamic badges in list
  useEffect(() => {
    if (!user) return;
    
    const unsubscribes = chatOrders.map((order) => {
      const messagesRef = collection(db, 'orders', order.id, 'messages');
      return onSnapshot(messagesRef, (snapshot) => {
        let count = 0;
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const readBy = data.readBy || [];
          if (data.senderId !== user.uid && !readBy.includes(user.uid)) {
            count++;
          }
        });
        setUnreadCounts((prev) => ({ ...prev, [order.id]: count }));
      }, (error) => {
        console.warn(`Error fetching unread count for order ${order.id}:`, error);
      });
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [orders, user]);

  // Listen to messages of selected conversation
  useEffect(() => {
    if (!selectedOrder || !user) {
      setMessages([]);
      return;
    }

    const messagesRef = collection(db, 'orders', selectedOrder.id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(150));

    // Monitor order completion status
    const orderDocRef = doc(db, 'orders', selectedOrder.id);
    const unsubOrder = onSnapshot(orderDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setIsOrderDelivered(data.status === 'delivered' || data.statusEntrega === 'entregue');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `orders/${selectedOrder.id}`);
    });

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: ChatMessage[] = [];
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

        // Mark as Read if message from someone else
        if (data.senderId !== user.uid && !readBy.includes(user.uid)) {
          const docRef = doc(db, 'orders', selectedOrder.id, 'messages', msgId);
          updateDoc(docRef, {
            readBy: arrayUnion(user.uid)
          }).catch(err => console.error("Error reading message in admin panel:", err));
        }
      });
      setMessages(fetchedMessages);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `orders/${selectedOrder.id}/messages`);
      } catch (e) {
        // Formatted error
      }
    });

    return () => {
      unsubscribe();
      unsubOrder();
    };
  }, [selectedOrder, user]);

  // Listen to typing state for selected conversation
  useEffect(() => {
    if (!selectedOrder || !user) return;

    const typingRef = collection(db, 'orders', selectedOrder.id, 'typing');
    const unsubscribe = onSnapshot(typingRef, (snapshot) => {
      const activeTypists: Typist[] = [];
      const now = new Date().getTime();

      snapshot.forEach((docSnap) => {
        const id = docSnap.id;
        const data = docSnap.data();
        if (id === user.uid) return;

        const updatedAt = new Date(data.updatedAt).getTime();
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
    });

    return () => unsubscribe();
  }, [selectedOrder, user]);

  // Scroll to bottom on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typists]);

  // Filter conversations
  const filteredConversations = chatOrders.filter((order) => {
    // 1. Search Query filter (matches Customer Name, Order Number, or Motoboy ID/Name)
    const matchesSearch = 
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.motoboyName && order.motoboyName.toLowerCase().includes(searchQuery.toLowerCase()));

    // 2. Date period filtering
    if (startDate || endDate) {
      const orderTime = new Date(order.horario || order.createdAt).getTime();
      if (startDate) {
        const start = new Date(startDate).getTime();
        if (orderTime < start) return false;
      }
      if (endDate) {
        // End of the day
        const end = new Date(endDate).setHours(23, 59, 59, 999);
        if (orderTime > end) return false;
      }
    }

    return matchesSearch;
  });

  // Handle typing inside admin input
  const handleAdminTyping = async () => {
    if (!user || !selectedOrder || isOrderDelivered) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      const typingDocRef = doc(db, 'orders', selectedOrder.id, 'typing', user.uid);
      await setDoc(typingDocRef, {
        isTyping: true,
        userName: profile?.name || 'Administrador (Suporte)',
        userRole: profile?.role || 'admin',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error(e);
    }

    typingTimeoutRef.current = setTimeout(async () => {
      try {
        const typingDocRef = doc(db, 'orders', selectedOrder.id, 'typing', user.uid);
        await setDoc(typingDocRef, {
          isTyping: false,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {}
    }, 3000);
  };

  // Cleanup typing on unmount/selected chat change
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (user && selectedOrder) {
        const typingDocRef = doc(db, 'orders', selectedOrder.id, 'typing', user.uid);
        setDoc(typingDocRef, {
          isTyping: false,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      }
    };
  }, [selectedOrder, user]);

  const handleSendAdminMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isSending || isOrderDelivered) return;

    setIsSending(true);
    const textToSend = newMessage.trim();
    setNewMessage('');

    try {
      const messagesRef = collection(db, 'orders', selectedOrder.id, 'messages');
      await addDoc(messagesRef, {
        senderId: user.uid,
        senderName: profile?.name || 'Suporte Maestria Grill',
        senderRole: profile?.role || 'admin',
        text: textToSend,
        createdAt: new Date().toISOString(),
        readBy: [user.uid],
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  // Export conversations to TXT format
  const handleExportChat = (orderToExport: any, chatMessages: ChatMessage[]) => {
    if (chatMessages.length === 0) return;

    let content = `==================================================\n`;
    content += `RELATÓRIO DE CONVERSA - CHAT DO PEDIDO\n`;
    content += `Pedido ID: ${orderToExport.id.toUpperCase()}\n`;
    content += `Data do Pedido: ${new Date(orderToExport.horario || orderToExport.createdAt).toLocaleString()}\n`;
    content += `Cliente: ${orderToExport.customerName}\n`;
    content += `Motoboy: ${orderToExport.motoboyName || 'Vinculado'}\n`;
    content += `Status do Pedido: ${orderToExport.status === 'delivered' ? 'ENTREGUE' : 'EM TRÂNSITO'}\n`;
    content += `Exportado em: ${new Date().toLocaleString()}\n`;
    content += `==================================================\n\n`;

    chatMessages.forEach((msg) => {
      const time = new Date(msg.createdAt).toLocaleString();
      const roleUpper = msg.senderRole.toUpperCase();
      content += `[${time}] ${msg.senderName} (${roleUpper}): ${msg.text}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `conversa_${orderToExport.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden min-h-[500px] flex flex-col md:flex-row">
      
      {/* 1. LEFT PANE: Conversation list */}
      <div className="w-full md:w-80 border-r border-gray-100 flex flex-col bg-gray-50/20">
        
        {/* Header and Search Filters */}
        <div className="p-4 border-b border-gray-100 flex flex-col gap-3 bg-white">
          <div className="flex items-center justify-between">
            <h4 className="font-sans text-sm font-black text-gray-900 flex items-center gap-1.5">
              <MessageSquare className="h-5 w-5 text-orange-600" />
              Central de Chats
            </h4>
            <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-lg font-black uppercase">
              {filteredConversations.length} Ativos
            </span>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por pedido, cliente ou motoboy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold outline-none focus:border-orange-500 focus:bg-white transition"
            />
          </div>

          {/* Period Filter dropdown triggers */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] font-black uppercase text-gray-400">De (Início)</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-100 rounded-xl px-2.5 py-1 text-[10px] font-semibold bg-gray-50 outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] font-black uppercase text-gray-400">Até (Fim)</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-100 rounded-xl px-2.5 py-1 text-[10px] font-semibold bg-gray-50 outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto max-h-[400px] md:max-h-[500px]">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
              <Inbox className="h-8 w-8 mb-2 text-gray-300" />
              <h5 className="text-xs font-bold">Nenhum chat encontrado</h5>
              <p className="text-[10px] text-gray-400 max-w-[180px] mt-1 font-semibold leading-relaxed">
                Tente alterar os termos de busca ou filtros de período.
              </p>
            </div>
          ) : (
            filteredConversations.map((order) => {
              const isSelected = selectedOrder?.id === order.id;
              const unread = unreadCounts[order.id] || 0;
              const delivered = order.status === 'delivered' || order.statusEntrega === 'entregue';

              return (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full p-4 border-b border-gray-100 flex flex-col gap-1 text-left transition relative ${
                    isSelected 
                      ? 'bg-orange-500/5 border-l-4 border-l-orange-600' 
                      : 'hover:bg-gray-100/50 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-[11px] font-black text-gray-950 uppercase tracking-wider">
                      {order.customerName}
                    </span>
                    <span className="text-[9px] font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-500/5">
                      {order.id.slice(-6).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold">
                    <Bike className="h-3 w-3 shrink-0" />
                    <span className="truncate">Motoboy: {order.motoboyName || 'Entregador'}</span>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-50">
                    <span className="text-[9px] text-gray-400 font-bold">
                      {new Date(order.horario || order.createdAt).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
                    </span>
                    
                    <div className="flex items-center gap-1.5">
                      {delivered ? (
                        <span className="text-[8px] font-extrabold uppercase bg-gray-100 text-gray-500 px-1.5 py-0.2 rounded-md">
                          Finalizado
                        </span>
                      ) : (
                        <span className="text-[8px] font-extrabold uppercase bg-emerald-50 text-emerald-600 px-1.5 py-0.2 rounded-md animate-pulse">
                          Ativo
                        </span>
                      )}

                      {unread > 0 && (
                        <span className="h-5 w-5 bg-rose-600 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-md animate-bounce">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. RIGHT PANE: Detail / Active Chat */}
      <div className="flex-1 flex flex-col bg-white min-h-[450px]">
        {selectedOrder ? (
          <div className="flex-1 flex flex-col">
            {/* Active chat header with actions */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-600 border border-orange-500/10">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                    Pedido #{selectedOrder.id.slice(-6).toUpperCase()}
                    {isOrderDelivered ? (
                      <span className="text-[8px] font-black uppercase bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Finalizado</span>
                    ) : (
                      <span className="text-[8px] font-black uppercase bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded animate-pulse">Ativo</span>
                    )}
                  </h4>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                    Cliente: {selectedOrder.customerName} &bull; Entregador: {selectedOrder.motoboyName || 'Aguardando'}
                  </p>
                </div>
              </div>

              {/* Export transcript action */}
              <button
                onClick={() => handleExportChat(selectedOrder, messages)}
                disabled={messages.length === 0}
                className="flex items-center gap-1.5 h-10 px-3 border border-orange-500/10 rounded-2xl bg-orange-500/5 hover:bg-orange-500/10 text-orange-600 text-xs font-extrabold transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                title="Exportar transcrição da conversa"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Exportar Chat</span>
              </button>
            </div>

            {/* Chat message logs */}
            <div className="flex-1 overflow-y-auto p-5 bg-gray-50/20 flex flex-col gap-4 max-h-[300px] md:max-h-[350px]">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 my-auto text-center">
                  <Inbox className="h-7 w-7 text-gray-300 mb-2" />
                  <h5 className="text-xs font-bold text-gray-600">Nenhuma mensagem registrada</h5>
                  <p className="text-[10px] text-gray-400 max-w-[200px] mt-1 font-semibold">
                    Aguardando início de comunicação entre o cliente e o entregador.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === user?.uid;
                  const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isRead = msg.readBy && msg.readBy.length > 1;

                  // Admin visual style
                  let bubbleClass = "bg-white text-gray-800 border border-gray-100 rounded-tl-none";
                  let senderLabelColor = "text-gray-400";

                  if (isMe) {
                    bubbleClass = "bg-amber-600 text-white rounded-tr-none";
                    senderLabelColor = "text-amber-600";
                  } else if (msg.senderRole === 'motoboy') {
                    bubbleClass = "bg-indigo-50 text-indigo-900 border border-indigo-100 rounded-tl-none";
                  } else if (msg.senderRole === 'cliente') {
                    bubbleClass = "bg-orange-50 text-orange-900 border border-orange-100 rounded-tl-none";
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                    >
                      {/* Message sender header */}
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] font-extrabold text-gray-400 px-1">
                        {!isMe && <span>{msg.senderName}</span>}
                        {!isMe && (
                          <span className={`text-[8px] font-extrabold uppercase px-1 py-0.2 rounded-md ${
                            msg.senderRole === 'motoboy' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {msg.senderRole}
                          </span>
                        )}
                        {isMe && <span className="text-[9px] text-amber-600 font-black">Você (Suporte)</span>}
                      </div>

                      {/* Bubble */}
                      <div className={`px-3.5 py-2.5 rounded-[1.25rem] text-xs leading-relaxed font-semibold shadow-sm break-words w-full ${bubbleClass}`}>
                        {msg.text}
                      </div>

                      {/* Info footer */}
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

              {/* Real-time typing states */}
              {typists.map((typist) => (
                <div key={typist.id} className="flex flex-col items-start self-start max-w-[80%] animate-pulse">
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-gray-400 px-1">
                    <span>{typist.userName}</span>
                    <span className="text-[8px] bg-gray-100 text-gray-500 px-1 rounded uppercase font-black">{typist.userRole}</span>
                  </div>
                  <div className="bg-white text-gray-400 border border-gray-100 rounded-2xl rounded-tl-none px-3.5 py-1.5 text-xs font-bold flex items-center gap-1 shadow-sm">
                    <span>Digitando</span>
                    <span className="flex gap-0.5 items-center mt-1">
                      <span className="h-1 w-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1 w-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1 w-1 bg-gray-400 rounded-full animate-bounce" />
                    </span>
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>

            {/* Support Message Input Form */}
            {isOrderDelivered ? (
              <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                <span className="text-[10px] text-gray-400 font-extrabold uppercase flex items-center justify-center gap-1">
                  <AlertCircle className="h-4 w-4 text-gray-400" />
                  Chat encerrado. Pedido entregue ao cliente.
                </span>
              </div>
            ) : (
              <form
                onSubmit={handleSendAdminMessage}
                className="p-3 border-t border-gray-100 bg-white flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleAdminTyping();
                  }}
                  placeholder="Responder como Suporte do Restaurante..."
                  className="flex-1 rounded-2xl border border-gray-100 bg-gray-50/50 py-3 px-4 text-xs font-semibold text-gray-800 outline-none transition focus:border-orange-500 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSending}
                  className="h-11 w-11 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center transition shadow-lg shadow-amber-500/10 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400 my-auto">
            <div className="h-14 w-14 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-500/10 mb-4 shadow-inner">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h5 className="font-sans text-sm font-extrabold text-gray-700">Selecione uma conversa</h5>
            <p className="text-xs text-gray-400 max-w-xs mt-1.5 leading-relaxed font-bold uppercase tracking-wider text-[10px]">
              Clique em um dos pedidos ativos ou finalizados da lista para monitorar o chat em tempo real.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
