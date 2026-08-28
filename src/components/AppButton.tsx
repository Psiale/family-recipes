import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

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
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
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
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryLabel: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
