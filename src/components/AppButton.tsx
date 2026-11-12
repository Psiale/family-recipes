import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/Text';

import { colors, spacing } from './theme';

type AppButtonProps = ComponentProps<typeof Pressable> & {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
};

export function AppButton({
  disabled,
  label,
  loading = false,
  variant = 'primary',
  ...props
}: AppButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <Pressable
      accessibilityRole="button"
      aria-disabled={isDisabled}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.white : colors.primary}
        />
      ) : (
        <Text
          style={
            variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel
          }
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.55,
  },
  primaryLabel: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  secondaryLabel: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
});
