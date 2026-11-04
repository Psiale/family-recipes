import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Screen } from '@/components/Screen';
import { colors } from '@/components/theme';
import { logger } from '@/lib/logger';

import { WelcomeGuide } from './components/WelcomeGuide';

export const guideStorageKey = (userId: string) =>
  `family-recipes:welcome-guide:v1:${userId}`;

type Props = { userId: string; children: (openHelp: () => void) => ReactNode };

// Account changes remount the gate so another person's preference cannot leak
// into this account, including while an earlier storage read is still pending.
export function OnboardingGate(props: Props) {
  return <AccountGuide key={props.userId} {...props} />;
}

function AccountGuide({ userId, children }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'loading' | 'intro' | 'ready'>(
    'loading',
  );
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(guideStorageKey(userId))
      .then((seen) => {
        if (active) setStatus(seen === 'seen' ? 'ready' : 'intro');
      })
      .catch(() => {
        if (active) setStatus('intro');
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const finish = () => {
    setStatus('ready');
    setHelpOpen(false);
    // The walkthrough is optional: storage failures must not block the app.
    void AsyncStorage.setItem(guideStorageKey(userId), 'seen').catch(() => {
      logger.warn('Unable to save welcome guide preference.');
    });
  };

  if (status === 'loading')
    return (
      <Screen>
        <Text role="status" style={{ color: colors.muted }}>
          {t('app.loading')}
        </Text>
      </Screen>
    );
  if (status === 'intro') return <WelcomeGuide onFinish={finish} />;
  return (
    <>
      {children(() => setHelpOpen(true))}
      {helpOpen ? (
        <Modal
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={finish}
        >
          <SafeAreaProvider>
            <WelcomeGuide onFinish={finish} />
          </SafeAreaProvider>
        </Modal>
      ) : null}
    </>
  );
}
