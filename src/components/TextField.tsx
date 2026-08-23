import { forwardRef, type ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from './theme';

type TextFieldProps = ComponentProps<typeof TextInput> & {
  error?: string | undefined;
  label: string;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { error, label, style, ...props },
  ref,
) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        aria-label={label}
        aria-invalid={Boolean(error)}
        placeholderTextColor={colors.muted}
        style={[styles.input, Boolean(error) && styles.inputError, style]}
        {...props}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    color: colors.error,
    fontSize: 13,
  },
});
