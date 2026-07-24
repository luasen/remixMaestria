import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Category, Product, Order, RestaurantSettings, UserProfile } from '../types';
import { dbService, handleFirestoreError, OperationType } from '../services/db';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';
import { updateThemeColors } from '../utils/theme';

export type ActiveView = 'home' | 'menu' | 'cart' | 'checkout' | 'admin' | 'motoboy' | 'my-orders';

interface AppContextType {
  products: Product[];
  categories: Category[];
  orders: Order[];
  settings: RestaurantSettings | null;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  
  // DB Operations
  addProduct: (product: Omit<Product, 'id'>) => Promise<Product>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<Product>;
  deleteProduct: (id: string) => Promise<boolean>;
  addCategory: (name: string, image?: string) => Promise<Category>;
  updateCategory: (id: string, name: string, image?: string) => Promise<Category>;
  deleteCategory: (id: string) => Promise<boolean>;
  createOrder: (orderData: Omit<Order, 'id' | 'createdAt' | 'status'>) => Promise<Order>;
  updateOrderStatus: (id: string, status: Order['status']) => Promise<Order>;
  updateOrder: (id: string, updatedFields: Partial<Order>) => Promise<Order>;
  updateSettings: (settings: RestaurantSettings) => Promise<RestaurantSettings>;
  getUsers: () => Promise<UserProfile[]>;
  updateUserProfile: (uid: string, fields: Partial<UserProfile>) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedProducts, fetchedCategories, fetchedSettings] = await Promise.all([
        dbService.getProducts(),
        dbService.getCategories(),
        dbService.getSettings(),
      ]);

      setProducts(fetchedProducts);
      setCategories(fetchedCategories);
      setSettings(fetchedSettings);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    updateThemeColors(settings?.primaryColor, settings?.secondaryColor, settings?.backgroundColor);
  }, [settings]);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }

    let q;
    const role = profile?.role;

    if (role === 'admin' || role === 'superadmin' || role === 'motoboy') {
      // Admins, superadmins, and motoboys can listen to all orders
      q = query(collection(db, 'orders'));
    } else {
      // Clients can only listen to their own orders
      q = query(collection(db, 'orders'), where('usuario.uid', '==', user.uid));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: Order[] = [];
      snapshot.forEach((doc) => {
        fetchedOrders.push(doc.data() as Order);
      });
      // Sort client-side to keep queries flexible and avoid composite index requirements
      const sorted = fetchedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(sorted);
    }, (error) => {
      console.error('Error in orders snapshot listener:', error);
      try {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      } catch (err) {
        // Fallback to client-specific query if global listener was blocked
        if (role === 'admin' || role === 'superadmin' || role === 'motoboy') {
          const fallbackQ = query(collection(db, 'orders'), where('usuario.uid', '==', user.uid));
          onSnapshot(fallbackQ, (subSnap) => {
            const fetched: Order[] = [];
            subSnap.forEach(d => fetched.push(d.data() as Order));
            setOrders(fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          }, () => {});
        }
      }
    });

    return () => unsubscribe();
  }, [user, profile?.role]);

  const refreshData = async () => {
    await loadData();
  };

  const handleAddProduct = async (product: Omit<Product, 'id'>) => {
    const newProduct = await dbService.addProduct(product);
    setProducts((prev) => {
      const combined = [...prev, newProduct];
      const seen = new Set<string>();
      return combined.filter(p => {
        if (!p.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
    });
    return newProduct;
  };

  const handleUpdateProduct = async (id: string, updatedFields: Partial<Product>) => {
    const updated = await dbService.updateProduct(id, updatedFields);
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  };

  const handleDeleteProduct = async (id: string) => {
    const success = await dbService.deleteProduct(id);
    if (success) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
    return success;
  };

  const handleAddCategory = async (name: string, image?: string) => {
    const newCategory = await dbService.addCategory(name, image);
    setCategories((prev) => {
      const combined = [...prev, newCategory];
      const seen = new Set<string>();
      return combined.filter(c => {
        if (!c.id || seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
    });
    return newCategory;
  };

  const handleUpdateCategory = async (id: string, name: string, image?: string) => {
    const updated = await dbService.updateCategory(id, name, image);
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  };

  const handleDeleteCategory = async (id: string) => {
    const success = await dbService.deleteCategory(id);
    if (success) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }
    return success;
  };

  const handleCreateOrder = async (orderData: Omit<Order, 'id' | 'createdAt' | 'status'>) => {
    const newOrder = await dbService.createOrder(orderData);
    setOrders((prev) => {
      const combined = [newOrder, ...prev];
      const seen = new Set<string>();
      return combined.filter(o => {
        if (!o.id || seen.has(o.id)) return false;
        seen.add(o.id);
        return true;
      });
    });
    return newOrder;
  };

  const handleUpdateOrderStatus = async (id: string, status: Order['status']) => {
    const updated = await dbService.updateOrderStatus(id, status);
    setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
    return updated;
  };

  const handleUpdateOrder = async (id: string, updatedFields: Partial<Order>) => {
    const updated = await dbService.updateOrder(id, updatedFields);
    setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
    return updated;
  };

  const handleUpdateSettings = async (newSettings: RestaurantSettings) => {
    const updated = await dbService.saveSettings(newSettings);
    setSettings(updated);
    return updated;
  };

  const handleGetUsers = async () => {
    return await dbService.getUsers();
  };

  const handleUpdateUserProfile = async (uid: string, fields: Partial<UserProfile>) => {
    await dbService.updateUserProfile(uid, fields);
  };

  return (
    <AppContext.Provider
      value={{
        products,
        categories,
        orders,
        settings,
        activeView,
        setActiveView,
        isLoading,
        refreshData,
        addProduct: handleAddProduct,
        updateProduct: handleUpdateProduct,
        deleteProduct: handleDeleteProduct,
        addCategory: handleAddCategory,
        updateCategory: handleUpdateCategory,
        deleteCategory: handleDeleteCategory,
        createOrder: handleCreateOrder,
        updateOrderStatus: handleUpdateOrderStatus,
        updateOrder: handleUpdateOrder,
        updateSettings: handleUpdateSettings,
        getUsers: handleGetUsers,
        updateUserProfile: handleUpdateUserProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
