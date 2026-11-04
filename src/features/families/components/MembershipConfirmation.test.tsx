import { render, screen, userEvent } from '@testing-library/react-native';

import i18n from '@/i18n';

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

it.each([
  ['es', 'remove', 'Confirmar eliminación de membresía', 'Cancelar'],
  ['es', 'transfer', 'Confirmar transferencia', 'Cancelar'],
  ['en', 'remove', 'Confirm removal', 'Cancel'],
  ['en', 'transfer', 'Confirm ownership transfer', 'Cancel'],
] as const)(
  'explains how to restart a stale %s %s action',
  async (language, kind, confirmLabel, cancelLabel) => {
    await i18n.changeLanguage(language);
    const user = userEvent.setup();
    const onCancel = jest.fn();
    const onDone = jest.fn();
    try {
      await render(
        <MembershipConfirmation
          kind={kind}
          name="Alex"
          familyName="Family"
          values={{ familyId: 'f', personId: 'p', expectedRole: 'MEMBER' }}
          onConfirm={jest.fn().mockRejectedValue({ code: 'PT409' })}
          onCancel={onCancel}
          onDone={onDone}
        />,
      );
      await user.press(screen.getByRole('button', { name: confirmLabel }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        language === 'es'
          ? 'Esta membresía cambió. Cancela y vuelve a abrir esta acción desde el perfil de la persona para revisar la información actual antes de confirmar.'
          : 'This membership changed. Cancel and reopen this action from the person’s profile to review the latest information before confirming.',
      );
      await user.press(screen.getByRole('button', { name: cancelLabel }));
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onDone).not.toHaveBeenCalled();
    } finally {
      await screen.unmount();
      await i18n.changeLanguage('es');
    }
  },
);
