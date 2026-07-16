import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { formatPrice } from '../utils';
import { 
  Bike, 
  MapPin, 
  Phone, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  User, 
  Power, 
  ShoppingBag, 
  History, 
  ChevronRight, 
  Navigation, 
  Award, 
  AlertCircle,
  Sparkles,
  ArrowRight,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Motoboy() {
  const { user, profile, updateProfile, setIsAuthOpen } = useAuth();
  const { orders, updateOrder } = useApp();
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'history'>('available');
  const [isUpdating, setIsUpdating] = useState(false);

  // 1. Authorization Check
  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center bg-gray-50/50">
        <div className="rounded-full bg-orange-100 p-4 mb-4 text-orange-600">
          <Bike className="h-10 w-10 animate-bounce" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Área do Entregador</h2>
        <p className="text-sm text-gray-500 max-w-xs mb-6">
          Por favor, faça login ou crie uma conta para acessar a área de entregas.
        </p>
        <button
          onClick={() => setIsAuthOpen(true)}
          className="rounded-2xl bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/20 hover:bg-orange-700 transition"
        >
          Entrar ou Cadastrar
        </button>
      </div>
    );
  }

  if (profile?.role !== 'motoboy') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center bg-gray-50/50">
        <div className="rounded-full bg-red-100 p-4 mb-4 text-red-600">
          <AlertCircle className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Acesso não autorizado.</h2>
        <p className="text-sm text-gray-500 max-w-xs mb-6">
          Seu perfil atual ({profile?.role || 'cliente'}) não possui permissão para acessar a Área do Motoboy.
        </p>
      </div>
    );
  }

  // 2. Data Filtering for Motoboy
  // Available orders: tipoPedido === 'entrega', no motoboy assigned, status is not 'delivered' (or 'pending'/'preparing'/'ready')
  const availableOrders = orders.filter(
    (order) => 
      order.tipoPedido === 'entrega' && 
      !order.motoboyId && 
      order.status !== 'delivered'
  );

  // Active orders assigned to this motoboy and not yet delivered
  const activeOrders = orders.filter(
    (order) => 
      order.motoboyId === user.uid && 
      order.statusEntrega !== 'entregue' && 
      order.status !== 'delivered'
  );

  // Completed order history for this motoboy
  const completedOrders = orders.filter(
    (order) => 
      order.motoboyId === user.uid && 
      (order.statusEntrega === 'entregue' || order.status === 'delivered')
  );

  // Toggle online status
  const handleToggleOnline = async () => {
    setIsUpdating(true);
    try {
      await updateProfile({
        online: !profile.online,
        ultimaAtualizacao: new Date().toISOString()
      });
    } catch (e) {
      console.error('Error toggling online status:', e);
    } finally {
      setIsUpdating(false);
    }
  };

  // Accept Order
  const handleAcceptOrder = async (orderId: string) => {
    setIsUpdating(true);
    try {
      await updateOrder(orderId, {
        motoboyId: user.uid,
        statusEntrega: 'aceito'
      });
      setActiveTab('active');
    } catch (e) {
      console.error('Error accepting order:', e);
    } finally {
      setIsUpdating(false);
    }
  };

  // Start Delivery (A Caminho)
  const handleStartDelivery = async (orderId: string) => {
    setIsUpdating(true);
    try {
      await updateOrder(orderId, {
        statusEntrega: 'a_caminho'
      });
    } catch (e) {
      console.error('Error starting delivery:', e);
    } finally {
      setIsUpdating(false);
    }
  };

  // Complete Delivery (Entregue)
  const handleCompleteDelivery = async (orderId: string) => {
    setIsUpdating(true);
    try {
      await updateOrder(orderId, {
        status: 'delivered',
        statusEntrega: 'entregue',
        horarioEntrega: new Date().toISOString()
      });
      setActiveTab('history');
    } catch (e) {
      console.error('Error completing delivery:', e);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex-1 bg-gray-50/50 pb-24">
      {/* Header Profile Dashboard */}
      <div className="bg-white border-b border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-100 text-orange-600 font-bold text-lg shadow-inner">
                {profile.name ? profile.name.charAt(0).toUpperCase() : <User className="h-6 w-6" />}
              </div>
              <span className={`absolute bottom-0 right-0 block h-4 w-4 rounded-full border-2 border-white ring-1 ring-black/5 ${profile.online ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-sans text-sm font-bold text-gray-800 leading-tight">
                  {profile.name}
                </h2>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-orange-100 text-orange-700 uppercase tracking-wide">
                  <Award className="h-3 w-3" /> Motoboy
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-medium mt-0.5">{profile.phone || 'Sem telefone cadastrado'}</p>
            </div>
          </div>

          <button
            onClick={handleToggleOnline}
            disabled={isUpdating}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
              profile.online 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            <span>{profile.online ? 'Online' : 'Offline'}</span>
          </button>
        </div>

        {/* Motoboy Summary Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4 border-t border-gray-100 pt-4">
          <div className="bg-orange-50/50 rounded-2xl p-2.5 text-center border border-orange-500/5">
            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Disponíveis</span>
            <span className="text-base font-extrabold text-orange-600 mt-0.5 block">{availableOrders.length}</span>
          </div>
          <div className="bg-blue-50/50 rounded-2xl p-2.5 text-center border border-blue-500/5">
            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ativos</span>
            <span className="text-base font-extrabold text-blue-600 mt-0.5 block">{activeOrders.length}</span>
          </div>
          <div className="bg-emerald-50/50 rounded-2xl p-2.5 text-center border border-emerald-500/5">
            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Entregues</span>
            <span className="text-base font-extrabold text-emerald-600 mt-0.5 block">{completedOrders.length}</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-100 bg-white sticky top-16 z-10 px-4 py-1 gap-2">
        <button
          onClick={() => setActiveTab('available')}
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition text-center flex items-center justify-center gap-1.5 ${
            activeTab === 'available'
              ? 'bg-orange-500/10 text-orange-600'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          <span>Disponíveis ({availableOrders.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition text-center flex items-center justify-center gap-1.5 relative ${
            activeTab === 'active'
              ? 'bg-orange-500/10 text-orange-600'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Bike className="h-4 w-4" />
          <span>Em Andamento ({activeOrders.length})</span>
          {activeOrders.length > 0 && (
            <span className="absolute top-2 right-4 flex h-2 w-2 rounded-full bg-orange-600 animate-ping" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition text-center flex items-center justify-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-orange-500/10 text-orange-600'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Histórico ({completedOrders.length})</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-4">
        {/* --- 1. AVAILABLE ORDERS TAB --- */}
        {activeTab === 'available' && (
          <div className="flex flex-col gap-4">
            {!profile.online ? (
              <div className="rounded-3xl border border-dashed border-gray-200 p-8 text-center bg-white shadow-sm mt-4">
                <div className="rounded-full bg-gray-100 p-3.5 inline-block text-gray-400 mb-3">
                  <Power className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-gray-700 text-sm mb-1">Você está Offline</h3>
                <p className="text-xs text-gray-400 max-w-xs mx-auto mb-4">
                  Fique online para poder visualizar e aceitar novos pedidos disponíveis para entrega.
                </p>
                <button
                  onClick={handleToggleOnline}
                  className="rounded-2xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-orange-700 transition shadow-md shadow-orange-600/10"
                >
                  Ficar Online Agora
                </button>
              </div>
            ) : availableOrders.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 p-8 text-center bg-white shadow-sm mt-4">
                <div className="rounded-full bg-orange-50 p-3.5 inline-block text-orange-500 mb-3 animate-pulse">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-gray-700 text-sm mb-1">Nenhum pedido disponível</h3>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  Aguardando novos pedidos de entrega entrarem no sistema...
                </p>
              </div>
            ) : (
              availableOrders.map((order) => {
                const orderAddressStr = typeof order.endereco === 'string' 
                  ? order.endereco 
                  : `${order.endereco.street}, ${order.endereco.number} - ${order.endereco.neighborhood}, ${order.endereco.city}`;

                return (
                  <motion.div
                    key={order.id}
                    layoutId={`order-card-${order.id}`}
                    className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-3.5"
                  >
                    {/* Top Row: ID & Time */}
                    <div className="flex items-center justify-between border-b border-gray-50 pb-2.5">
                      <span className="text-xs font-extrabold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-xl">
                        {order.id}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-gray-400">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        <span>{order.horarioPedido || 'Pendente'}</span>
                      </div>
                    </div>

                    {/* Middle Info */}
                    <div className="flex flex-col gap-2.5 text-xs">
                      <div>
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cliente</span>
                        <span className="font-bold text-gray-800 text-sm mt-0.5 block">{order.customerName}</span>
                      </div>

                      <div className="flex items-start gap-1.5 bg-gray-50 p-2.5 rounded-2xl">
                        <MapPin className="h-4.5 w-4.5 text-orange-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Endereço de Entrega</span>
                          <span className="font-semibold text-gray-700 leading-normal mt-0.5 block">
                            {orderAddressStr}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Row: Price & Accept Button */}
                    <div className="flex items-center justify-between border-t border-gray-50 pt-3 mt-1">
                      <div>
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total a Receber</span>
                        <span className="text-base font-black text-gray-800 mt-0.5 block">
                          {formatPrice(order.valorTotal || order.total)}
                        </span>
                      </div>

                      <button
                        onClick={() => handleAcceptOrder(order.id)}
                        disabled={isUpdating}
                        className="rounded-2xl bg-orange-600 px-5 py-3 text-xs font-bold text-white hover:bg-orange-700 transition flex items-center gap-1 shadow-md shadow-orange-600/15 active:scale-95 disabled:opacity-50"
                      >
                        <span>Aceitar Pedido</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        )}

        {/* --- 2. ACTIVE ORDERS TAB --- */}
        {activeTab === 'active' && (
          <div className="flex flex-col gap-4">
            {activeOrders.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 p-8 text-center bg-white shadow-sm mt-4">
                <div className="rounded-full bg-blue-50 p-3.5 inline-block text-blue-500 mb-3">
                  <Bike className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-gray-700 text-sm mb-1">Sem entregas em andamento</h3>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  Você não tem nenhum pedido aceito no momento. Vá para a aba "Disponíveis" para aceitar uma nova corrida!
                </p>
              </div>
            ) : (
              activeOrders.map((order) => {
                const orderAddressStr = typeof order.endereco === 'string' 
                  ? order.endereco 
                  : `${order.endereco.street}, ${order.endereco.number} - ${order.endereco.neighborhood}, ${order.endereco.city}`;

                const isAccepted = order.statusEntrega === 'aceito';
                const isEnRoute = order.statusEntrega === 'a_caminho';

                return (
                  <motion.div
                    key={order.id}
                    layoutId={`order-card-${order.id}`}
                    className="bg-white rounded-3xl border-2 border-blue-500/20 p-5 shadow-md flex flex-col gap-4"
                  >
                    {/* Top Row: ID, Time & Status Pill */}
                    <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl">
                          {order.id}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          isEnRoute ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {isEnRoute ? 'A Caminho' : 'Aceito'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-gray-400">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        <span>{order.horarioPedido || 'Pendente'}</span>
                      </div>
                    </div>

                    {/* Customer & Address Details */}
                    <div className="flex flex-col gap-3.5 text-xs">
                      <div className="flex items-center justify-between bg-gray-50/50 p-3 rounded-2xl border border-gray-100/50">
                        <div>
                          <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Cliente</span>
                          <span className="font-bold text-gray-800 text-sm mt-0.5 block">{order.customerName}</span>
                        </div>
                        {order.customerPhone && (
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 text-white shadow-sm hover:bg-orange-700 transition"
                            title="Ligar para Cliente"
                          >
                            <Phone className="h-4.5 w-4.5" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-start gap-2 bg-blue-50/20 p-3 rounded-2xl border border-blue-500/5">
                        <MapPin className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Endereço de Entrega</span>
                          <span className="font-semibold text-gray-700 leading-normal mt-0.5 block">
                            {orderAddressStr}
                          </span>
                          {typeof order.endereco !== 'string' && order.endereco.complement && (
                            <span className="block text-[10px] text-gray-500 font-medium mt-1">
                              <strong>Compl.:</strong> {order.endereco.complement}
                            </span>
                          )}
                          {typeof order.endereco !== 'string' && order.endereco.reference && (
                            <span className="block text-[10px] text-gray-500 font-medium mt-0.5">
                              <strong>Ref.:</strong> {order.endereco.reference}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Items Ordered */}
                      <div className="border-t border-b border-gray-50 py-3 my-1">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">Itens do Pedido</span>
                        <div className="flex flex-col gap-2 max-h-32 overflow-y-auto">
                          {(order.itens || order.items || []).map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-gray-600">
                              <span className="font-semibold text-gray-800">
                                {item.quantity}x <span className="font-medium text-gray-600">{item.productName}</span>
                              </span>
                              <span className="font-bold text-gray-700">{formatPrice(item.price * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Footer: Price & Direct Actions */}
                    <div className="flex flex-col gap-3 pt-1 border-t border-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total do Pedido</span>
                          <span className="text-base font-extrabold text-gray-800 block">
                            {formatPrice(order.valorTotal || order.total)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Pagamento</span>
                          <span className="text-xs font-bold text-orange-600 uppercase mt-0.5 block">
                            {order.paymentMethod === 'pix' ? '🔥 Pix Online' : order.paymentMethod === 'card' ? '💳 Cartão na Entrega' : '💵 Dinheiro'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-1">
                        {isAccepted ? (
                          <button
                            onClick={() => handleStartDelivery(order.id)}
                            disabled={isUpdating}
                            className="col-span-2 rounded-2xl bg-amber-500 py-3.5 text-xs font-bold text-white hover:bg-amber-600 transition shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5"
                          >
                            <Navigation className="h-4 w-4 animate-pulse" />
                            <span>Iniciar Entrega (Saiu p/ entrega)</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCompleteDelivery(order.id)}
                            disabled={isUpdating}
                            className="col-span-2 rounded-2xl bg-emerald-600 py-3.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-md shadow-emerald-600/10 flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Finalizar Entrega (Entregue)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        )}

        {/* --- 3. COMPLETED HISTORY TAB --- */}
        {activeTab === 'history' && (
          <div className="flex flex-col gap-4">
            {completedOrders.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 p-8 text-center bg-white shadow-sm mt-4">
                <div className="rounded-full bg-emerald-50 p-3.5 inline-block text-emerald-600 mb-3">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-gray-700 text-sm mb-1">Nenhuma entrega concluída</h3>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  Suas entregas finalizadas com sucesso serão listadas aqui!
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 border-b border-gray-50 pb-2 flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-orange-500" /> Seu Desempenho Histórico
                </h3>
                
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 text-center">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total de Corridas</span>
                    <span className="text-lg font-extrabold text-gray-800 mt-0.5 block">{completedOrders.length}</span>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 text-center">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Faturamento</span>
                    <span className="text-lg font-extrabold text-emerald-600 mt-0.5 block">
                      {formatPrice(completedOrders.reduce((sum, o) => sum + (o.valorTotal || o.total), 0))}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3.5">
                  {completedOrders.map((order) => (
                    <div
                      key={order.id}
                      className="border-b border-gray-50 pb-3.5 last:border-b-0 last:pb-0 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                            {order.id}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-bold uppercase flex items-center gap-0.5">
                            <CheckCircle2 className="h-3 w-3" /> Entregue
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-gray-800 truncate mt-1">
                          Cliente: {order.customerName}
                        </h4>
                        <span className="text-[10px] text-gray-400 font-medium block mt-0.5">
                          Concluído às {order.horarioEntrega ? new Date(order.horarioEntrega).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Concluído'}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-gray-800 block">
                          {formatPrice(order.valorTotal || order.total)}
                        </span>
                        <span className="text-[9px] font-medium text-gray-400">
                          {order.paymentMethod === 'pix' ? 'Pix' : order.paymentMethod === 'card' ? 'Cartão' : 'Dinheiro'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
