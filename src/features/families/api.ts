import { getSupabaseClient } from '@/lib/supabase/client';
import type { Enums, Tables } from '@/lib/supabase/database.types';

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
    .select(
      'role, family:families!inner(id, name, description, created_at, created_by_user_id)',
    )
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
export type FamilyPerson = Awaited<ReturnType<typeof listFamilyPeople>>[number];

export type FamilyRole = Enums<'family_role'>;
export type EditableFamilyRole = Exclude<FamilyRole, 'OWNER'>;
export type RoleChangeValues = {
  familyId: string;
  personId: string;
  role: EditableFamilyRole;
  expectedRole: FamilyRole;
};

export async function changeFamilyRole({
  familyId,
  personId,
  role,
  expectedRole,
}: RoleChangeValues) {
  const { error } = await getSupabaseClient().rpc('change_family_role', {
    p_family_id: familyId,
    p_person_id: personId,
    p_role: role,
    p_expected_role: expectedRole,
  });
  if (error) throw error;
}

export async function listFamilyRelationships(familyId: string) {
  const { data, error } = await getSupabaseClient()
    .from('family_relationships')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at');
  if (error) throw error;
  return data;
}
export type FamilyRelationship = Awaited<
  ReturnType<typeof listFamilyRelationships>
>[number];

export type RelationshipValues = {
  familyId: string;
  fromPersonId: string;
  kind: Enums<'family_relationship_kind'>;
  toPersonId: string;
};

export async function createFamilyRelationship({
  familyId,
  fromPersonId,
  kind,
  toPersonId,
}: RelationshipValues) {
  const { data, error } = await getSupabaseClient().rpc(
    'create_family_relationship',
    {
      p_family_id: familyId,
      p_from_person_id: fromPersonId,
      p_kind: kind,
      p_to_person_id: toPersonId,
    },
  );
  if (error) throw error;
  return data;
}

export async function deleteFamilyRelationship(relationshipId: string) {
  const { error } = await getSupabaseClient().rpc(
    'delete_family_relationship',
    { p_relationship_id: relationshipId },
  );
  if (error) throw error;
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

export type MembershipChangeValues = {
  familyId: string;
  personId: string;
  expectedRole: FamilyRole;
};

export async function removeFamilyMember({
  familyId,
  personId,
  expectedRole,
}: MembershipChangeValues) {
  const { error } = await getSupabaseClient().rpc('remove_family_member', {
    p_family_id: familyId,
    p_person_id: personId,
    p_expected_role: expectedRole,
  });
  if (error) throw error;
}

export async function transferFamilyOwnership({
  familyId,
  personId,
  expectedRole,
}: MembershipChangeValues) {
  const { error } = await getSupabaseClient().rpc('transfer_family_ownership', {
    p_family_id: familyId,
    p_person_id: personId,
    p_expected_role: expectedRole,
  });
  if (error) throw error;
}

export async function listFamilyBranches(familyId: string) {
  const { data, error } = await getSupabaseClient()
    .from('branches')
    .select('*, branch_memberships(person_id)')
    .eq('family_id', familyId)
    .order('name');
  if (error) throw error;
  return data;
}
export async function createFamilyBranch({
  familyId,
  name,
  description,
}: DetailsValues & { familyId: string }) {
  const { data, error } = await getSupabaseClient().rpc(
    'create_family_branch',
    {
      p_family_id: familyId,
      p_name: name,
      p_description: description,
    },
  );
  if (error) throw error;
  return data;
}
export async function setBranchMembership({
  familyId,
  branchId,
  personId,
  isMember,
  expectedMember,
}: {
  familyId: string;
  branchId: string;
  personId: string;
  isMember: boolean;
  expectedMember: boolean;
}) {
  const { error } = await getSupabaseClient().rpc('set_branch_membership', {
    p_family_id: familyId,
    p_branch_id: branchId,
    p_person_id: personId,
    p_is_member: isMember,
    p_expected_member: expectedMember,
  });
  if (error) throw error;
}

export type LifecycleAction =
  'leave' | 'request' | 'cancel' | 'approve' | 'delete';
export async function isSuperAdmin(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('app_users')
    .select('platform_role')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data.platform_role === 'SUPER_ADMIN';
}
export async function listDeletionRequests(familyId?: string) {
  const query = getSupabaseClient()
    .from('family_deletion_requests')
    .select('*, family:families!inner(id, name)')
    .order('created_at');
  const { data, error } = await (familyId
    ? query.eq('family_id', familyId)
    : query);
  if (error) throw error;
  return data;
}
export type FamilyDeletionRequest = Awaited<
  ReturnType<typeof listDeletionRequests>
>[number];

export async function getFamilyLifecycle(userId: string) {
  const [superAdmin, requests] = await Promise.all([
    isSuperAdmin(userId),
    listDeletionRequests(),
  ]);
  return { superAdmin, requests };
}

export const directoryPageSize = 25;
export async function searchFamilies(name: string, page: number) {
  const start = page * directoryPageSize;
  const query = getSupabaseClient()
    .from('families')
    .select('id,name,description,created_at,created_by_user_id')
    .order('name')
    .order('id')
    .range(start, start + directoryPageSize);
  // PostgreSQL's ***= prefix treats the rest as literal text, including '*',
  // which PostgREST otherwise interprets as a wildcard in an ilike filter.
  if (name) query.regexIMatch('name', `***=${name}`);
  const { data, error } = await query;
  if (error) throw error;
  return {
    families: data.slice(0, directoryPageSize),
    more: data.length > directoryPageSize,
  };
}
export type DirectoryFamily = Awaited<
  ReturnType<typeof searchFamilies>
>['families'][number];
export async function familyLifecycleAction({
  familyId,
  action,
  requestId,
  confirmName,
}: {
  familyId: string;
  action: LifecycleAction;
  requestId?: string | undefined;
  confirmName?: string | undefined;
}) {
  const { data, error } = await getSupabaseClient().rpc(
    'family_lifecycle_action',
    {
      p_family_id: familyId,
      p_action: action,
      ...(requestId === undefined ? {} : { p_request_id: requestId }),
      ...(confirmName === undefined ? {} : { p_confirm_name: confirmName }),
    },
  );
  if (error) throw error;
  return data;
}
