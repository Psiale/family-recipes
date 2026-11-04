import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppButton } from '@/components/AppButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/components/theme';

const steps = ['welcome', 'profile', 'family', 'tree'] as const;

export function WelcomeGuide({ onFinish }: { onFinish: () => void }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const headingRef = useRef<ComponentRef<typeof Text>>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const previousIndex = useRef(index);

  useEffect(() => {
    if (previousIndex.current === index) return;
    previousIndex.current = index;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    // Wait for the updated native text/layout before moving screen-reader focus.
    const frame = requestAnimationFrame(() => {
      const heading = headingRef.current;
      if (!heading) return;
      if (Platform.OS === 'web') heading.focus();
      else AccessibilityInfo.sendAccessibilityEvent(heading, 'focus');
    });
    return () => cancelAnimationFrame(frame);
  }, [index]);
  const step = steps[index]!;
  const last = index === steps.length - 1;

  return (
    <Screen contentStyle={styles.screen} scrollRef={scrollRef}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{t('guide.label')}</Text>
        <Text style={styles.progress}>
          {t('guide.progress', { current: index + 1, total: steps.length })}
        </Text>
      </View>
      <View
        style={styles.dots}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {steps.map((item, dotIndex) => (
          <View
            key={item}
            style={[styles.dot, dotIndex <= index && styles.activeDot]}
          />
        ))}
      </View>
      <View style={styles.card}>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={styles.badge}
        >
          <Text style={styles.number} maxFontSizeMultiplier={1.4}>
            {index + 1}
          </Text>
        </View>
        <Text
          ref={headingRef}
          accessible
          role="heading"
          {...(Platform.OS === 'web' ? { tabIndex: -1 } : {})}
          style={styles.title}
        >
          {t(`guide.steps.${step}.title`)}
        </Text>
        <Text style={styles.body}>{t(`guide.steps.${step}.body`)}</Text>
        <View style={styles.tip}>
          <Text style={styles.tipLabel}>{t('guide.tip')}</Text>
          <Text style={styles.body}>
            {t(`guide.steps.${step}.tip`, {
              claimAction: t('families.haveClaimCode'),
            })}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <AppButton
          label={t(last ? 'guide.start' : 'guide.next')}
          onPress={() => (last ? onFinish() : setIndex(index + 1))}
        />
        {index > 0 ? (
          <AppButton
            label={t('guide.back')}
            variant="secondary"
            onPress={() => setIndex(index - 1)}
          />
        ) : null}
        <AppButton
          label={t('guide.skip')}
          variant="secondary"
          onPress={onFinish}
        />
      </View>
      <Text style={styles.footnote}>{t('guide.revisit')}</Text>
      <LanguageSwitcher />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg, justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  eyebrow: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  progress: { color: colors.muted, fontSize: 16 },
  dots: { flexDirection: 'row', gap: spacing.sm },
  dot: { height: 4, borderRadius: 2, backgroundColor: colors.border, flex: 1 },
  activeDot: { backgroundColor: colors.primary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  number: { color: colors.primary, fontSize: 30, fontWeight: '800' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 17, lineHeight: 26 },
  tip: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.md,
    gap: spacing.sm,
  },
  tipLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  actions: { gap: spacing.sm },
  footnote: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
});
