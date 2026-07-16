import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { UserProfile, Address } from '../types';
import { cleanUndefined } from '../utils';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserAddress: (address: Address) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  isAuthOpen: boolean;
  setIsAuthOpen: (open: boolean) => void;
  updateProfile: (fields: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);

  // Fetch or create user profile in Firestore
  const fetchProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
      const docRef = doc(db, 'users', uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        // Automatic superadmin authorization for maestriagrill@gmail.com
        if (data.email && data.email.toLowerCase() === 'maestriagrill@gmail.com' && data.role !== 'superadmin') {
          const updatedProfile = { ...data, role: 'superadmin' as const };
          await updateDoc(docRef, { role: 'superadmin' });
          return updatedProfile;
        }
        // Automatic admin authorization for luansena.010@gmail.com
        if (data.email && data.email.toLowerCase() === 'luansena.010@gmail.com' && data.role !== 'admin') {
          const updatedProfile = { ...data, role: 'admin' as const };
          await updateDoc(docRef, { role: 'admin' });
          return updatedProfile;
        }
        return data;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
    return null;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userProfile = await fetchProfile(firebaseUser.uid);
        if (userProfile) {
          setProfile(userProfile);
        } else {
          // If profile doesn't exist, create fallback profile from auth state
          const isLuanSena = firebaseUser.email && firebaseUser.email.toLowerCase() === 'luansena.010@gmail.com';
          const isMaestriaGrill = firebaseUser.email && firebaseUser.email.toLowerCase() === 'maestriagrill@gmail.com';
          const newProfile: UserProfile = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'Cliente',
            email: firebaseUser.email || '',
            phone: firebaseUser.phoneNumber || '',
            createdAt: new Date().toISOString(),
            role: isMaestriaGrill ? 'superadmin' : (isLuanSena ? 'admin' : 'cliente'),
          };
          try {
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            setProfile(newProfile);
          } catch (e) {
            console.error('Error setting fallback profile:', e);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (name: string, email: string, phone: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const isLuanSena = email && email.toLowerCase() === 'luansena.010@gmail.com';
    const isMaestriaGrill = email && email.toLowerCase() === 'maestriagrill@gmail.com';
    const newProfile: UserProfile = {
      id: cred.user.uid,
      name,
      email,
      phone,
      createdAt: new Date().toISOString(),
      role: isMaestriaGrill ? 'superadmin' : (isLuanSena ? 'admin' : 'cliente'),
    };
    await setDoc(doc(db, 'users', cred.user.uid), newProfile);
    setProfile(newProfile);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
  };

  const updateUserAddress = async (address: Address) => {
    if (!user) return;
    const docRef = doc(db, 'users', user.uid);
    const cleanedAddress = cleanUndefined(address);
    await updateDoc(docRef, { address: cleanedAddress });
    setProfile((prev) => prev ? { ...prev, address: cleanedAddress } : null);
  };

  const updateProfile = async (fields: Partial<UserProfile>) => {
    if (!user) return;
    const docRef = doc(db, 'users', user.uid);
    await updateDoc(docRef, cleanUndefined(fields));
    setProfile((prev) => prev ? { ...prev, ...fields } : null);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const userProfile = await fetchProfile(cred.user.uid);
    if (userProfile) {
      setProfile(userProfile);
    } else {
      const isLuanSena = cred.user.email && cred.user.email.toLowerCase() === 'luansena.010@gmail.com';
      const isMaestriaGrill = cred.user.email && cred.user.email.toLowerCase() === 'maestriagrill@gmail.com';
      const newProfile: UserProfile = {
        id: cred.user.uid,
        name: cred.user.displayName || 'Cliente',
        email: cred.user.email || '',
        phone: cred.user.phoneNumber || '',
        createdAt: new Date().toISOString(),
        role: isMaestriaGrill ? 'superadmin' : (isLuanSena ? 'admin' : 'cliente'),
      };
      await setDoc(doc(db, 'users', cred.user.uid), newProfile);
      setProfile(newProfile);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        register,
        resetPassword,
        logout,
        updateUserAddress,
        loginWithGoogle,
        isAuthOpen,
        setIsAuthOpen,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
