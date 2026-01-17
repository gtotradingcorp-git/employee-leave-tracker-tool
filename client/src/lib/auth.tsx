import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { UserWithPtoCredits } from "@shared/schema";

interface AuthContextType {
  user: UserWithPtoCredits | null;
  isLoading: boolean;
  isProfileComplete: boolean;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserWithPtoCredits | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      await refreshUser();
      setIsLoading(false);
    };
    checkAuth();
  }, [refreshUser]);

  const logout = () => {
    window.location.href = "/api/logout";
  };

  const isProfileComplete = !!user?.isProfileComplete;

  return (
    <AuthContext.Provider value={{ user, isLoading, isProfileComplete, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
