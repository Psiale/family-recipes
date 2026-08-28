import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { logger } from '@/lib/logger';

import type { Family } from './api';

export const familyStorageKey = (userId: string) =>
  `family-recipes:active-family:${userId}`;

export function useFamilySelection(userId: string, families: Family[]) {
  const [saved, setSaved] = useState<{ ready: boolean; id: string | null }>({
    ready: false,
    id: null,
  });
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(familyStorageKey(userId))
      .then((id) => {
        if (active) setSaved({ ready: true, id });
      })
      .catch(() => {
        if (active) setSaved({ ready: true, id: null });
      });
    return () => {
      active = false;
    };
  }, [userId]);
  // A stale saved preference never authorizes an inaccessible family.
  const selected = saved.ready
    ? (families.find((family) => family.id === saved.id) ?? families[0] ?? null)
    : null;
  const select = (id: string) => {
    setSaved({ ready: true, id });
    void AsyncStorage.setItem(familyStorageKey(userId), id).catch(() => {
      logger.warn('Unable to persist selected family.');
    });
  };
  return { ready: saved.ready, selected, select };
}
