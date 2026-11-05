import { fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard, Platform, TextInput } from 'react-native';

import { DetailsSheet } from './DetailsSheet';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

const originalOS = Platform.OS;
afterEach(() => {
  Platform.OS = originalOS;
  jest.restoreAllMocks();
});

it.each([true, false])(
  'keeps the family name when Android sends Back during editing (keyboard reported visible: %s)',
  async (visible) => {
    Platform.OS = 'android';
    const close = jest.fn();
    const dismiss = jest
      .spyOn(Keyboard, 'dismiss')
      .mockImplementation(() => {});
    jest
      .spyOn(Keyboard, 'isVisible')
      .mockReturnValueOnce(visible)
      .mockReturnValue(false);
    const focus = jest
      .spyOn(TextInput.State, 'currentlyFocusedInput')
      .mockReturnValue(undefined);
    if (!visible)
      focus.mockReturnValueOnce(
        {} as NonNullable<
          ReturnType<typeof TextInput.State.currentlyFocusedInput>
        >,
      );
    await render(
      <DetailsSheet title="Mis familias" onClose={close}>
        <TextInput accessibilityLabel="Nombre" defaultValue="Sánchez Cárcamo" />
      </DetailsSheet>,
    );
    const input = screen.getByLabelText('Nombre');
    await fireEvent(input, 'requestClose');
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    expect(input).toHaveDisplayValue('Sánchez Cárcamo');
    await fireEvent(input, 'requestClose');
    expect(close).toHaveBeenCalledTimes(1);
  },
);
