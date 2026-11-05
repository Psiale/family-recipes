import { useIsFocused } from 'expo-router';

import { useSession } from '@/features/auth/providers/SessionProvider';
import { FamilyAdministration } from '@/features/families/components/FamilyAdministration';

export default function FamilyAdministrationRoute() {
  const { session } = useSession();
  const focused = useIsFocused();
  if (!focused || !session) return null;
  return (
    <FamilyAdministration key={session.user.id} userId={session.user.id} />
  );
}
