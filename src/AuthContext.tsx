import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { signIn as apiSignIn, signUp as apiSignUp, signOut as apiSignOut, type User } from "./api";

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<string | null>;
  register: (username: string, email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "racemate_auth";

function loadSession(): { user: User; token: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.user?.id && parsed?.token) return parsed;
  } catch {
    /* corrupted storage */
  }
  return null;
}

function saveSession(user: User, token: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
  });

  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setState({ user: saved.user, token: saved.token, loading: false });
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  const login = async (email: string, password: string): Promise<string | null> => {
    const res = await apiSignIn(email, password);
    if (res.token && res.user) {
      saveSession(res.user, res.token);
      setState({ user: res.user, token: res.token, loading: false });
      return null;
    }
    return res.message || "Sign in failed";
  };

  const register = async (
    username: string,
    email: string,
    password: string
  ): Promise<string | null> => {
    const res = await apiSignUp(username, email, password);
    if (res.message === "duplicate email") {
      return "An account with this email already exists";
    }
    if (res.user) {
      // Auto sign-in after registration
      return login(email, password);
    }
    return res.message || "Sign up failed";
  };

  const logout = async () => {
    if (state.user && state.token) {
      try {
        await apiSignOut(state.user.id, state.token);
      } catch {
        /* sign out best-effort */
      }
    }
    clearSession();
    setState({ user: null, token: null, loading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
