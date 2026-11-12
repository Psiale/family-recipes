import { useQuery } from '@tanstack/react-query';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Image, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { styles } from '@/features/families/components/styles';

import type { RecipeMedia } from './api';
import {
  cleanupExpiredUploads,
  MAX_ATTACHMENTS,
  MAX_TOTAL_BYTES,
  discardStagedMedia,
  pickMedia,
  authorizedMediaSource,
  type AuthorizedMediaSource,
  uploadMedia,
} from './media';

export function RecipeMediaEditor({
  value,
  onChange,
  recipeId,
  disabled,
  onBusy,
}: {
  value: RecipeMedia[];
  onChange: (value: RecipeMedia[]) => void;
  recipeId: string | null;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false),
    [error, setError] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void cleanupExpiredUploads().catch(() => {});
    return () => {
      alive.current = false;
    };
  }, []);
  const add = async (photo: boolean) => {
    if (busy.current || disabled || value.length >= MAX_ATTACHMENTS) return;
    busy.current = true;
    setError(false);
    onBusy(true);
    setUploading(true);
    try {
      const asset = await pickMedia(photo);
      if (!asset) return;
      if (
        (asset.size ?? 0) + value.reduce((n, m) => n + (m.byte_size ?? 0), 0) >
        MAX_TOTAL_BYTES
      )
        throw new Error('Total attachment limit');
      const media = await uploadMedia(asset, recipeId);
      if (
        value.reduce((n, m) => n + (m.byte_size ?? 0), 0) +
          (media.byte_size ?? 0) >
        MAX_TOTAL_BYTES
      ) {
        await discardStagedMedia(media);
        throw new Error('Total attachment limit');
      }
      if (alive.current) onChange([...value, media]);
      else await discardStagedMedia(media);
    } catch {
      if (alive.current) setError(true);
    } finally {
      busy.current = false;
      if (alive.current) {
        onBusy(false);
        setUploading(false);
      }
    }
  };
  return (
    <View style={styles.card}>
      <Text role="heading" style={styles.subtitle}>
        {t('recipes.media.title')}
      </Text>
      <Text style={styles.body}>{t('recipes.media.limits')}</Text>
      {recipeId && (
        <Text style={styles.body}>{t('recipes.media.historyHint')}</Text>
      )}
      {value.map((media, index) => (
        <View key={media.id} style={styles.card}>
          <Text>
            {t(
              `recipes.media.${media.kind === 'IMAGE' ? 'photo' : media.kind === 'VIDEO' ? 'video' : 'audio'}`,
            )}
            : {media.file_name ?? media.caption ?? index + 1}
          </Text>
          <TextField
            label={t('recipes.media.caption', { number: index + 1 })}
            value={media.caption ?? ''}
            editable={!disabled && !uploading}
            maxLength={240}
            onChangeText={(caption) =>
              onChange(
                value.map((m) => (m.id === media.id ? { ...m, caption } : m)),
              )
            }
          />
          {media.kind === 'IMAGE' && (
            <TextField
              label={t('recipes.media.alt', { number: index + 1 })}
              value={media.alt_text ?? ''}
              editable={!disabled && !uploading}
              maxLength={240}
              onChangeText={(alt_text) =>
                onChange(
                  value.map((m) =>
                    m.id === media.id ? { ...m, alt_text } : m,
                  ),
                )
              }
            />
          )}
          <AppButton
            label={t('recipes.media.remove', { number: index + 1 })}
            variant="secondary"
            disabled={disabled || uploading}
            onPress={() => {
              onChange(value.filter((m) => m.id !== media.id));
              void discardStagedMedia(media).catch(() => {});
            }}
          />
        </View>
      ))}
      <AppButton
        label={t('recipes.media.addPhoto')}
        disabled={disabled || uploading || value.length >= MAX_ATTACHMENTS}
        onPress={() => void add(true)}
      />
      <Text style={styles.body}>{t('recipes.media.replaces')}</Text>
      <AppButton
        label={t('recipes.media.addRecording')}
        disabled={disabled || uploading || value.length >= MAX_ATTACHMENTS}
        onPress={() => void add(false)}
      />
      {uploading && <Text role="status">{t('recipes.media.uploading')}</Text>}
      {error && (
        <Text role="alert" style={styles.error}>
          {t('recipes.media.error')}
        </Text>
      )}
    </View>
  );
}
function AudioPlayback({
  source,
  onError,
}: {
  source: AuthorizedMediaSource;
  onError: () => void;
}) {
  const { t } = useTranslation();
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') player.pause();
    });
    return () => listener.remove();
  }, [player]);
  useEffect(() => {
    if (status.isLoaded) return;
    const timer = setTimeout(onError, 20_000);
    return () => clearTimeout(timer);
  }, [status.isLoaded, onError]);
  return (
    <View>
      <Text>
        {Math.floor(status.currentTime ?? 0)} /{' '}
        {Math.floor(status.duration ?? 0)} s
      </Text>
      <AppButton
        label={t(status.playing ? 'recipes.media.pause' : 'recipes.media.play')}
        disabled={!status.isLoaded}
        onPress={() => {
          void (async () => {
            if (status.playing) player.pause();
            else {
              if (status.didJustFinish || status.currentTime >= status.duration)
                await player.seekTo(0);
              player.play();
            }
          })().catch(onError);
        }}
      />
    </View>
  );
}
function VideoPlayback({
  source,
  onError,
}: {
  source: AuthorizedMediaSource;
  onError: () => void;
}) {
  const player = useVideoPlayer(source);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') player.pause();
    });
    return () => listener.remove();
  }, [player]);
  useEffect(() => {
    const listener = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') onError();
    });
    const timer = setTimeout(() => {
      if (player.status !== 'readyToPlay') onError();
    }, 20_000);
    return () => {
      listener.remove();
      clearTimeout(timer);
    };
  }, [player, onError]);
  return (
    <VideoView
      player={player}
      nativeControls
      style={{ width: '100%', aspectRatio: 16 / 9 }}
    />
  );
}
function MediaObject({
  media,
  viewerId,
}: {
  media: RecipeMedia;
  viewerId: string;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const onMediaError = useCallback(() => setFailed(true), []);
  const query = useQuery({
    queryKey: ['recipe-media', viewerId, media.id, media.storage_path],
    queryFn: ({ signal }) => authorizedMediaSource(media.storage_path, signal),
    retry: false,
    staleTime: 30_000,
    gcTime: 0,
  });
  useEffect(
    () => () => {
      if (query.data?.uri.startsWith('blob:'))
        URL.revokeObjectURL(query.data.uri);
    },
    [query.data],
  );
  return (
    <View style={styles.card}>
      {query.isError || failed ? (
        <>
          <Text role="alert">{t('recipes.media.unavailable')}</Text>
          <AppButton
            label={t('families.retry')}
            onPress={() => {
              setFailed(false);
              void query.refetch();
            }}
          />
        </>
      ) : !query.data ? (
        <Text role="status">{t('app.loading')}</Text>
      ) : media.kind === 'IMAGE' ? (
        <Image
          source={query.data}
          accessibilityLabel={
            media.alt_text || media.caption || t('recipes.media.photo')
          }
          style={{ width: '100%', aspectRatio: 4 / 3, resizeMode: 'contain' }}
          onError={() => setFailed(true)}
        />
      ) : media.kind === 'AUDIO' ? (
        <AudioPlayback source={query.data} onError={onMediaError} />
      ) : (
        <VideoPlayback source={query.data} onError={onMediaError} />
      )}
      {media.caption && <Text>{media.caption}</Text>}
    </View>
  );
}
export function RecipeMediaView({
  media,
  viewerId,
}: {
  media: RecipeMedia[];
  viewerId: string;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState<string | null>(null);
  return (
    <View>
      {media.map((m) =>
        m.kind === 'IMAGE' ? (
          <MediaObject key={m.id} media={m} viewerId={viewerId} />
        ) : m.kind === 'AUDIO' || m.kind === 'VIDEO' ? (
          <View key={m.id} style={styles.card}>
            <AppButton
              label={t(
                active === m.id ? 'recipes.media.close' : 'recipes.media.open',
                {
                  name:
                    m.caption ||
                    m.file_name ||
                    t(
                      `recipes.media.${m.kind === 'AUDIO' ? 'audio' : 'video'}`,
                    ),
                },
              )}
              onPress={() => setActive((old) => (old === m.id ? null : m.id))}
              variant="secondary"
            />
            {active === m.id && <MediaObject media={m} viewerId={viewerId} />}
          </View>
        ) : null,
      )}
    </View>
  );
}
