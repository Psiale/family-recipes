import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Modal, Platform, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';

import { styles } from './styles';

export function DetailsSheet({
  title,
  onClose,
  children,
}: PropsWithChildren<{ title: string; onClose: () => void }>) {
  const { t } = useTranslation();
  const handleRequestClose = () => {
    // A modal can receive Android Back before the keyboard visibility event.
    if (
      Platform.OS === 'android' &&
      (Keyboard.isVisible() || TextInput.State.currentlyFocusedInput())
    ) {
      Keyboard.dismiss();
      return;
    }
    onClose();
  };
  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleRequestClose}
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
