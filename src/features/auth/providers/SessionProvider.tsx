import type { Session } from '@supabase/supabase-js';
import * as ExpoLinking from 'expo-linking';
import type { PropsWithChildren } from 'react';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { getSupabaseClient } from '@/lib/supabase/client';

export type SignUpResult = {
  status: 'confirmationRequired' | 'existingAccount' | 'signedIn';
};

type SessionContextValue = {
  isLoading: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    locale: 'en' | 'es',
  ) => Promise<SignUpResult>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseClient();

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (isMounted) {
          setSession(data.session);
        }
      })
      .catch(() => logger.warn('Unable to restore the Supabase session.'))
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();

    const exchangeConfirmationCode = async (url: string | null) => {
      if (!url) {
        return;
      }

      const code = ExpoLinking.parse(url).queryParams?.code;
      if (typeof code !== 'string') {
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        logger.warn('Unable to exchange email confirmation code.', {
          code: error.code,
        });
      }
    };

    void Linking.getInitialURL()
      .then(exchangeConfirmationCode)
      .catch(() => logger.warn('Unable to read the initial application URL.'));
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void exchangeConfirmationCode(url);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        getSupabaseClient().auth.startAutoRefresh();
      } else {
        getSupabaseClient().auth.stopAutoRefresh();
      }
    });

    return () => subscription.remove();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabaseClient().auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw error;
    }
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      locale: 'en' | 'es',
    ): Promise<SignUpResult> => {
      const { data, error } = await getSupabaseClient().auth.signUp({
        email,
        password,
        options: {
          data: { locale },
          emailRedirectTo: ExpoLinking.createURL('/sign-in'),
        },
      });

      if (error) {
        throw error;
      }

      if (data.user?.identities?.length === 0) {
        return { status: 'existingAccount' };
      }

      return { status: data.session ? 'signedIn' : 'confirmationRequired' };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) {
      throw error;
    }
  }, []);

  const value = useMemo(
    () => ({ isLoading, session, signIn, signOut, signUp }),
    [isLoading, session, signIn, signOut, signUp],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = use(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}
