import { Screen } from '@/components/Screen';
import { useSession } from '@/features/auth/providers/SessionProvider';
import { FamilyWorkspace } from '@/features/families/components/FamilyWorkspace';

export default function FamilyTreeScreen() {
  const { session } = useSession();
  return (
    <Screen>
      <FamilyWorkspace key={session!.user.id} userId={session!.user.id} />
    </Screen>
  );
}
