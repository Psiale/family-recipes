import { render, screen, userEvent } from '@testing-library/react-native';

import i18n from '@/i18n';

import {
  NewPasswordForm,
  RequestPasswordResetForm,
} from './PasswordRecoveryForms';

jest.useFakeTimers();
beforeEach(async () => {
  await i18n.changeLanguage('en');
});

it('validates and normalizes the reset email, then gives a non-enumerating confirmation', async () => {
  const onRequest = jest.fn(async () => undefined);
  const user = userEvent.setup();
  await render(<RequestPasswordResetForm onRequest={onRequest} />);
  await user.press(screen.getByRole('button', { name: 'Send reset email' }));
  expect(onRequest).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText('Email address'), ' chef@example.com ');
  await user.press(screen.getByRole('button', { name: 'Send reset email' }));
  expect(onRequest).toHaveBeenCalledWith('chef@example.com');
  await screen.findByText(/If an account exists for this email/);
});

it('shows a send failure without falsely reporting that an email was sent', async () => {
  const user = userEvent.setup();
  await render(
    <RequestPasswordResetForm
      onRequest={async () => {
        throw new Error('network');
      }}
    />,
  );
  await user.type(screen.getByLabelText('Email address'), 'chef@example.com');
  await user.press(screen.getByRole('button', { name: 'Send reset email' }));
  await screen.findByText(/We could not request the email/);
  expect(screen.queryByText(/If an account exists/)).toBeNull();
});

it('requires matching strong-enough passwords and submits only the new password', async () => {
  const onSave = jest.fn(async () => undefined);
  const user = userEvent.setup();
  await render(<NewPasswordForm onSave={onSave} />);
  await user.type(screen.getByLabelText('New password'), 'NewPassword123!');
  await user.type(screen.getByLabelText('Confirm password'), 'different');
  await user.press(screen.getByRole('button', { name: 'Save new password' }));
  expect(screen.getByText('Passwords do not match.')).toBeOnTheScreen();
  expect(onSave).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText('Confirm password'));
  await user.type(screen.getByLabelText('Confirm password'), 'NewPassword123!');
  await user.press(screen.getByRole('button', { name: 'Save new password' }));
  expect(onSave).toHaveBeenCalledWith('NewPassword123!');
});

it('keeps the form available when Auth rejects a reused password', async () => {
  const user = userEvent.setup();
  await render(
    <NewPasswordForm
      onSave={async () => {
        throw { code: 'same_password' };
      }}
    />,
  );
  await user.type(screen.getByLabelText('New password'), 'NewPassword123!');
  await user.type(screen.getByLabelText('Confirm password'), 'NewPassword123!');
  await user.press(screen.getByRole('button', { name: 'Save new password' }));
  await screen.findByText(
    'Choose a password different from your current password.',
  );
  expect(screen.getByLabelText('New password')).toBeOnTheScreen();
});
