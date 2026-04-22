import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase, type SessionLike } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "caretaker" | "accountant" | "tenant";

type AppUser = SessionLike["user"];

interface AuthContextValue {
  user: AppUser | null;
  session: SessionLike | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  isStaff: boolean;
  hasRole: (role: AppRole) => boolean;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000";
const TOKEN_KEY = "nyumbaflow.access_token";

async function fetchMe() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<SessionLike | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshRoles = async () => {
    const me = await fetchMe();
    setRoles(((me?.roles ?? []) as AppRole[]));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setTimeout(() => refreshRoles(), 0);
      } else {
        setRoles([]);
      }
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      const existing = data.session;
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) await refreshRoles();
      setLoading(false);
    })();

    return () => sub.data.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    roles,
    loading,
    signOut: async () => { await supabase.auth.signOut(); },
    isStaff: roles.some((r) => ["admin", "manager", "caretaker", "accountant"].includes(r)),
    hasRole: (role) => roles.includes(role),
    refreshRoles,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
