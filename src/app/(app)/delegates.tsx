import { useSession } from '@/features/auth/providers/SessionProvider';
import { DelegationScreen } from '@/features/delegation/DelegationScreen';

export default function DelegatesRoute() {
  const { session } = useSession();
  return <DelegationScreen key={session!.user.id} userId={session!.user.id} />;
}
