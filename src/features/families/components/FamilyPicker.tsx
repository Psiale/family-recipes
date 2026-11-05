import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Swipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { AppButton } from '@/components/AppButton';
import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/components/theme';

import {
  type Family,
  type LifecycleAction,
  getFamilyLifecycle,
  familyLifecycleAction,
} from '../api';
import { familyKeys } from '../queries';

import { styles } from './styles';

type Target = { id: string; name: string; role?: Family['role'] };

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
        onAccessibilityAction={openOptions}
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
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [target, setTarget] = useState<Target | null>(null);
  const [action, setAction] = useState<LifecycleAction | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();
  const [second, setSecond] = useState(false);
  const [name, setName] = useState('');
  const [done, setDone] = useState(false);
  const query = useQuery({
    queryKey: [...familyKeys.root(userId), 'lifecycle'],
    queryFn: () => getFamilyLifecycle(userId),
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: familyKeys.root(userId) });
  const mutation = useMutation({
    mutationFn: familyLifecycleAction,
    onSuccess: refresh,
    onError: refresh,
    networkMode: 'always',
    retry: false,
  });
  const reset = () => {
    setTarget(null);
    setAction(null);
    setSecond(false);
    setName('');
    setRequestId(undefined);
    mutation.reset();
  };
  const choose = (value: Target) => {
    reset();
    setDone(false);
    setTarget(value);
  };
  const superAdmin = query.data?.superAdmin ?? false;
  const pending = query.data?.requests.find((r) => r.family_id === target?.id);
  const isExpired = pending
    ? new Date(pending.expires_at).getTime() <= Date.now()
    : false;
  const start = (value: LifecycleAction, id?: string) => {
    setAction(value);
    setRequestId(id);
    setSecond(false);
    setName('');
    mutation.reset();
  };
  const confirm = () => {
    if (!target || !action || mutation.isPending) return;
    if (action === 'delete' && !second) {
      setSecond(true);
      return;
    }
    mutation.mutate(
      { familyId: target.id, action, requestId, confirmName: target.name },
      {
        onSuccess: () => {
          reset();
          setDone(true);
        },
      },
    );
  };
  const destructive = action === 'approve' || action === 'delete';
  const code =
    mutation.error && 'code' in mutation.error ? mutation.error.code : null;
  return (
    <View style={styles.stack}>
      {families.map((family) => (
        <FamilyPickerRow
          key={family.id}
          family={family}
          selected={family.id === selectedId}
          onSelect={() => onSelect(family.id)}
          onOptions={() => choose(family)}
        />
      ))}
      <Text style={styles.body}>{t('familyLifecycle.gestureHint')}</Text>
      {done ? (
        <Text role="status" style={styles.body}>
          {t('familyLifecycle.done')}
        </Text>
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
      {query.data?.requests.map((request) => (
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
      {target ? (
        <View style={styles.card}>
          <Text role="heading" style={styles.subtitle}>
            {target.name}
          </Text>
          {!action ? (
            <>
              {target.role ? (
                <>
                  <AppButton
                    label={t('familyLifecycle.leave')}
                    onPress={() => start('leave')}
                    disabled={target.role === 'OWNER'}
                  />
                  {target.role === 'OWNER' ? (
                    <Text style={styles.body}>
                      {t('familyLifecycle.ownerLeave')}
                    </Text>
                  ) : null}
                </>
              ) : null}
              {target.role === 'OWNER' && (!pending || isExpired) ? (
                <AppButton
                  label={t('familyLifecycle.request')}
                  onPress={() => start('request')}
                  disabled={!query.data || query.isError}
                />
              ) : null}
              {pending ? (
                <>
                  <Text style={styles.body}>
                    {t(
                      isExpired
                        ? 'familyLifecycle.expired'
                        : 'familyLifecycle.waiting',
                    )}
                  </Text>
                  {!isExpired && pending.requested_by_user_id !== userId ? (
                    <AppButton
                      label={t('familyLifecycle.approve')}
                      onPress={() => start('approve', pending.id)}
                    />
                  ) : null}
                  {target.role === 'OWNER' || superAdmin ? (
                    <AppButton
                      label={t('familyLifecycle.cancelRequest')}
                      onPress={() => start('cancel', pending.id)}
                    />
                  ) : null}
                </>
              ) : null}
              {superAdmin ? (
                <AppButton
                  label={t('familyLifecycle.delete')}
                  onPress={() => start('delete')}
                />
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.body}>
                {t(`familyLifecycle.${action}Explanation`, {
                  family: target.name,
                })}
              </Text>
              {second ? (
                <Text role="alert" style={styles.error}>
                  {t('familyLifecycle.second')}
                </Text>
              ) : null}
              {destructive && (action !== 'delete' || second) ? (
                <>
                  <Text style={styles.body}>
                    {t('familyLifecycle.typeName')}
                  </Text>
                  <TextField
                    label={t('familyLifecycle.typeName')}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!mutation.isPending}
                  />
                </>
              ) : null}
              {mutation.isError ? (
                <Text role="alert" style={styles.error}>
                  {t(
                    code === 'PT412'
                      ? 'familyLifecycle.ownerLeave'
                      : code === 'PT409'
                        ? 'families.membership.stale'
                        : code === '42501'
                          ? 'families.errors.permission'
                          : 'families.errors.save',
                  )}
                </Text>
              ) : null}
              <AppButton
                label={t(
                  action === 'delete' && !second
                    ? 'familyLifecycle.continue'
                    : 'familyLifecycle.confirm',
                )}
                loading={mutation.isPending}
                disabled={
                  destructive &&
                  (action !== 'delete' || second) &&
                  name !== target.name
                }
                onPress={confirm}
              />
            </>
          )}
          <AppButton
            label={t('families.cancel')}
            variant="secondary"
            disabled={mutation.isPending}
            onPress={reset}
          />
        </View>
      ) : null}
    </View>
  );
}
