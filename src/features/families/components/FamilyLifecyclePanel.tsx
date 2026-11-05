import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ScrollIntoView } from '@/components/Screen';
import { TextField } from '@/components/TextField';

import {
  familyLifecycleAction,
  type Family,
  type FamilyDeletionRequest,
  type LifecycleAction,
} from '../api';
import { familyKeys } from '../queries';

import { styles } from './styles';

export type LifecycleTarget = {
  id: string;
  name: string;
  role?: Family['role'] | undefined;
};

export function FamilyLifecyclePanel({
  userId,
  target,
  request,
  superAdminAllowed,
  ready,
  directory = false,
  onComplete,
  onClose,
}: {
  userId: string;
  target: LifecycleTarget;
  request: FamilyDeletionRequest | undefined;
  superAdminAllowed: boolean;
  ready: boolean;
  directory?: boolean;
  onComplete: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [action, setAction] = useState<LifecycleAction | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();
  const [second, setSecond] = useState(false);
  const [name, setName] = useState('');
  const refresh = () =>
    client.invalidateQueries({ queryKey: familyKeys.root(userId) });
  const mutation = useMutation({
    mutationKey: [...familyKeys.root(userId), 'lifecycle-action'],
    mutationFn: familyLifecycleAction,
    onSuccess: () => {
      onClose();
      onComplete();
      return refresh();
    },
    onError: refresh,
    networkMode: 'always',
    retry: false,
  });
  const reset = () => {
    onClose();
    setAction(null);
    setSecond(false);
    setName('');
    setRequestId(undefined);
    mutation.reset();
  };
  const [reviewedAt] = useState(() => Date.now());
  const isExpired = request
    ? new Date(request.expires_at).getTime() <= reviewedAt
    : false;
  const start = (value: LifecycleAction, id?: string) => {
    setAction(value);
    setRequestId(id);
    setSecond(false);
    setName('');
    mutation.reset();
  };
  const confirm = () => {
    if (!action || mutation.isPending) return;
    if (destructive && (action !== 'delete' || second) && name !== target.name)
      return;
    if (action === 'delete' && !second) {
      setSecond(true);
      return;
    }
    mutation.mutate({
      familyId: target.id,
      action,
      requestId,
      confirmName: target.name,
    });
  };
  const destructive = action === 'approve' || action === 'delete';
  const code =
    mutation.error && 'code' in mutation.error ? mutation.error.code : null;
  return (
    <View style={styles.card}>
      {!second && (action || !directory) && (
        <ScrollIntoView key={`${target.id}:${action ?? 'options'}`}>
          <Text role="heading" style={styles.subtitle}>
            {target.name}
          </Text>
        </ScrollIntoView>
      )}
      {second && (
        <Text role="heading" style={styles.subtitle}>
          {target.name}
        </Text>
      )}
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
          {target.role === 'OWNER' && (!request || isExpired) ? (
            <AppButton
              label={t('familyLifecycle.request')}
              onPress={() => start('request')}
              disabled={!ready}
            />
          ) : null}
          {request ? (
            <>
              <Text style={styles.body}>
                {t(
                  isExpired
                    ? 'familyLifecycle.expired'
                    : 'familyLifecycle.waiting',
                )}
              </Text>
              {!isExpired && request.requested_by_user_id !== userId ? (
                <AppButton
                  label={t('familyLifecycle.approve')}
                  onPress={() => start('approve', request.id)}
                />
              ) : null}
              {target.role === 'OWNER' || superAdminAllowed ? (
                <AppButton
                  label={t('familyLifecycle.cancelRequest')}
                  onPress={() => start('cancel', request.id)}
                />
              ) : null}
            </>
          ) : null}
          {superAdminAllowed ? (
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
            <ScrollIntoView>
              <Text role="alert" style={styles.error}>
                {t('familyLifecycle.second')}
              </Text>
            </ScrollIntoView>
          ) : null}
          {destructive && (action !== 'delete' || second) ? (
            <TextField
              label={t('familyLifecycle.typeName')}
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!mutation.isPending}
            />
          ) : null}
          {mutation.isError ? (
            <ScrollIntoView>
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
            </ScrollIntoView>
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
        label={t(
          directory && !action ? 'administration.back' : 'families.cancel',
        )}
        variant="secondary"
        disabled={mutation.isPending}
        onPress={reset}
      />
    </View>
  );
}
