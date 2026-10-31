"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  createBrowserApi,
  getToken,
  isMaintenanceError,
  setToken,
  type Entitlements,
  type UserPublic,
} from "@/lib/api";
import { connectMaintenance, refetchMaintenance, useMaintenance } from "@/lib/maintenance";

type AuthContextValue = {
  user: UserPublic | null;
  entitlements: Entitlements | null;
  loading: boolean;
  /**
   * The host is in maintenance (live over WebSocket). Stays true after it ends until
   * the session is restored, so the playground never sees a signed-out gap.
   */
  maintenance: boolean;
  /** Re-check maintenance now; resolves to true while it is still on. */
  checkMaintenance: () => Promise<boolean>;
  login: (email: string, password: string, turnstileToken?: string) => Promise<void>;
  signup: (email: string, password: string, name?: string, turnstileToken?: string) => Promise<{ emailSent: boolean }>;
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
  const [maintenance, setMaintenance] = useState(false);
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
      // Maintenance is not a sign-out: keep the token, the user and their workspace.
      if (isMaintenanceError(e)) {
        setMaintenance(true);
        return;
      }
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

  const maintenanceRef = useRef(false);
  useEffect(() => {
    maintenanceRef.current = maintenance;
  }, [maintenance]);

  // Live status: show maintenance the moment it starts; when it ends, restore the session first.
  useEffect(() => {
    connectMaintenance();
    return useMaintenance.subscribe((state) => {
      if (!state.status) return;
      if (state.status.active) setMaintenance(true);
      else if (maintenanceRef.current) void refresh().finally(() => setMaintenance(false));
    });
  }, [refresh]);

  const checkMaintenance = useCallback(async () => {
    const status = await refetchMaintenance();
    return status?.active ?? maintenanceRef.current;
  }, []);

  const login = useCallback(
    async (email: string, password: string, turnstileToken?: string) => {
      const res = await api.login({ email, password, turnstileToken });
      setToken(res.token);
      setUser(res.user);
      setEntitlements(res.entitlements);
    },
    [api],
  );

  const signup = useCallback(
    async (email: string, password: string, name?: string, turnstileToken?: string) => {
      const res = await api.signup({ email, password, name, turnstileToken });
      setToken(res.token);
      setUser(res.user);
      setEntitlements(res.entitlements);
      return { emailSent: res.emailSent !== false };
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
      maintenance,
      checkMaintenance,
      login,
      signup,
      logout,
      refresh,
      checkout,
      portal,
    }),
    [user, entitlements, loading, maintenance, checkMaintenance, login, signup, logout, refresh, checkout, portal],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
