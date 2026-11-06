import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import i18n from '@/i18n';

import { CapturePanel } from './CapturePanel';
import * as engine from './engine';
import { CaptureError } from './pipeline';

jest.mock('./engine', () => ({
  chooseAndRead: jest.fn(),
  organizeSource: jest.fn(),
}));
const mocks = jest.mocked(engine);
beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('es');
  mocks.chooseAndRead.mockResolvedValue('Sopa\nsal\nHervir');
});
it.each(['es', 'en'])(
  'requires transcript review and explicit draft acceptance without saving in %s',
  async (language) => {
    await i18n.changeLanguage(language);
    const use = jest.fn();
    mocks.organizeSource.mockResolvedValue({
      recipe: {
        title: 'Sopa',
        description: null,
        story: null,
        origin_location: null,
        origin_year: null,
        servings: null,
        prep_time_minutes: null,
        cook_time_minutes: null,
        rest_time_minutes: null,
        ingredients: [
          {
            ingredient: 'sal',
            quantity: 'un puñito',
            unit: null,
            preparation_note: null,
            section_name: null,
          },
        ],
        steps: [
          { instruction: 'Hervir', section_name: null, duration_minutes: null },
        ],
      },
      source_text: 'corrected source',
      issues: [],
    });
    await render(<CapturePanel onUse={use} onCancel={jest.fn()} />);
    const user = userEvent.setup();
    await user.press(
      screen.getByRole('button', { name: i18n.t('capture.choose') }),
    );
    const source = await screen.findByLabelText(i18n.t('capture.source'));
    expect(mocks.organizeSource).not.toHaveBeenCalled();
    await fireEvent.changeText(source, 'corrected source');
    await user.press(
      screen.getByRole('button', { name: i18n.t('capture.structure') }),
    );
    await waitFor(() =>
      expect(mocks.organizeSource).toHaveBeenCalledWith(
        'corrected source',
        expect.anything(),
      ),
    );
    expect(use).not.toHaveBeenCalled();
    await user.press(
      await screen.findByRole('button', { name: i18n.t('capture.use') }),
    );
    expect(use).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sopa',
        ingredients: [expect.objectContaining({ quantity: 'un puñito' })],
      }),
    );
  },
);
it('keeps source text after model failure and offers a manual fallback', async () => {
  mocks.organizeSource.mockRejectedValue(new CaptureError('output'));
  const cancel = jest.fn();
  await render(<CapturePanel onUse={jest.fn()} onCancel={cancel} />);
  const user = userEvent.setup();
  await user.press(
    screen.getByRole('button', { name: i18n.t('capture.choose') }),
  );
  await screen.findByLabelText(i18n.t('capture.source'));
  await user.press(
    screen.getByRole('button', { name: i18n.t('capture.structure') }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    i18n.t('capture.errors.output'),
  );
  expect(screen.getByLabelText(i18n.t('capture.source'))).toHaveDisplayValue(
    'Sopa\nsal\nHervir',
  );
  await user.press(
    screen.getByRole('button', { name: i18n.t('capture.manual') }),
  );
  expect(cancel).toHaveBeenCalledTimes(1);
});
