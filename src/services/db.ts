import { db, auth } from './firebase';
import { 
  collection, 
  getDocs, 
  getDoc,
  setDoc, 
  doc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { Category, Product, Order, RestaurantSettings, UserProfile } from '../types';
// @ts-ignore
import restaurantBanner from '../assets/images/restaurant_banner_1783985102418.jpg';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null): never {
  const isPermissionError = error?.message?.includes('permission') || error?.code?.includes('permission-denied') || String(error).includes('permission');
  if (isPermissionError) {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Permission Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }
  throw error;
}

// Helper to remove undefined values from objects before writing to Firestore
function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)) as any;
  }
  if (typeof obj === 'object') {
    const clean = { ...obj } as any;
    Object.keys(clean).forEach((key) => {
      if (clean[key] === undefined) {
        delete clean[key];
      } else if (clean[key] !== null && typeof clean[key] === 'object') {
        clean[key] = cleanUndefined(clean[key]);
      }
    });
    return clean;
  }
  return obj;
}

// Initial data to pre-populate Firestore if empty
const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Pratos', slug: 'pratos', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80' },
  { id: 'cat-2', name: 'Lanches', slug: 'lanches', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80' },
  { id: 'cat-3', name: 'Bebidas', slug: 'bebidas', image: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=600&auto=format&fit=crop&q=80' },
  { id: 'cat-4', name: 'Sobremesas', slug: 'sobremesas', image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80' },
];

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Filé Mignon Grelhado',
    description: 'Medalhão de filé mignon grelhado na brasa, servido com arroz biro-biro, batatas rústicas douradas e molho chimichurri caseiro.',
    price: 68.90,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80',
    categoryId: 'cat-1',
    active: true,
  },
  {
    id: 'prod-2',
    name: 'Risoto de Cogumelos',
    description: 'Arroz arbóreo italiano cremoso cozido com mix de cogumelos frescos (shimeji, paris e portobello), finalizado com queijo parmesão grana padano e azeite de trufas brancas.',
    price: 54.00,
    image: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=600&auto=format&fit=crop&q=80',
    categoryId: 'cat-1',
    active: true,
  },
  {
    id: 'prod-3',
    name: 'Smash Burger Duplo',
    description: 'Dois smash burgers de 90g de carne angus, queijo cheddar derretido, cebola caramelizada, picles artesanal e molho secreto da casa no pão de brioche tostado.',
    price: 34.90,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
    categoryId: 'cat-2',
    active: true,
  },
  {
    id: 'prod-4',
    name: 'Chicken Club Sandwich',
    description: 'Sanduíche de peito de frango grelhado e desfiado, bacon crocante, queijo prato, maionese verde, tomate fresco e alface americana no pão de forma tostado.',
    price: 29.90,
    image: 'https://images.unsplash.com/photo-1521390188846-e2a3a97453a0?w=600&auto=format&fit=crop&q=80',
    categoryId: 'cat-2',
    active: true,
  },
  {
    id: 'prod-5',
    name: 'Suco Natural de Maracujá',
    description: 'Suco feito na hora com a polpa fresca de maracujá, batido com gelo. Refrescante e naturalmente doce-azedo.',
    price: 12.00,
    image: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=600&auto=format&fit=crop&q=80',
    categoryId: 'cat-3',
    active: true,
  },
  {
    id: 'prod-6',
    name: 'Refrigerante Lata',
    description: 'Coca-Cola Original ou Zero açúcar lata 350ml bem gelada.',
    price: 6.50,
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80',
    categoryId: 'cat-3',
    active: true,
  },
  {
    id: 'prod-7',
    name: 'Petit Gâteau Clássico',
    description: 'Bolinho de chocolate com recheio cremoso e quente, servido com uma generosa bola de sorvete de creme artesanal e calda de chocolate belga.',
    price: 24.90,
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80',
    categoryId: 'cat-4',
    active: true,
  },
  {
    id: 'prod-8',
    name: 'Pudim de Leite Condensado',
    description: 'O clássico pudim de leite condensado super cremoso, lisinho e sem furinhos, com calda de caramelo dourado perfeito.',
    price: 15.00,
    image: 'https://images.unsplash.com/photo-1528975604071-b4dc52a2d18c?w=600&auto=format&fit=crop&q=80',
    categoryId: 'cat-4',
    active: true,
  },
];

const DEFAULT_SETTINGS: RestaurantSettings = {
  name: 'Maestria Grill',
  description: 'O autêntico sabor da brasa com carnes nobres grelhadas com perfeição e paixão em servir.',
  logoUrl: '🥩',
  bannerUrl: restaurantBanner,
  deliveryFee: 7.00,
  phone: '(11) 99999-8888',
  address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',

  // 1. Informações do Restaurante
  whatsapp: '(11) 99999-8888',
  instagram: '@maestriagrill',
  facebook: 'maestriagrill',
  email: 'contato@maestriagrill.com.br',
  horarioFuncionamento: 'Segunda a Sábado, das 18h às 23h30',

  // 2. Configurações de Entrega
  minOrderValue: 30.00,
  maxDeliveryDistance: 10,
  avgDeliveryTime: '35 - 50 min',
  avgPickupTime: '15 - 25 min',
  allowPickup: true,
  allowDelivery: true,

  // 3. Formas de Pagamento
  paymentPix: true,
  paymentCash: true,
  paymentCreditCard: true,
  paymentDebitCard: true,

  // 4. Cupons
  coupons: [
    {
      id: 'cupom-primeiro',
      name: 'Primeira Compra',
      code: 'BEMVINDO',
      discountType: 'percentage',
      discountValue: 10,
      validUntil: '2027-12-31',
      maxUses: 100,
      usedCount: 0,
      active: true,
    },
    {
      id: 'cupom-quinze',
      name: 'Desconto de R$15',
      code: 'MAESTRIA15',
      discountType: 'fixed',
      discountValue: 15,
      validUntil: '2027-12-31',
      maxUses: 50,
      usedCount: 0,
      active: true,
    }
  ],

  // 5. Banner Promocional
  promoBannerEnabled: true,
  promoBannerTitle: 'Festival do Ribeye Premium',
  promoBannerDesc: 'Neste final de semana, saboreie o melhor Ribeye grelhado com 20% de desconto real!',
  promoBannerImage: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
  promoBannerBtnText: 'Ver Prato Principal',
  promoBannerBtnLink: '#menu',
  promoBannerStart: '',
  promoBannerEnd: '',

  // 6. Configurações dos Motoboys
  motoboyDistribution: 'automatic',
  motoboyMaxSimultaneousOrders: 3,
  motoboyMaxAcceptTime: 60,
  motoboyMaxDistance: 15,

  // 7. Notificações
  notifyPush: true,
  notifyEmail: true,
  notifySms: false,

  // 8. Aparência
  primaryColor: '#ea580c', // orange-600
  secondaryColor: '#f97316', // orange-500
  backgroundColor: '#fff7f4', // soft warm cream background
  homeImage: '',
  splashImage: '',
  appNameExhibited: 'Maestria Grill',

  // 9. Modo Manutenção
  maintenanceMode: false,

  // 10. Backup
  lastBackupDate: new Date().toLocaleDateString('pt-BR'),
};

// DATABASE SERVICE EXPORT WITH FIRESTORE
export const dbService = {
  // --- CATEGORIES ---
  async getCategories(): Promise<Category[]> {
    try {
      const colRef = collection(db, 'categories');
      const snapshot = await getDocs(colRef);
      
      if (snapshot.empty) {
        // Seed initial categories
        try {
          for (const cat of INITIAL_CATEGORIES) {
            await setDoc(doc(db, 'categories', cat.id), cat);
          }
        } catch (seedError) {
          console.warn('Skipping category seeding due to insufficient permissions:', seedError);
        }
        return INITIAL_CATEGORIES;
      }

      const categories: Category[] = [];
      snapshot.forEach((doc) => {
        categories.push(doc.data() as Category);
      });

      // Filter duplicates just in case
      const seen = new Set<string>();
      return categories.filter(c => {
        if (!c.id || seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
    } catch (error) {
      console.error('Error fetching categories from Firestore:', error);
      return INITIAL_CATEGORIES;
    }
  },

  async saveCategories(categories: Category[]): Promise<Category[]> {
    try {
      for (const cat of categories) {
        await setDoc(doc(db, 'categories', cat.id), cleanUndefined(cat));
      }
      return categories;
    } catch (error) {
      console.error('Error saving categories to Firestore:', error);
      return categories;
    }
  },

  async addCategory(name: string, image?: string): Promise<Category> {
    const id = `cat-${Date.now()}`;
    const newCategory: Category = {
      id,
      name,
      slug: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-'),
    };
    if (image !== undefined) {
      newCategory.image = image;
    }
    try {
      await setDoc(doc(db, 'categories', id), newCategory);
      return newCategory;
    } catch (error) {
      console.error('Error adding category to Firestore:', error);
      return newCategory;
    }
  },

  async updateCategory(id: string, name: string, image?: string): Promise<Category> {
    const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
    const updatedCategory: Category = { id, name, slug };
    if (image !== undefined) {
      updatedCategory.image = image;
    }
    try {
      await setDoc(doc(db, 'categories', id), updatedCategory);
      return updatedCategory;
    } catch (error) {
      console.error('Error updating category in Firestore:', error);
      throw error;
    }
  },

  async deleteCategory(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'categories', id));
      return true;
    } catch (error) {
      console.error('Error deleting category from Firestore:', error);
      return false;
    }
  },

  // --- PRODUCTS ---
  async getProducts(): Promise<Product[]> {
    try {
      const colRef = collection(db, 'products');
      const snapshot = await getDocs(colRef);

      if (snapshot.empty) {
        // Seed initial products
        try {
          for (const prod of INITIAL_PRODUCTS) {
            await setDoc(doc(db, 'products', prod.id), prod);
          }
        } catch (seedError) {
          console.warn('Skipping product seeding due to insufficient permissions:', seedError);
        }
        return INITIAL_PRODUCTS;
      }

      const products: Product[] = [];
      snapshot.forEach((doc) => {
        products.push(doc.data() as Product);
      });

      const seen = new Set<string>();
      return products.filter(p => {
        if (!p.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
    } catch (error) {
      console.error('Error fetching products from Firestore:', error);
      return INITIAL_PRODUCTS;
    }
  },

  async saveProducts(products: Product[]): Promise<Product[]> {
    try {
      for (const prod of products) {
        await setDoc(doc(db, 'products', prod.id), prod);
      }
      return products;
    } catch (error) {
      console.error('Error saving products to Firestore:', error);
      return products;
    }
  },

  async addProduct(product: Omit<Product, 'id'>): Promise<Product> {
    const id = `prod-${Date.now()}`;
    const newProduct: Product = {
      ...product,
      id,
    };
    try {
      await setDoc(doc(db, 'products', id), newProduct);
      return newProduct;
    } catch (error) {
      console.error('Error adding product to Firestore:', error);
      return newProduct;
    }
  },

  async updateProduct(id: string, updatedProduct: Partial<Product>): Promise<Product> {
    try {
      const docRef = doc(db, 'products', id);
      await updateDoc(docRef, updatedProduct as Record<string, any>);
      const updatedSnap = await getDoc(docRef);
      return updatedSnap.data() as Product;
    } catch (error) {
      console.error('Error updating product in Firestore:', error);
      throw error;
    }
  },

  async deleteProduct(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'products', id));
      return true;
    } catch (error) {
      console.error('Error deleting product from Firestore:', error);
      return false;
    }
  },

  // --- ORDERS ---
  async getOrders(): Promise<Order[]> {
    try {
      const colRef = collection(db, 'orders');
      const snapshot = await getDocs(colRef);
      
      const orders: Order[] = [];
      snapshot.forEach((doc) => {
        orders.push(doc.data() as Order);
      });

      const seen = new Set<string>();
      const uniqueOrders = orders.filter(o => {
        if (!o.id || seen.has(o.id)) return false;
        seen.add(o.id);
        return true;
      });

      // Sort orders by date descending (newest first)
      return uniqueOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error fetching orders from Firestore:', error);
      return [];
    }
  },

  async saveOrders(orders: Order[]): Promise<Order[]> {
    try {
      for (const order of orders) {
        await setDoc(doc(db, 'orders', order.id), cleanUndefined(order));
      }
      return orders;
    } catch (error) {
      console.error('Error saving orders to Firestore:', error);
      return orders;
    }
  },

  async createOrder(orderData: Omit<Order, 'id' | 'createdAt' | 'status'>): Promise<Order> {
    const id = `PED-${Math.floor(100000 + Math.random() * 900000)}`;
    const newOrder: Order = {
      ...orderData,
      id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'orders', id), cleanUndefined(newOrder));
      return newOrder;
    } catch (error) {
      console.error('Error creating order in Firestore:', error);
      return newOrder;
    }
  },

  async updateOrderStatus(id: string, status: Order['status']): Promise<Order> {
    try {
      const docRef = doc(db, 'orders', id);
      const updates: any = { status };
      if (status === 'delivered') {
        updates.paymentStatus = 'paid';
        updates.statusPagamento = 'pago';
        updates.statusEntrega = 'entregue';
        updates.paidAt = new Date().toISOString();
      }
      await updateDoc(docRef, updates);
      const updatedSnap = await getDoc(docRef);
      return updatedSnap.data() as Order;
    } catch (error) {
      console.error('Error updating order status in Firestore:', error);
      throw error;
    }
  },

  async updateOrder(id: string, updatedFields: Partial<Order>): Promise<Order> {
    try {
      const docRef = doc(db, 'orders', id);
      const fields = { ...updatedFields };
      if (fields.status === 'delivered' || fields.statusEntrega === 'entregue') {
        fields.paymentStatus = 'paid';
        fields.statusPagamento = 'pago';
        if (!fields.paidAt) {
          fields.paidAt = new Date().toISOString();
        }
      }
      await updateDoc(docRef, cleanUndefined(fields));
      const updatedSnap = await getDoc(docRef);
      return updatedSnap.data() as Order;
    } catch (error) {
      console.error('Error updating order in Firestore:', error);
      throw error;
    }
  },

  // --- SETTINGS ---
  async getSettings(): Promise<RestaurantSettings> {
    try {
      const docRef = doc(db, 'settings', 'main');
      const snap = await getDoc(docRef);
      
      if (!snap.exists()) {
        try {
          await setDoc(docRef, DEFAULT_SETTINGS);
        } catch (seedError) {
          console.warn('Skipping settings seeding due to insufficient permissions:', seedError);
        }
        return DEFAULT_SETTINGS;
      }
      
      const settings = snap.data() as RestaurantSettings;
      let shouldUpdate = false;
      if (settings.name === 'Gourmet Bistro') {
        settings.name = 'Maestria Grill';
        settings.description = 'O autêntico sabor da brasa com carnes nobres grelhadas com perfeição e paixão em servir.';
        settings.logoUrl = '🥩';
        settings.bannerUrl = restaurantBanner;
        shouldUpdate = true;
      }
      
      if (!settings.bannerUrl || !settings.bannerUrl.includes('restaurant_banner_1783985102418')) {
        settings.bannerUrl = restaurantBanner;
        shouldUpdate = true;
      }

      if (shouldUpdate) {
        try {
          await setDoc(docRef, settings);
        } catch (updateError) {
          console.warn('Skipping settings update due to insufficient permissions:', updateError);
        }
      }
      return settings;
    } catch (error) {
      console.error('Error fetching settings from Firestore:', error);
      return DEFAULT_SETTINGS;
    }
  },

  async saveSettings(settings: RestaurantSettings): Promise<RestaurantSettings> {
    try {
      const docRef = doc(db, 'settings', 'main');
      await setDoc(docRef, settings);
      return settings;
    } catch (error) {
      console.error('Error saving settings to Firestore:', error);
      return settings;
    }
  },

  // --- USERS MANAGEMENT ---
  async getUsers(): Promise<UserProfile[]> {
    try {
      const colRef = collection(db, 'users');
      const snapshot = await getDocs(colRef);
      const users: UserProfile[] = [];
      snapshot.forEach((doc) => {
        users.push(doc.data() as UserProfile);
      });
      return users;
    } catch (error) {
      console.error('Error fetching users from Firestore:', error);
      handleFirestoreError(error, OperationType.LIST, 'users');
      return [];
    }
  },

  async updateUserProfile(uid: string, fields: Partial<UserProfile>): Promise<void> {
    try {
      const docRef = doc(db, 'users', uid);
      await updateDoc(docRef, cleanUndefined(fields));
    } catch (error) {
      console.error('Error updating user profile in Firestore:', error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  },
};
