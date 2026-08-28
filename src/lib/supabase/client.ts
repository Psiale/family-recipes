import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import { getPublicEnv, type PublicEnv } from '@/config/env';

import type { Database } from './database.types';

export function createSupabaseClient(env: PublicEnv) {
  return createClient<Database>(
    env.EXPO_PUBLIC_SUPABASE_URL,
    env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        lock: processLock,
        persistSession: true,
      },
    },
  );
}

export type SupabaseClient = ReturnType<typeof createSupabaseClient>;

let client: SupabaseClient | undefined;

export function getSupabaseClient() {
  client ??= createSupabaseClient(getPublicEnv());
  return client;
}
