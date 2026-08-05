"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  createBrowserApi,
  getToken,
  setToken,
  type Entitlements,
  type UserPublic,
} from "@/lib/api";

type AuthContextValue = {
  user: UserPublic | null;
  entitlements: Entitlements | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  checkout: () => Promise<void>;
  portal: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const api = useMemo(() => createBrowserApi(), []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setEntitlements(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.me();
      setUser(me.user);
      setEntitlements(me.entitlements);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setToken(null);
      }
      setUser(null);
      setEntitlements(null);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login({ email, password });
      setToken(res.token);
      setUser(res.user);
      setEntitlements(res.entitlements);
    },
    [api],
  );

  const signup = useCallback(
    async (email: string, password: string, name?: string) => {
      const res = await api.signup({ email, password, name });
      setToken(res.token);
      setUser(res.user);
      setEntitlements(res.entitlements);
    },
    [api],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(null);
    setEntitlements(null);
    try {
      const { useIDEStore } = await import("@/store/ide");
      useIDEStore.getState().clearWorkspace();
    } catch {
      /* ignore */
    }
  }, [api]);

  const checkout = useCallback(async () => {
    const res = await api.checkout();
    if (res.url) window.location.href = res.url;
  }, [api]);

  const portal = useCallback(async () => {
    const res = await api.portal();
    if (res.url) window.location.href = res.url;
  }, [api]);

  const value = useMemo(
    () => ({
      user,
      entitlements,
      loading,
      login,
      signup,
      logout,
      refresh,
      checkout,
      portal,
    }),
    [user, entitlements, loading, login, signup, logout, refresh, checkout, portal],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
