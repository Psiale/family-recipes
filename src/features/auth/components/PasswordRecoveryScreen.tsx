import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/components/theme';

import { useSession } from '../providers/SessionProvider';

import {
  NewPasswordForm,
  RequestPasswordResetForm,
} from './PasswordRecoveryForms';

export function PasswordRecoveryScreen() {
  const { t } = useTranslation();
  const {
    recoveryMode,
    startPasswordRecovery,
    cancelPasswordRecovery,
    requestPasswordReset,
    updateRecoveredPassword,
  } = useSession();
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const close = async () => {
    setClosing(true);
    setError(false);
    try {
      await cancelPasswordRecovery();
    } catch {
      setError(true);
    } finally {
      setClosing(false);
    }
  };
  return (
    <Screen contentStyle={styles.screen}>
      <Text role="heading" style={styles.title}>
        {t(
          recoveryMode === 'update'
            ? 'auth.recovery.newTitle'
            : recoveryMode === 'invalid'
              ? 'auth.recovery.invalidTitle'
              : recoveryMode === 'complete'
                ? 'auth.recovery.completeTitle'
                : 'auth.recovery.title',
        )}
      </Text>
      {recoveryMode === 'request' ? (
        <RequestPasswordResetForm
          onRequest={async (email) => {
            setBusy(true);
            try {
              await requestPasswordReset(email);
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
      {recoveryMode === 'update' ? (
        <NewPasswordForm
          onSave={async (password) => {
            setBusy(true);
            try {
              await updateRecoveredPassword(password);
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
      {recoveryMode === 'invalid' ? (
        <>
          <Text role="alert" style={styles.body}>
            {t('auth.recovery.invalid')}
          </Text>
          <AppButton
            label={t('auth.recovery.sendAnother')}
            onPress={startPasswordRecovery}
          />
        </>
      ) : null}
      {recoveryMode === 'complete' ? (
        <Text role="status" style={styles.body}>
          {t('auth.recovery.complete')}
        </Text>
      ) : null}
      {error ? (
        <Text role="alert" style={styles.error}>
          {t('auth.recovery.cancelError')}
        </Text>
      ) : null}
      <AppButton
        label={t(
          recoveryMode === 'complete'
            ? 'auth.recovery.continue'
            : 'auth.recovery.cancel',
        )}
        variant="secondary"
        loading={closing}
        disabled={busy}
        onPress={() => void close()}
      />
      <LanguageSwitcher />
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { gap: spacing.lg, justifyContent: 'center' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  error: { color: colors.error, fontSize: 14 },
});
