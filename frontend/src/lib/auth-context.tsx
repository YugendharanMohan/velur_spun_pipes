import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type UserRole = "admin" | "customer";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  address?: string;
  role: UserRole;
}

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  register: (data: { email: string; password: string; name: string; phone?: string; address?: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Mock users for development — replace with Flask API calls when backend is deployed
const MOCK_USERS: (UserProfile & { password: string })[] = [
  { id: "admin-1", email: "admin@vsp.com", password: "admin123", name: "Admin User", role: "admin" },
  { id: "cust-1", email: "rajesh@example.com", password: "customer123", name: "Rajesh Kumar", phone: "9876543210", address: "Vellore, Tamil Nadu", role: "customer" },
  { id: "cust-2", email: "suresh@example.com", password: "customer123", name: "Suresh Builders", phone: "9845123456", address: "Chennai, Tamil Nadu", role: "customer" },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  });

  const login = useCallback(async (email: string, password: string, role: UserRole) => {
    setState((s) => ({ ...s, isLoading: true }));

    try {
      const endpoint = role === 'admin' ? '/api/login' : '/api/customer_login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || data.error || "Invalid email or password");
      }

      // Format response user data to match frontend UserProfile shape
      // Admin dashboard might not send back id, so fallback to generic
      // We also enforce the role that was requested
      const userProfile: UserProfile = {
        id: data.user?.id || `user-${Date.now()}`,
        email: data.user?.email || email,
        name: data.user?.name || (role === 'admin' ? 'Admin' : 'Customer'),
        phone: data.user?.phone,
        address: data.user?.address,
        role: role,
      };

      setState({ user: userProfile, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      setState((s) => ({ ...s, isLoading: false }));
      throw new Error(error.message || "Login failed");
    }
  }, []);

  const register = useCallback(async (data: { email: string; password: string; name: string; phone?: string; address?: string }) => {
    setState((s) => ({ ...s, isLoading: true }));

    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/customer_register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const resData = await res.json();

      if (!resData.success) {
        throw new Error(resData.message || resData.error || "Registration failed");
      }

      const newUser: UserProfile = {
        id: `cust-${Date.now()}`,
        email: data.email,
        name: data.name,
        phone: data.phone,
        address: data.address,
        role: "customer",
      };

      setState({ user: newUser, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      setState((s) => ({ ...s, isLoading: false }));
      throw new Error(error.message || "Registration failed");
    }
  }, []);

  const logout = useCallback(() => {
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
