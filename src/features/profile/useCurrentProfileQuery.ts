import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase/client';

export const profileQueryKeys = {
  current: (userId: string) => ['profile', 'current', userId] as const,
};

export function useCurrentProfileQuery(userId: string) {
  return useQuery({
    queryKey: profileQueryKeys.current(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, display_name, platform_role, preferred_locale')
        .eq('id', userId)
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
  });
}
