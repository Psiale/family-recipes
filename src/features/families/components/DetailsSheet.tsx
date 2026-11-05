import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';

import { styles } from './styles';

export function DetailsSheet({
  title,
  onClose,
  children,
}: PropsWithChildren<{ title: string; onClose: () => void }>) {
  const { t } = useTranslation();
  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Screen contentStyle={styles.stack}>
            <AppButton
              label={t('families.backToTree')}
              variant="secondary"
              onPress={onClose}
            />
            <View style={styles.card}>
              <Text role="heading" style={styles.title}>
                {title}
              </Text>
              {children}
            </View>
          </Screen>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}
