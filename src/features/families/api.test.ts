import { getSupabaseClient } from '@/lib/supabase/client';

import {
  adminRenamePerson,
  adminRemoveFamilyMember,
  claimPerson,
  createFamilyRelationship,
  createFamily,
  createManagedPerson,
  deleteFamilyRelationship,
  issueClaim,
  onboardPerson,
  changeFamilyRole,
  removeFamilyMember,
  transferFamilyOwnership,
} from './api';

jest.mock('@/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));
const rpc = jest.fn();
beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: 'result-id', error: null });
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue({ rpc } as unknown as ReturnType<
      typeof getSupabaseClient
    >);
});

it('uses the atomic RPCs without accepting a user ID, owner ID or family role', async () => {
  await expect(onboardPerson({ name: 'Alex', description: '' })).resolves.toBe(
    'result-id',
  );
  expect(rpc).toHaveBeenLastCalledWith('onboard_person', {
    p_display_name: 'Alex',
    p_biography: '',
  });
  await createFamily({ name: 'Family', description: 'Story' });
  expect(rpc).toHaveBeenLastCalledWith('create_family', {
    p_name: 'Family',
    p_description: 'Story',
  });
  await createManagedPerson({
    name: 'Grandma',
    description: '',
    familyId: 'family-id',
  });
  expect(rpc).toHaveBeenLastCalledWith('create_managed_person', {
    p_family_id: 'family-id',
    p_display_name: 'Grandma',
    p_biography: '',
  });
  await issueClaim({ personId: 'person-id', email: 'person@example.com' });
  expect(rpc).toHaveBeenLastCalledWith('issue_person_claim', {
    p_person_id: 'person-id',
    p_email: 'person@example.com',
  });
  await claimPerson('token');
  expect(rpc).toHaveBeenLastCalledWith('claim_managed_person', {
    p_token: 'token',
  });
  await createFamilyRelationship({
    familyId: 'family-id',
    fromPersonId: 'parent-id',
    kind: 'PARENT_CHILD',
    toPersonId: 'child-id',
  });
  expect(rpc).toHaveBeenLastCalledWith('create_family_relationship', {
    p_family_id: 'family-id',
    p_from_person_id: 'parent-id',
    p_kind: 'PARENT_CHILD',
    p_to_person_id: 'child-id',
  });
  await deleteFamilyRelationship('relationship-id');
  expect(rpc).toHaveBeenLastCalledWith('delete_family_relationship', {
    p_relationship_id: 'relationship-id',
  });
});

it('propagates database denial rather than returning success data', async () => {
  const error = { code: '42501' };
  rpc.mockResolvedValue({ data: null, error });
  await expect(
    createFamily({ name: 'Family', description: '' }),
  ).rejects.toEqual(error);
});

it('binds role changes to the family, target and previously observed role', async () => {
  await changeFamilyRole({
    familyId: 'family',
    personId: 'person',
    role: 'ADMIN',
    expectedRole: 'MEMBER',
  });
  expect(rpc).toHaveBeenLastCalledWith('change_family_role', {
    p_family_id: 'family',
    p_person_id: 'person',
    p_role: 'ADMIN',
    p_expected_role: 'MEMBER',
  });
  const error = { code: 'PT409' };
  rpc.mockResolvedValue({ data: null, error });
  await expect(
    changeFamilyRole({
      familyId: 'family',
      personId: 'person',
      role: 'ADMIN',
      expectedRole: 'MEMBER',
    }),
  ).rejects.toEqual(error);
});

it.each([
  [removeFamilyMember, 'remove_family_member'],
  [transferFamilyOwnership, 'transfer_family_ownership'],
] as const)(
  'binds membership RPCs to the family and expected role',
  async (action, name) => {
    await action({
      familyId: 'family',
      personId: 'person',
      expectedRole: 'ADMIN',
    });
    expect(rpc).toHaveBeenLastCalledWith(name, {
      p_family_id: 'family',
      p_person_id: 'person',
      p_expected_role: 'ADMIN',
    });
    rpc.mockResolvedValue({ error: { code: 'PT409' } });
    await expect(
      action({ familyId: 'family', personId: 'person', expectedRole: 'ADMIN' }),
    ).rejects.toEqual({ code: 'PT409' });
  },
);

it('sends immutable confirmation snapshots and reasons to dedicated admin RPCs', async () => {
  await adminRenamePerson({
    personId: 'person',
    expectedName: 'Ana',
    expectedUpdatedAt: 'person-version',
    name: 'Anita',
    reason: 'Correction',
  });
  expect(rpc).toHaveBeenLastCalledWith('admin_rename_person', {
    p_person_id: 'person',
    p_expected_name: 'Ana',
    p_expected_updated_at: 'person-version',
    p_display_name: 'Anita',
    p_reason: 'Correction',
  });
  await adminRemoveFamilyMember({
    personId: 'person',
    familyId: 'family',
    expectedRole: 'OWNER',
    expectedUpdatedAt: 'member-version',
    expectedName: 'Ana',
    expectedFamilyName: 'Luna',
    reason: 'Correction',
  });
  expect(rpc).toHaveBeenLastCalledWith('admin_remove_family_member', {
    p_family_id: 'family',
    p_person_id: 'person',
    p_expected_role: 'OWNER',
    p_expected_updated_at: 'member-version',
    p_expected_name: 'Ana',
    p_expected_family_name: 'Luna',
    p_reason: 'Correction',
  });
  rpc.mockResolvedValue({ error: { code: '42501' } });
  await expect(
    adminRenamePerson({
      personId: 'person',
      expectedName: 'Ana',
      expectedUpdatedAt: 'version',
      name: 'Anita',
      reason: 'Correction',
    }),
  ).rejects.toEqual({ code: '42501' });
});
