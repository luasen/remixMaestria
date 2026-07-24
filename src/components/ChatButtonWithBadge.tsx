import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { handleFirestoreError, OperationType } from '../services/db';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { MessageSquare } from 'lucide-react';

interface ChatButtonWithBadgeProps {
  orderId: string;
  onClick: (e: React.MouseEvent) => void;
  variant?: 'outline' | 'filled';
  size?: 'sm' | 'md' | 'full' | 'icon';
}

export default function ChatButtonWithBadge({ orderId, onClick, variant = 'outline', size = 'md' }: ChatButtonWithBadgeProps) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || !orderId) return;

    // Listen to messages for this order
    const messagesRef = collection(db, 'orders', orderId, 'messages');
    
    // Subscribe to all messages to check unread status
    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      let count = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        const readBy = data.readBy || [];
        // If I am not the sender and I haven't read it yet
        if (data.senderId !== user.uid && !readBy.includes(user.uid)) {
          count++;
        }
      });
      setUnreadCount(count);
    }, (error) => {
      console.error("Error fetching unread messages count:", error);
      try {
        handleFirestoreError(error, OperationType.GET, `orders/${orderId}/messages`);
      } catch (e) {
        // Handled
      }
    });

    return () => unsubscribe();
  }, [orderId, user]);

  const buttonClasses = () => {
    const base = "relative flex items-center justify-center gap-2 rounded-xl font-bold transition active:scale-95";
    
    // Sizes
    let sizeClass = "h-9 px-3 text-xs";
    if (size === 'icon') sizeClass = "h-9 w-9 p-0 rounded-xl shrink-0";
    if (size === 'md') sizeClass = "h-11 px-4 text-xs";
    if (size === 'full') sizeClass = "w-full h-11 px-4 text-xs mt-3";

    // Variants
    let variantClass = "bg-orange-500/10 text-orange-600 border border-orange-500/10 hover:bg-orange-500/20";
    if (variant === 'filled') {
      variantClass = "bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-500/10";
    }

    return `${base} ${sizeClass} ${variantClass}`;
  };

  return (
    <button type="button" onClick={onClick} className={buttonClasses()}>
      <MessageSquare className="h-4.5 w-4.5" />
      {size !== 'icon' && (
        <span>
          {size === 'full' ? 'Conversar no Chat do Pedido' : 'Chat'}
        </span>
      )}
      
      {unreadCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white ring-2 ring-white animate-bounce shadow-md">
          {unreadCount}
        </span>
      )}
    </button>
  );
}
