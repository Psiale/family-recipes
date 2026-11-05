import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import i18n from '@/i18n';

import * as api from '../api';

import { FamilyPicker } from './FamilyPicker';

jest.mock('../api');
// Keep the real confirmation/query flow; only replace the native gesture layer.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      children,
      onSwipeableOpen,
    }: {
      children: React.ReactNode;
      onSwipeableOpen: () => void;
    }) => (
      <View testID="swipe-row" onTouchEnd={onSwipeableOpen}>
        {children}
      </View>
    ),
  };
});
jest.mock('react-native-gesture-handler', () => {
  const { Pressable } = jest.requireActual('react-native');
  return { Pressable };
});
jest.useFakeTimers();
const mocks = jest.mocked(api);
const family: api.Family = {
  id: 'family-1',
  name: 'Familia Uno',
  role: 'MEMBER',
  created_at: '',
  created_by_user_id: 'owner',
  description: null,
};
const request = {
  id: 'request-1',
  family_id: family.id,
  requested_by_user_id: 'owner',
  created_at: '',
  expires_at: '2099-01-01T00:00:00Z',
  family: { id: family.id, name: family.name },
};
async function setup(role: api.Family['role'] = 'MEMBER', userId = 'member') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  const onSelect = jest.fn();
  await render(
    <QueryClientProvider client={client}>
      <FamilyPicker
        userId={userId}
        families={[{ ...family, role }]}
        selectedId={family.id}
        onSelect={onSelect}
      />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(mocks.getFamilyLifecycle).toHaveBeenCalled());
  return { user: userEvent.setup(), onSelect };
}
beforeEach(async () => {
  jest.clearAllMocks();
  mocks.familyLifecycleAction.mockReset();
  mocks.familyLifecycleAction.mockResolvedValue(family.id);
  mocks.getFamilyLifecycle.mockResolvedValue({
    superAdmin: false,
    requests: [],
  });
  await i18n.changeLanguage('es');
});
it('long press opens personal leave; cancellation never mutates and confirmed leave does', async () => {
  const { user, onSelect } = await setup();
  await user.longPress(screen.getByRole('button', { name: family.name }));
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: family.name })).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Salir de la familia' }));
  await user.press(screen.getByRole('button', { name: 'Cancelar' }));
  expect(mocks.familyLifecycleAction).not.toHaveBeenCalled();
  await user.longPress(screen.getByRole('button', { name: family.name }));
  await user.press(screen.getByRole('button', { name: 'Salir de la familia' }));
  await user.press(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() =>
    expect(mocks.familyLifecycleAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'leave', familyId: family.id }),
      expect.anything(),
    ),
  );
});
it('swipe opens options and super admin deletion needs both confirmations and the name', async () => {
  mocks.getFamilyLifecycle.mockResolvedValue({
    superAdmin: true,
    requests: [],
  });
  const { user } = await setup();
  await fireEvent(screen.getByTestId('swipe-row'), 'touchEnd');
  await user.press(
    screen.getByRole('button', { name: 'Eliminar como súper admin' }),
  );
  await user.press(
    screen.getByRole('button', { name: 'Continuar a la segunda confirmación' }),
  );
  expect(mocks.familyLifecycleAction).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  await user.type(
    screen.getByLabelText('Escribe el nombre exacto de la familia'),
    family.name,
  );
  await user.press(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() =>
    expect(mocks.familyLifecycleAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', confirmName: family.name }),
      expect.anything(),
    ),
  );
});
it('owner cannot leave or approve their own request', async () => {
  mocks.getFamilyLifecycle.mockResolvedValue({
    superAdmin: false,
    requests: [request],
  });
  const { user } = await setup('OWNER', 'owner');
  await user.press(
    await screen.findByRole('button', { name: 'Revisar solicitud' }),
  );
  expect(
    screen.getByRole('button', { name: 'Salir de la familia' }),
  ).toBeDisabled();
  expect(
    screen.queryByRole('button', { name: 'Autorizar y eliminar familia' }),
  ).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Cancelar solicitud' }),
  ).toBeOnTheScreen();
});
it('independent approval requires name and preserves failed confirmation for retry', async () => {
  mocks.getFamilyLifecycle.mockResolvedValue({
    superAdmin: false,
    requests: [request],
  });
  mocks.familyLifecycleAction.mockRejectedValueOnce(new Error('offline'));
  const { user } = await setup('READ_ONLY');
  await user.press(
    await screen.findByRole('button', { name: 'Revisar solicitud' }),
  );
  await user.press(
    screen.getByRole('button', { name: 'Autorizar y eliminar familia' }),
  );
  await user.type(
    screen.getByLabelText('Escribe el nombre exacto de la familia'),
    family.name,
  );
  await user.press(screen.getByRole('button', { name: 'Confirmar' }));
  await screen.findByRole('alert');
  expect(
    screen.getByLabelText('Escribe el nombre exacto de la familia'),
  ).toHaveDisplayValue(family.name);
  await user.press(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() =>
    expect(mocks.familyLifecycleAction).toHaveBeenCalledTimes(2),
  );
  expect(mocks.familyLifecycleAction).toHaveBeenLastCalledWith(
    expect.objectContaining({ action: 'approve', requestId: request.id }),
    expect.anything(),
  );
});
