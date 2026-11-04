import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import * as ExpoLinking from 'expo-linking';
import type { PropsWithChildren } from 'react';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { getSupabaseClient } from '@/lib/supabase/client';

import { readAuthCallback, recoveryStorageKey } from '../recovery';

export type RecoveryMode = 'request' | 'update' | 'invalid' | 'complete' | null;

export type SignUpResult = {
  status: 'confirmationRequired' | 'existingAccount' | 'signedIn';
};

type SessionContextValue = {
  isLoading: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  recoveryMode: RecoveryMode;
  startPasswordRecovery: () => void;
  cancelPasswordRecovery: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updateRecoveredPassword: (password: string) => Promise<void>;
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
  const [isProcessingLink, setIsProcessingLink] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<RecoveryMode>(null);
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const recoveryUserRef = useRef<string | null>(null);
  const authRevision = useRef(0);
  const markerRevision = useRef(0);
  const storageWrites = useRef(Promise.resolve());
  const handledCodes = useRef(new Set<string>());

  const rememberRecovery = useCallback((userId: string | null) => {
    recoveryUserRef.current = userId;
    markerRevision.current += 1;
    setRecoveryUserId(userId);
    storageWrites.current = storageWrites.current
      .then(() =>
        userId
          ? AsyncStorage.setItem(recoveryStorageKey, userId)
          : AsyncStorage.removeItem(recoveryStorageKey),
      )
      .catch(() => logger.warn('Unable to save password recovery progress.'));
    return storageWrites.current;
  }, []);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseClient();
    const startingAuthRevision = authRevision.current;
    const startingMarkerRevision = markerRevision.current;

    void Promise.all([
      supabase.auth.getSession(),
      AsyncStorage.getItem(recoveryStorageKey).catch(() => null),
    ])
      .then(([{ data }, savedRecoveryUser]) => {
        if (isMounted) {
          const currentSession =
            authRevision.current === startingAuthRevision
              ? data.session
              : sessionRef.current;
          sessionRef.current = currentSession;
          setSession(currentSession);
          if (
            markerRevision.current === startingMarkerRevision &&
            savedRecoveryUser &&
            savedRecoveryUser === currentSession?.user.id
          ) {
            recoveryUserRef.current = savedRecoveryUser;
            setRecoveryUserId(savedRecoveryUser);
            setRecoveryMode('update');
          }
        }
      })
      .catch(() => logger.warn('Unable to restore the Supabase session.'))
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;
      if (
        event === 'INITIAL_SESSION' &&
        authRevision.current !== startingAuthRevision
      )
        return;
      authRevision.current += 1;
      sessionRef.current = nextSession;
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY' && nextSession) {
        void rememberRecovery(nextSession.user.id);
        setRecoveryMode('update');
      } else if (
        event === 'SIGNED_OUT' ||
        (recoveryUserRef.current &&
          nextSession &&
          recoveryUserRef.current !== nextSession.user.id)
      ) {
        void rememberRecovery(null);
        setRecoveryMode(null);
      }
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [rememberRecovery]);

  useEffect(() => {
    const supabase = getSupabaseClient();

    const exchangeConfirmationCode = async (url: string | null | undefined) => {
      if (!url) {
        return;
      }

      const callback = readAuthCallback(url, ExpoLinking.createURL('sign-in'));
      if (!callback) return;
      if ('error' in callback) {
        setRecoveryMode('invalid');
        return;
      }
      if (handledCodes.current.has(callback.code)) return;
      handledCodes.current.add(callback.code);
      setIsProcessingLink(true);
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(
          callback.code,
        );
        if (error) {
          setRecoveryMode('invalid');
          logger.warn('Unable to verify authentication link.', {
            code: error.code,
          });
        }
      } catch {
        setRecoveryMode('invalid');
        logger.warn('Unable to verify authentication link.');
      } finally {
        setIsProcessingLink(false);
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

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await getSupabaseClient().auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        throw error;
      }
      await rememberRecovery(null);
      setRecoveryMode(null);
    },
    [rememberRecovery],
  );

  const startPasswordRecovery = useCallback(
    () => setRecoveryMode('request'),
    [],
  );
  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
      email,
      {
        redirectTo: ExpoLinking.createURL('sign-in'),
      },
    );
    if (error && error.code !== 'user_not_found') throw error;
  }, []);

  const updateRecoveredPassword = useCallback(
    async (password: string) => {
      if (!session || recoveryUserId !== session.user.id)
        throw new Error('Verified recovery session required');
      const { error } = await getSupabaseClient().auth.updateUser({ password });
      if (error) throw error;
      await rememberRecovery(null);
      setRecoveryMode('complete');
    },
    [session, recoveryUserId, rememberRecovery],
  );

  const cancelPasswordRecovery = useCallback(async () => {
    if (recoveryUserRef.current) {
      const { error } = await getSupabaseClient().auth.signOut({
        scope: 'local',
      });
      if (error) throw error;
    }
    await rememberRecovery(null);
    setRecoveryMode(null);
  }, [rememberRecovery]);

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
          emailRedirectTo: ExpoLinking.createURL('sign-in'),
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
    () => ({
      isLoading: isLoading || isProcessingLink,
      session,
      signIn,
      signOut,
      signUp,
      recoveryMode,
      startPasswordRecovery,
      cancelPasswordRecovery,
      requestPasswordReset,
      updateRecoveredPassword,
    }),
    [
      isLoading,
      isProcessingLink,
      session,
      signIn,
      signOut,
      signUp,
      recoveryMode,
      startPasswordRecovery,
      cancelPasswordRecovery,
      requestPasswordReset,
      updateRecoveredPassword,
    ],
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
