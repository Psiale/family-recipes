import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { TextField } from '@/components/TextField';
import { styles } from '@/features/families/components/styles';

import {
  normalizeRecipeDraft,
  type CaptureResult,
  type RecipeDraft,
} from './draft';
import {
  CaptureError,
  MAX_SOURCE_CHARS,
  type CaptureOptions,
  type CaptureStage,
} from './pipeline';

export function CapturePanel({
  onUse,
  onCancel,
}: {
  onUse: (draft: RecipeDraft) => void;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const captureSupported = Platform.OS === 'android' || Platform.OS === 'ios';
  const [source, setSource] = useState('');
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<CaptureStage>('read');
  const [progress, setProgress] = useState<number>();
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<'es' | 'en'>(
    i18n.language.startsWith('en') ? 'en' : 'es',
  );
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const activeWork = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && activeWork.current) controller.current?.abort();
    });
    return () => {
      mounted.current = false;
      controller.current?.abort();
      listener.remove();
    };
  }, []);
  async function run(read: boolean) {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    activeWork.current = !read;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(undefined);
    const options: CaptureOptions = {
      signal: abort.signal,
      language,
      onProgress: (nextStage, nextProgress) => {
        if (!mounted.current) return;
        activeWork.current = true;
        setStage(nextStage);
        setProgress(nextProgress);
      },
    };
    try {
      // Avoid initializing native AI modules until capture is explicitly used.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const engine = require('./engine') as typeof import('./engine');
      const { chooseAndRead, organizeSource } = engine;
      if (read) {
        const text = await chooseAndRead(options);
        if (mounted.current && text !== null) setSource(text);
      } else {
        const next = await organizeSource(source, options);
        if (mounted.current) setResult(next);
      }
    } catch (failure) {
      if (mounted.current)
        setError(
          t(
            `capture.errors.${abort.signal.aborted ? 'cancelled' : failure instanceof CaptureError ? failure.code : 'failed'}`,
          ),
        );
    } finally {
      controller.current = null;
      activeWork.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <View style={styles.stack}>
      <Text role="heading" style={styles.title}>
        {t('capture.title')}
      </Text>
      <Text>{captureSupported ? t('capture.privacy') : t('capture.web')}</Text>
      {captureSupported && (
        <>
          <Text>{t('capture.limits')}</Text>
          <Text>{t('capture.models')}</Text>
          <AppButton
            variant="secondary"
            label={t(
              language === 'es' ? 'capture.languageEs' : 'capture.languageEn',
            )}
            disabled={busy}
            onPress={() => setLanguage(language === 'es' ? 'en' : 'es')}
          />
          <AppButton
            label={t('capture.choose')}
            disabled={busy}
            onPress={() => void run(true)}
          />
        </>
      )}
      {busy && (
        <>
          <Text role="status">
            {t(`capture.${stage}`)}
            {progress === undefined ? '' : ` ${Math.round(progress * 100)}%`}
          </Text>
          <AppButton
            variant="secondary"
            label={t('capture.stop')}
            onPress={() => controller.current?.abort()}
          />
        </>
      )}
      {error && (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {source !== '' && (
        <>
          <TextField
            label={t('capture.source')}
            multiline
            value={source}
            editable={!busy}
            onChangeText={(text) => {
              setSource(text);
              setResult(null);
            }}
          />
          <Text>{t('capture.reviewSource')}</Text>
          <AppButton
            label={t('capture.structure')}
            disabled={
              busy || !source.trim() || source.length > MAX_SOURCE_CHARS
            }
            onPress={() => void run(false)}
          />
          {source.length > MAX_SOURCE_CHARS && (
            <Text role="alert">{t('capture.errors.sourceLength')}</Text>
          )}
        </>
      )}
      {result && (
        <>
          <Text role="heading" style={styles.title}>
            {result.recipe.title ?? t('capture.untitled')}
          </Text>
          <Text>{t('capture.reviewDraft')}</Text>
          <Text>
            {t('recipes.ingredients')}: {result.recipe.ingredients.length} ·{' '}
            {t('recipes.steps')}: {result.recipe.steps.length}
          </Text>
          <AppButton
            label={t('capture.use')}
            onPress={() => onUse(normalizeRecipeDraft(result))}
          />
        </>
      )}
      <AppButton
        variant="secondary"
        label={t('capture.manual')}
        disabled={busy}
        onPress={onCancel}
      />
    </View>
  );
}
