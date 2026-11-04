import { canRemoveFamilyMember, canTransferFamilyOwnership } from './roles';

it('restricts removal to the established management hierarchy', () => {
  for (const target of ['OWNER', 'ADMIN', 'MEMBER', 'READ_ONLY'] as const) {
    expect(canRemoveFamilyMember('OWNER', target)).toBe(target !== 'OWNER');
    expect(canRemoveFamilyMember('ADMIN', target)).toBe(
      target === 'MEMBER' || target === 'READ_ONLY',
    );
    expect(canRemoveFamilyMember('MEMBER', target)).toBe(false);
    expect(canRemoveFamilyMember('READ_ONLY', target)).toBe(false);
  }
});
it('requires another linked non-owner for ownership transfer', () => {
  expect(
    canTransferFamilyOwnership('OWNER', 'MEMBER', 'recipient', 'actor'),
  ).toBe(true);
  expect(canTransferFamilyOwnership('OWNER', 'MEMBER', null, 'actor')).toBe(
    false,
  );
  expect(
    canTransferFamilyOwnership('OWNER', 'OWNER', 'recipient', 'actor'),
  ).toBe(false);
  expect(canTransferFamilyOwnership('OWNER', 'MEMBER', 'actor', 'actor')).toBe(
    false,
  );
  expect(
    canTransferFamilyOwnership('ADMIN', 'MEMBER', 'recipient', 'actor'),
  ).toBe(false);
});
