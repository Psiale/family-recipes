import { useSession } from '@/features/auth/providers/SessionProvider';
import { RecipesWorkspace } from '@/features/recipes/RecipesWorkspace';

export default function RecipesScreen() {
  const { session } = useSession();
  return session ? (
    <RecipesWorkspace key={session.user.id} userId={session.user.id} />
  ) : null;
}
