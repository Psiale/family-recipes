import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { TextField } from '@/components/TextField';
import { styles } from '@/features/families/components/styles';

import { type RecipeDetail, setPreservation } from './api';

export function RecipePreservation({
  detail,
  onChanged,
}: {
  detail: RecipeDetail;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(''),
    [stale, setStale] = useState(false);
  const preserved = detail.recipe.preservation_status === 'PRESERVED';
  const mutation = useMutation({
    mutationFn: () =>
      setPreservation(
        detail.recipe.id,
        detail.latest_revision,
        !preserved,
        reason.trim(),
      ),
    onSuccess: () => setOpen(false),
    onSettled: onChanged,
    onError: (e) => {
      if (
        'code' in e &&
        ['PT409', '42501', 'RECIPE_SAVE_UNCONFIRMED'].includes(String(e.code))
      )
        setStale(true);
    },
  });
  if (!detail.can_preserve) return null;
  return (
    <View style={styles.card}>
      {!open ? (
        <AppButton
          label={t(
            preserved
              ? 'recipes.preservation.unlock'
              : 'recipes.preservation.lock',
          )}
          variant="secondary"
          onPress={() => setOpen(true)}
        />
      ) : (
        <>
          <Text role="heading" style={styles.subtitle}>
            {detail.recipe.title}
          </Text>
          <Text>
            {t(
              preserved
                ? 'recipes.preservation.unlockHint'
                : 'recipes.preservation.lockHint',
            )}
          </Text>
          <TextField
            label={t('personAdministration.reason')}
            value={reason}
            onChangeText={setReason}
            maxLength={2000}
            editable={!mutation.isPending}
          />
          {mutation.isError && (
            <Text role="alert" style={styles.error}>
              {t(stale ? 'recipes.stale' : 'families.errors.save')}
            </Text>
          )}
          <AppButton
            label={t('recipes.preservation.confirm')}
            disabled={!reason.trim() || stale}
            loading={mutation.isPending}
            onPress={() => mutation.mutate()}
          />
          <AppButton
            label={t('families.cancel')}
            variant="secondary"
            disabled={mutation.isPending}
            onPress={() => {
              setOpen(false);
              setStale(false);
              mutation.reset();
            }}
          />
        </>
      )}
    </View>
  );
}
