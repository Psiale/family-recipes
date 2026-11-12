import { forwardRef, useContext, type ComponentProps } from 'react';
import {
  StyleSheet,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';

import { FontAvailability, Text } from '@/components/Text';

import { colors, fonts, spacing } from './theme';

type TextFieldProps = ComponentProps<typeof TextInput> & {
  error?: string | undefined;
  label: string;
};

export const TextField = forwardRef<TextInputInstance, TextFieldProps>(
  function TextField({ error, label, style, ...props }, ref) {
    const fontsReady = useContext(FontAvailability);
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          ref={ref}
          aria-label={label}
          aria-invalid={Boolean(error)}
          placeholderTextColor={colors.muted}
          style={[
            styles.input,
            Boolean(error) && styles.inputError,
            style,
            !fontsReady && { fontFamily: undefined },
          ]}
          {...props}
        />
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 18,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    color: colors.error,
    fontSize: 16,
  },
});
