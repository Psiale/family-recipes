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
