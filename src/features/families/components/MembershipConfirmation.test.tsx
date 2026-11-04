import { render, screen, userEvent } from '@testing-library/react-native';

import { MembershipConfirmation } from './MembershipConfirmation';

jest.useFakeTimers();
it.each(['PT409', '42501', 'unknown'])(
  'shows a localized %s error without reporting success',
  async (code) => {
    const onDone = jest.fn();
    const onConfirm = jest
      .fn()
      .mockRejectedValue({ code, message: 'private server detail' });
    const user = userEvent.setup();
    await render(
      <MembershipConfirmation
        kind="remove"
        name="Alex"
        familyName="Familia"
        values={{ familyId: 'f', personId: 'p', expectedRole: 'MEMBER' }}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
        onDone={onDone}
      />,
    );
    await user.press(
      screen.getByRole('button', {
        name: 'Confirmar eliminación de membresía',
      }),
    );
    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(screen.queryByText('private server detail')).toBeNull();
    expect(onDone).not.toHaveBeenCalled();
  },
);
