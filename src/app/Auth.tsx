import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { api, supabase } from './api';
import type { Role } from '../../shared/types';
interface AuthState {
  session: Session | null;
  role: Role | null;
  loading: boolean;
  logout: () => Promise<void>;
}
const Auth = createContext<AuthState>({
  session: null,
  role: null,
  loading: true,
  logout: async () => {},
});
export const useAuth = () => useContext(Auth);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, value) => {
      setSession(value);
      setRole(null);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    if (session)
      void api<{ role: Role }>('/me')
        .then((value) => {
          if (active) setRole(value.role);
        })
        .catch(() => {
          if (active) setRole(null);
        });
    return () => {
      active = false;
    };
  }, [session]);
  return (
    <Auth.Provider
      value={{
        session,
        role,
        loading,
        logout: async () => {
          const result = await supabase?.auth.signOut();
          if (result?.error) throw result.error;
          setSession(null);
          setRole(null);
        },
      }}
    >
      {children}
    </Auth.Provider>
  );
}
