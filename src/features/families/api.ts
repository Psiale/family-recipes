import { getSupabaseClient } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';

export type Person = Tables<'people'>;
export type DetailsValues = { name: string; description: string };

export async function getCurrentPerson(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('people')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listFamilies(personId: string) {
  const { data, error } = await getSupabaseClient()
    .from('family_memberships')
    .select('role, family:families!inner(id, name, description)')
    .eq('person_id', personId)
    .eq('status', 'ACTIVE')
    .order('joined_at');
  if (error) throw error;
  return data.map(({ family, role }) => ({ ...family, role }));
}
export type Family = Awaited<ReturnType<typeof listFamilies>>[number];

export async function listFamilyPeople(userId: string, familyId: string) {
  const client = getSupabaseClient();
  const [members, managers] = await Promise.all([
    client
      .from('family_memberships')
      .select('role, person:people!inner(*)')
      .eq('family_id', familyId)
      .eq('status', 'ACTIVE')
      .order('joined_at'),
    client
      .from('person_managers')
      .select('person_id')
      .eq('manager_user_id', userId),
  ]);
  if (members.error) throw members.error;
  if (managers.error) throw managers.error;
  const managedIds = new Set(managers.data.map(({ person_id }) => person_id));
  return members.data.map(({ person, role }) => ({
    person,
    role,
    canIssueClaim: !person.user_id && managedIds.has(person.id),
  }));
}

export async function onboardPerson({ name, description }: DetailsValues) {
  const { data, error } = await getSupabaseClient().rpc('onboard_person', {
    p_display_name: name,
    p_biography: description,
  });
  if (error) throw error;
  return data;
}
export async function createFamily({ name, description }: DetailsValues) {
  const { data, error } = await getSupabaseClient().rpc('create_family', {
    p_name: name,
    p_description: description,
  });
  if (error) throw error;
  return data;
}
export async function createManagedPerson({
  familyId,
  name,
  description,
}: DetailsValues & { familyId: string }) {
  const { data, error } = await getSupabaseClient().rpc(
    'create_managed_person',
    {
      p_family_id: familyId,
      p_display_name: name,
      p_biography: description,
    },
  );
  if (error) throw error;
  return data;
}
export async function claimPerson(token: string) {
  const { data, error } = await getSupabaseClient().rpc(
    'claim_managed_person',
    { p_token: token },
  );
  if (error) throw error;
  return data;
}
export async function issueClaim({
  personId,
  email,
}: {
  personId: string;
  email: string;
}) {
  const { data, error } = await getSupabaseClient().rpc('issue_person_claim', {
    p_person_id: personId,
    p_email: email,
  });
  if (error) throw error;
  return data;
}
