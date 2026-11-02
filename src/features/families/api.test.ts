import { getSupabaseClient } from '@/lib/supabase/client';

import {
  claimPerson,
  createFamilyRelationship,
  createFamily,
  createManagedPerson,
  deleteFamilyRelationship,
  issueClaim,
  onboardPerson,
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
