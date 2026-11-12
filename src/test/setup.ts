import '@/i18n';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ),
);

jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock'),
);

// Native swipe animations cannot execute in Jest. Keep the row and its callbacks.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View };
});

// Device playback, pickers and file I/O are exercised separately on Android.
jest.mock('expo-audio', () => ({
  useAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
  })),
  useAudioPlayerStatus: jest.fn(() => ({
    isLoaded: true,
    playing: false,
    currentTime: 0,
    duration: 10,
    didJustFinish: false,
  })),
}));
jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(() => ({
    pause: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    status: 'readyToPlay',
  })),
  VideoView: jest.requireActual('react-native').View,
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: true,
    assets: null,
  })),
}));
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    size: 24,
    arrayBuffer: async () => new ArrayBuffer(24),
    delete: jest.fn(),
  })),
  Paths: { cache: { uri: 'file:///cache/' } },
}));
