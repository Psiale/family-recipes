import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import type { Family } from '@/features/families/api';
import i18n from '@/i18n';

import type { RecipeMedia, RecipeOptions } from './api';
import * as media from './media';
import { RecipeForm } from './RecipeForm';

jest.mock('./media', () => ({
  ...jest.requireActual('./media'),
  pickMedia: jest.fn(),
  uploadMedia: jest.fn(),
  discardStagedMedia: jest.fn().mockResolvedValue(undefined),
}));
const family: Family = {
  id: 'f',
  name: 'Luna',
  role: 'OWNER',
  description: null,
  created_at: 'stamp',
  created_by_user_id: 'u',
};
const audio: RecipeMedia = {
  id: 'audio',
  upload_id: 'audio',
  kind: 'AUDIO',
  storage_path: 'u/audio',
  file_name: 'Abuela.wav',
  content_type: 'audio/wav',
  byte_size: 100,
  caption: '',
  alt_text: '',
};
const options: RecipeOptions = {
  people: [
    { id: 'p', display_name: 'Ana', own: true },
    { id: 'managed', display_name: 'Abuela', own: false },
  ],
  families: [
    {
      id: 'f',
      name: 'Luna',
      can_write: true,
      can_manage: true,
      branches: [{ id: 'branch', name: 'Materna' }],
    },
    { id: 'g', name: 'Sol', can_write: true, can_manage: false, branches: [] },
  ],
};
beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('es');
  jest.mocked(media.pickMedia).mockResolvedValue({
    uri: 'file:///cache/audio',
    name: 'Abuela.wav',
    mimeType: 'audio/wav',
    size: 100,
  });
  jest.mocked(media.uploadMedia).mockResolvedValue(audio);
});
async function addAudio() {
  const user = userEvent.setup();
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.media.addRecording') }),
  );
  await screen.findByRole('button', {
    name: i18n.t('recipes.media.remove', { number: 1 }),
  });
  return user;
}
it.each(['es', 'en'])(
  'explains recording replacement before selection and saves without written steps in %s',
  async (locale) => {
    await i18n.changeLanguage(locale);
    const save = jest.fn().mockResolvedValue('r');
    await render(
      <RecipeForm families={[family]} onSave={save} onCancel={jest.fn()} />,
    );
    expect(
      screen.getByText(i18n.t('recipes.media.replaces')),
    ).toBeOnTheScreen();
    const user = await addAudio();
    expect(
      screen.queryByLabelText(i18n.t('recipes.stepNumber', { number: 1 })),
    ).toBeNull();
    await user.type(
      screen.getByLabelText(i18n.t('recipes.fields.title')),
      'Voz de Abuela',
    );
    await user.press(
      screen.getByRole('button', { name: i18n.t('recipes.save') }),
    );
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        content: expect.objectContaining({ steps: [], ingredients: [] }),
        media: [{ id: 'audio', caption: '', alt_text: '' }],
      }),
    );
  },
);
it('keeps optional written ingredients and steps when their container is closed', async () => {
  const save = jest.fn().mockResolvedValue('r');
  await render(
    <RecipeForm families={[family]} onSave={save} onCancel={jest.fn()} />,
  );
  const user = await addAudio();
  await user.type(
    screen.getByLabelText(i18n.t('recipes.fields.title')),
    'Ambas versiones',
  );
  const toggle = screen.getByRole('button', {
    name: i18n.t('recipes.media.writtenEditor'),
  });
  await user.press(toggle);
  await user.type(
    screen.getByLabelText(i18n.t('recipes.fields.ingredient', { number: 1 })),
    'Huevos',
  );
  await user.type(
    screen.getByLabelText(i18n.t('recipes.stepNumber', { number: 1 })),
    'Batir',
  );
  await user.press(toggle);
  expect(
    screen.queryByLabelText(i18n.t('recipes.stepNumber', { number: 1 })),
  ).toBeNull();
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.save') }),
  );
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      content: expect.objectContaining({
        ingredients: [expect.objectContaining({ ingredient: 'Huevos' })],
        steps: [expect.objectContaining({ instruction: 'Batir' })],
      }),
    }),
  );
});
it('requires written preparation for photo-only recipes and after the only recording is removed', async () => {
  const save = jest.fn();
  jest.mocked(media.uploadMedia).mockResolvedValue({ ...audio, kind: 'IMAGE' });
  await render(
    <RecipeForm families={[family]} onSave={save} onCancel={jest.fn()} />,
  );
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText(i18n.t('recipes.fields.title')),
    'Solo una foto',
  );
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.media.addPhoto') }),
  );
  await screen.findByRole('button', {
    name: i18n.t('recipes.media.remove', { number: 1 }),
  });
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.save') }),
  );
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(
    i18n.t('recipes.invalid'),
  );
});
it('records the managed Person and explicit multi-family/branch audiences', async () => {
  const save = jest.fn().mockResolvedValue('r');
  await render(
    <RecipeForm
      options={options}
      families={[family]}
      onSave={save}
      onCancel={jest.fn()}
    />,
  );
  const user = await addAudio();
  await user.type(
    screen.getByLabelText(i18n.t('recipes.fields.title')),
    'La voz de Abuela',
  );
  await user.press(screen.getByRole('button', { name: 'Abuela' }));
  await fireEvent(
    screen.getByRole('switch', {
      name: i18n.t('recipes.audiences.choice', {
        family: 'Luna',
        audience: 'Materna',
      }),
    }),
    'valueChange',
    true,
  );
  await fireEvent(
    screen.getByRole('switch', {
      name: i18n.t('recipes.audiences.choice', {
        family: 'Sol',
        audience: i18n.t('recipes.audiences.wholeFamily'),
      }),
    }),
    'valueChange',
    true,
  );
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.save') }),
  );
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      ownerPersonId: 'managed',
      audiences: [
        { family_id: 'f', branch_id: 'branch' },
        { family_id: 'g', branch_id: null },
      ],
    }),
  );
});
it('blocks recipe save while an attachment is still uploading', async () => {
  jest
    .mocked(media.uploadMedia)
    .mockImplementation(() => new Promise(() => {}));
  await render(
    <RecipeForm families={[family]} onSave={jest.fn()} onCancel={jest.fn()} />,
  );
  await userEvent.setup().press(
    screen.getByRole('button', {
      name: i18n.t('recipes.media.addRecording'),
    }),
  );
  expect(await screen.findByRole('status')).toHaveTextContent(
    i18n.t('recipes.media.uploading'),
  );
  expect(
    screen.getByRole('button', { name: i18n.t('recipes.save') }),
  ).toBeDisabled();
});
