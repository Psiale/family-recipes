import { act, render, screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';

import { WelcomeGuide } from './WelcomeGuide';

const mockHeading = { focus: jest.fn() };
const mockScrollTo = jest.fn();
jest.mock('react-native/Libraries/Text/Text', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const Text = React.forwardRef((props: object, ref) => {
    React.useImperativeHandle(ref, () => mockHeading);
    return React.createElement('Text', props);
  });
  Text.displayName = 'Text';
  return { __esModule: true, default: Text };
});
jest.mock('@/components/Screen', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    Screen: ({
      children,
      scrollRef,
    }: {
      children: import('react').ReactNode;
      scrollRef: import('react').Ref<unknown>;
    }) => {
      React.useImperativeHandle(scrollRef, () => ({ scrollTo: mockScrollTo }));
      return React.createElement('View', null, children);
    },
  };
});
jest.useFakeTimers();

const originalOS = Platform.OS;
afterEach(() => {
  Platform.OS = originalOS;
  jest.restoreAllMocks();
});

it.each(['ios', 'android', 'web'] as const)(
  'focuses the updated heading on %s without replacing it',
  async (platform) => {
    Platform.OS = platform;
    mockHeading.focus.mockClear();
    mockScrollTo.mockClear();
    const nativeFocus = jest
      .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      .mockImplementation(() => {});
    nativeFocus.mockClear();
    const user = userEvent.setup();
    await render(<WelcomeGuide onFinish={jest.fn()} />);
    const heading = screen.getByRole('heading', { name: 'Vamos paso a paso' });
    expect(nativeFocus).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Siguiente' }));
    await act(async () => jest.advanceTimersByTime(20));
    expect(
      screen.getByRole('heading', { name: 'Tu lugar en la familia' }),
    ).toBe(heading);
    expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
    if (platform === 'web') {
      expect(mockHeading.focus).toHaveBeenCalledTimes(1);
      expect(nativeFocus).not.toHaveBeenCalled();
    } else expect(nativeFocus).toHaveBeenLastCalledWith(mockHeading, 'focus');
    await user.press(screen.getByRole('button', { name: 'Atrás' }));
    await act(async () => jest.advanceTimersByTime(20));
    expect(screen.getByRole('heading', { name: 'Vamos paso a paso' })).toBe(
      heading,
    );
    expect(
      platform === 'web' ? mockHeading.focus : nativeFocus,
    ).toHaveBeenCalledTimes(2);
  },
);
