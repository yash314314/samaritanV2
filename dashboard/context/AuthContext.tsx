"use client";

import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import {
  currentUser,
  linkDesktopTracker,
  login as signIn,
  logout as signOut,
  logoutEverywhere as signOutEverywhere,
  register as signUp,
  restoreSession,
  subscribeAuth,
  type AuthUser,
} from "../lib/auth";

export type User = AuthUser;

interface AuthContextType {
  user: User | null;
  /** True until the first session restore attempt has finished. */
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutEverywhere: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const user = useSyncExternalStore(subscribeAuth, currentUser, () => null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    restoreSession().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Inside the Electron app, keep the tracker recording for whoever is signed in.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    linkDesktopTracker().catch((error: Error) => console.warn("[Auth] Desktop tracker link failed:", error.message));
  }, [userId]);

  const value: AuthContextType = {
    user,
    loading,
    login: async (email, pass) => {
      await signIn(email, pass);
    },
    register: async (name, email, pass) => {
      await signUp(name, email, pass);
    },
    logout: signOut,
    logoutEverywhere: signOutEverywhere,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
