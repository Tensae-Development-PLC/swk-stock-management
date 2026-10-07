"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authApi } from "@/lib/api/endpoints";
import { clearSession, getAccessToken, getRefreshToken, setSession } from "@/lib/auth/session";
import type { AuthUser } from "@/types/api";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (...codes: string[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (email, password, remember) => {
        const data = await authApi.login(email, password);
        setSession(data.accessToken, data.refreshToken, remember);
        setUser(data.user);
        router.replace("/dashboard");
      },
      logout: async () => {
        try {
          await authApi.logout(getRefreshToken() ?? undefined);
        } catch {
          /* still clear locally */
        }
        clearSession();
        setUser(null);
        router.replace("/login");
      },
      hasPermission: (...codes) => {
        if (!user) return false;
        if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
        return codes.every((c) => user.permissions.includes(c));
      },
    }),
    [user, loading, router],
  );

  useEffect(() => {
    if (loading) return;
    const isPublic = pathname === "/login" || pathname.startsWith("/receive");
    if (!user && !isPublic) router.replace("/login");
  }, [loading, user, pathname, router]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
