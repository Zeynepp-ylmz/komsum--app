import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { login as loginRequest, register as registerRequest, RegisterPayload } from '../../api/auth';
import { setAuthorizationToken, setUnauthorizedHandler } from '../../api/client';
import { registerPushNotifications, resetPushNotificationRegistration } from '../../services/pushNotifications';
import { clearTokens, getAccessToken, setTokens } from '../../services/tokenStorage';

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = async () => {
    resetPushNotificationRegistration();
    await clearTokens();
    setAuthorizationToken(null);
    setIsAuthenticated(false);
  };

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = await getAccessToken();
        setAuthorizationToken(token);
        setIsAuthenticated(Boolean(token));
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void registerPushNotifications();
  }, [isAuthenticated]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const authData = await loginRequest({ email, password });
      await setTokens(authData.access_token, authData.refresh_token);
      setAuthorizationToken(authData.access_token);
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    await registerRequest(payload);
  };

  const logout = async () => {
    await clearSession();
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
