import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createAppQueryClient, QueryProvider } from './QueryProvider';

describe('QueryProvider', () => {
  it('uses bounded query retries and no mutation retries', () => {
    const options = createAppQueryClient().getDefaultOptions();

    expect(options.queries).toMatchObject({ retry: 2, staleTime: 30_000 });
    expect(options.mutations).toMatchObject({ retry: 0 });
  });

  it('provides a query client to application children', async () => {
    await render(
      <QueryProvider>
        <Text>Contenido con consultas</Text>
      </QueryProvider>,
    );

    expect(screen.getByText('Contenido con consultas')).toBeOnTheScreen();
  });

  it('discards account-scoped cached data when its session boundary unmounts', async () => {
    let captured: QueryClient | undefined;
    function Probe() {
      captured = useQueryClient();
      return null;
    }
    await render(
      <QueryProvider>
        <Probe />
      </QueryProvider>,
    );
    captured!.setQueryData(
      ['family-workspace', 'first-user'],
      ['private-data'],
    );
    await screen.unmount();
    expect(
      captured!.getQueryData(['family-workspace', 'first-user']),
    ).toBeUndefined();
  });
});
