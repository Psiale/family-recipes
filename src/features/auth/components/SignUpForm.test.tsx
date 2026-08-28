import { render, screen, userEvent } from '@testing-library/react-native';

import { SignUpForm } from './SignUpForm';

jest.useFakeTimers();

async function fillValidForm() {
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText('Correo electrónico'),
    'psialedev@gmail.com',
  );
  await user.type(screen.getByLabelText('Contraseña'), 'secret12');
  await user.type(screen.getByLabelText('Confirmar contraseña'), 'secret12');
  return user;
}

describe('SignUpForm', () => {
  it('validates required fields with localized messages', async () => {
    const onSignUp = jest.fn();
    const user = userEvent.setup();

    await render(<SignUpForm onSignUp={onSignUp} />);
    await user.press(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      screen.getByText('Ingresa tu correo electrónico.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Ingresa tu contraseña.')).toBeOnTheScreen();
    expect(screen.getByText('Confirma tu contraseña.')).toBeOnTheScreen();
    expect(onSignUp).not.toHaveBeenCalled();
  });

  it('submits normalized credentials', async () => {
    const onSignUp = jest.fn(async () => ({ status: 'signedIn' as const }));

    await render(<SignUpForm onSignUp={onSignUp} />);
    const user = await fillValidForm();
    await user.press(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(onSignUp).toHaveBeenCalledWith({
      email: 'psialedev@gmail.com',
      password: 'secret12',
    });
  });

  it('shows the email-confirmation state', async () => {
    const onSignUp = jest.fn(async () => ({
      status: 'confirmationRequired' as const,
    }));

    await render(<SignUpForm onSignUp={onSignUp} />);
    const user = await fillValidForm();
    await user.press(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByRole('header', { name: 'Confirma tu correo' }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Revisa tu bandeja/)).toBeOnTheScreen();
  });

  it('shows an existing-account state without retrying', async () => {
    const onSignUp = jest.fn(async () => ({
      status: 'existingAccount' as const,
    }));

    await render(<SignUpForm onSignUp={onSignUp} />);
    const user = await fillValidForm();
    await user.press(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Ya existe una cuenta/,
    );
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });
});
