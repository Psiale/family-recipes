import { useRouter } from 'expo-router';

import { WelcomeGuide } from '@/features/onboarding/components/WelcomeGuide';

export default function HowToUseScreen() {
  const router = useRouter();
  return <WelcomeGuide onFinish={() => router.navigate('/')} />;
}
