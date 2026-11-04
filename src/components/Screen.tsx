import type { ComponentRef, PropsWithChildren, Ref } from 'react';
import { ScrollView, StyleSheet, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from './theme';

type ScreenProps = PropsWithChildren<{
  contentStyle?: ViewStyle;
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
}>;

export function Screen({ children, contentStyle, scrollRef }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: Math.max(insets.bottom, spacing.lg),
          paddingLeft: Math.max(insets.left, spacing.lg),
          paddingRight: Math.max(insets.right, spacing.lg),
          paddingTop: Math.max(insets.top, spacing.lg),
        },
        contentStyle,
      ]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
});
