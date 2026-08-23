import { render, screen, userEvent } from '@testing-library/react-native';

import { SignInForm } from './SignInForm';

jest.useFakeTimers();

describe('SignInForm', () => {
  it('validates required fields with localized messages', async () => {
    const onSignIn = jest.fn<
      Promise<void>,
      [{ email: string; password: string }]
    >();
    const user = userEvent.setup();

    await render(<SignInForm onSignIn={onSignIn} />);
    await user.press(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(
      screen.getByText('Ingresa tu correo electrónico.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Ingresa tu contraseña.')).toBeOnTheScreen();
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it('submits normalized credentials', async () => {
    const onSignIn = jest.fn(async () => undefined);
    const user = userEvent.setup();

    await render(<SignInForm onSignIn={onSignIn} />);
    await user.type(
      screen.getByLabelText('Correo electrónico'),
      'chef@example.com',
    );
    await user.type(screen.getByLabelText('Contraseña'), 'secret');
    await user.press(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(onSignIn).toHaveBeenCalledWith({
      email: 'chef@example.com',
      password: 'secret',
    });
  });
});
