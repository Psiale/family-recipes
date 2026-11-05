import { useIsMutating, useQuery } from '@tanstack/react-query';
import { Fragment, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Swipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { AppButton } from '@/components/AppButton';
import { ScrollIntoView } from '@/components/Screen';
import { colors, spacing } from '@/components/theme';

import { type Family, getFamilyLifecycle } from '../api';
import { familyKeys } from '../queries';

import {
  FamilyLifecyclePanel,
  type LifecycleTarget,
} from './FamilyLifecyclePanel';
import { styles } from './styles';

export function FamilyPickerRow({
  family,
  selected,
  onSelect,
  onOptions,
}: {
  family: Family;
  selected: boolean;
  onSelect: () => void;
  onOptions: () => void;
}) {
  const { t } = useTranslation();
  const swipe = useRef<SwipeableMethods>(null);
  const openOptions = () => {
    swipe.current?.close();
    onOptions();
  };
  const renderActions = () => (
    <View style={{ justifyContent: 'center', paddingHorizontal: spacing.md }}>
      <Text style={styles.body}>{t('familyLifecycle.options')}</Text>
    </View>
  );
  return (
    <Swipeable
      ref={swipe}
      renderLeftActions={renderActions}
      renderRightActions={renderActions}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={70}
      rightThreshold={70}
      onSwipeableOpen={openOptions}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={family.name}
        accessibilityState={{ selected }}
        accessibilityHint={t('familyLifecycle.gestureHint')}
        accessibilityActions={[
          { name: 'longpress', label: t('familyLifecycle.options') },
        ]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'longpress') openOptions();
        }}
        onPress={onSelect}
        onLongPress={openOptions}
        style={{
          minHeight: 50,
          padding: spacing.md,
          borderRadius: 12,
          backgroundColor: selected ? colors.primary : colors.surface,
          borderWidth: 1,
          borderColor: colors.primary,
        }}
      >
        <Text
          style={{
            color: selected ? colors.white : colors.primary,
            fontSize: 16,
            fontWeight: '700',
            textAlign: 'center',
          }}
        >
          {family.name}
        </Text>
      </Pressable>
    </Swipeable>
  );
}

export function FamilyPicker({
  userId,
  families,
  selectedId,
  onSelect,
}: {
  userId: string;
  families: Family[];
  selectedId?: string | undefined;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const pending = useIsMutating({
    mutationKey: [...familyKeys.root(userId), 'lifecycle-action'],
  });
  const [target, setTarget] = useState<LifecycleTarget | null>(null);
  const [done, setDone] = useState(false);
  const query = useQuery({
    queryKey: [...familyKeys.root(userId), 'lifecycle'],
    queryFn: () => getFamilyLifecycle(userId),
  });
  const choose = (value: LifecycleTarget) => {
    setDone(false);
    setTarget(value);
  };
  const panel = target && (
    <FamilyLifecyclePanel
      key={target.id}
      userId={userId}
      target={target}
      request={query.data?.requests.find((r) => r.family_id === target.id)}
      superAdminAllowed={query.data?.superAdmin === true}
      ready={query.isSuccess}
      onClose={() => setTarget(null)}
      onComplete={() => setDone(true)}
    />
  );
  return (
    <View style={styles.stack}>
      {families.map((family) => (
        <Fragment key={family.id}>
          <FamilyPickerRow
            family={family}
            selected={family.id === selectedId}
            onSelect={() => {
              if (!pending) onSelect(family.id);
            }}
            onOptions={() => {
              if (!pending) choose(family);
            }}
          />
          {target?.id === family.id ? panel : null}
        </Fragment>
      ))}
      {!target && (
        <Text style={styles.body}>{t('familyLifecycle.gestureHint')}</Text>
      )}
      {done ? (
        <ScrollIntoView>
          <Text role="status" style={styles.body}>
            {t('familyLifecycle.done')}
          </Text>
        </ScrollIntoView>
      ) : null}
      {query.isPending ? <Text role="status">{t('app.loading')}</Text> : null}
      {query.isError ? (
        <>
          <Text role="alert" style={styles.error}>
            {t('families.errors.load')}
          </Text>
          <AppButton
            label={t('families.retry')}
            onPress={() => void query.refetch()}
          />
        </>
      ) : null}
      {!target &&
        query.data?.requests.map((request) => (
          <View key={request.id} style={styles.card}>
            <Text style={styles.subtitle}>
              {t('familyLifecycle.pending', { family: request.family.name })}
            </Text>
            <AppButton
              label={t('familyLifecycle.review')}
              variant="secondary"
              onPress={() =>
                choose({
                  ...request.family,
                  role: families.find((f) => f.id === request.family_id)?.role,
                })
              }
            />
          </View>
        ))}

      {target && !families.some((family) => family.id === target.id)
        ? panel
        : null}
    </View>
  );
}
