import {
  createContext,
  forwardRef,
  useContext,
  type ComponentRef,
} from 'react';
import { StyleSheet, Text as NativeText, type TextProps } from 'react-native';

import { colors, fonts } from './theme';

export const FontAvailability = createContext(true);

// Keep native Text semantics, refs and system text scaling while sharing type roles.
export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps>(
  function Text({ style, ...props }, ref) {
    const ready = useContext(FontAvailability);
    const resolved = StyleSheet.flatten(style);
    const heading =
      props.role === 'heading' || props.accessibilityRole === 'header';
    const bold =
      Number(resolved?.fontWeight ?? 400) >= 600 ||
      resolved?.fontWeight === 'bold';
    const family =
      resolved?.fontFamily ??
      (heading ? fonts.heading : bold ? fonts.bodyBold : fonts.body);
    return (
      <NativeText
        ref={ref}
        {...props}
        style={[
          styles.body,
          style,
          {
            fontFamily: ready ? family : undefined,
            fontWeight: ready ? 'normal' : resolved?.fontWeight,
            lineHeight:
              resolved?.lineHeight ??
              Math.ceil((resolved?.fontSize ?? 18) * (heading ? 1.25 : 1.5)),
          },
        ]}
      />
    );
  },
);

const styles = StyleSheet.create({
  body: { color: colors.text, fontSize: 18, lineHeight: 27 },
});
