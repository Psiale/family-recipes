import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Image, Platform, Text, View } from 'react-native';

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
  const supported = Platform.OS === 'android' || Platform.OS === 'ios';
  const [source, setSource] = useState('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<CaptureStage>('read');
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const disposePreview = useRef<(() => void) | null>(null);
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
      disposePreview.current?.();
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
    const options: CaptureOptions = {
      signal: abort.signal,
      language: i18n.language.startsWith('en') ? 'en' : 'es',
      onProgress: (nextStage) => {
        if (mounted.current) {
          activeWork.current = true;
          setStage(nextStage);
        }
      },
    };
    try {
      // Keep custom native initialization out of normal recipe browsing and web.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const engine = require('./engine') as typeof import('./engine');
      if (read) {
        const photo = await engine.chooseAndRead(options);
        if (photo) {
          if (mounted.current) {
            disposePreview.current?.();
            disposePreview.current = photo.dispose;
            setPreviewUri(photo.previewUri);
            setSource(photo.text);
          } else photo.dispose();
        }
      } else {
        const next = await engine.organizeSource(source, options);
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
      <Text>{supported ? t('capture.privacy') : t('capture.web')}</Text>
      {supported && (
        <>
          <Text>{t('capture.limits')}</Text>
          <Text>{t('capture.reader')}</Text>
          <AppButton
            label={t('capture.choose')}
            disabled={busy}
            onPress={() => void run(true)}
          />
        </>
      )}
      {busy && (
        <>
          <Text role="status">{t(`capture.${stage}`)}</Text>
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
      {previewUri && (
        <Image
          source={{ uri: previewUri }}
          accessibilityLabel={t('capture.photo')}
          resizeMode="contain"
          style={{ width: '100%', height: 240 }}
        />
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
          {result.issues.length > 0 && <Text>{t('capture.incomplete')}</Text>}
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
