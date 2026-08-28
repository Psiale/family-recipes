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
});
