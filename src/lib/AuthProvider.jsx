import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, clearSession, getSession, onUnauthorized, saveSession } from "./api";
import { AuthContext, useAuth } from "./auth-context";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getSession());
  const [expired, setExpired] = useState(false);

  useEffect(
    () =>
      onUnauthorized(() => {
        setSession(null);
        setExpired(true);
      }),
    [],
  );

  // Sign out automatically when the token's lifetime ends.
  useEffect(() => {
    if (!session) return undefined;
    const remaining = session.expiresAt * 1000 - Date.now();
    const timer = setTimeout(() => {
      clearSession();
      setSession(null);
      setExpired(true);
    }, Math.max(0, Math.min(remaining, 2 ** 31 - 1)));
    return () => clearTimeout(timer);
  }, [session]);

  const login = useCallback(async (username, password) => {
    const data = await api("/api/auth/login", { method: "POST", json: { username, password }, auth: false });
    const next = { token: data.token, username: data.username, expiresAt: data.expires_at };
    saveSession(next);
    setExpired(false);
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setExpired(false);
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, expired, login, logout }), [session, expired, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function RequireAuth({ children }) {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/admin/login?next=${next}`} replace />;
  }
  return children;
}
