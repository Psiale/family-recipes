import { getSupabaseClient } from '@/lib/supabase/client';

export async function listMyManagers() {
  const { data, error } = await getSupabaseClient().rpc(
    'list_my_person_managers',
  );
  if (error) throw error;
  return data;
}
export type ManagerChange = {
  managerUserId: string;
  familyId?: string;
  enabled: boolean;
  expectedEnabled: boolean;
};
export async function setPersonManager(values: ManagerChange) {
  const { error } = await getSupabaseClient().rpc('set_person_manager', {
    p_manager_user_id: values.managerUserId,
    ...(values.familyId ? { p_family_id: values.familyId } : {}),
    p_enabled: values.enabled,
    p_expected_enabled: values.expectedEnabled,
  });
  if (error) throw error;
}
