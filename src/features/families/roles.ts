import type { EditableFamilyRole, FamilyRole } from './api';

export function allowedFamilyRoles(
  actorRole: FamilyRole,
  targetRole: FamilyRole,
): EditableFamilyRole[] {
  if (targetRole === 'OWNER') return [];
  if (actorRole === 'OWNER') return ['MEMBER', 'READ_ONLY', 'ADMIN'];
  if (actorRole === 'ADMIN' && targetRole !== 'ADMIN')
    return ['MEMBER', 'READ_ONLY'];
  return [];
}

export function canRemoveFamilyMember(
  actorRole: FamilyRole,
  targetRole: FamilyRole,
) {
  return (
    targetRole !== 'OWNER' &&
    (actorRole === 'OWNER' || (actorRole === 'ADMIN' && targetRole !== 'ADMIN'))
  );
}

export function canTransferFamilyOwnership(
  actorRole: FamilyRole,
  targetRole: FamilyRole,
  targetUserId: string | null,
  actorUserId: string,
) {
  return (
    actorRole === 'OWNER' &&
    targetRole !== 'OWNER' &&
    targetUserId !== null &&
    targetUserId !== actorUserId
  );
}
