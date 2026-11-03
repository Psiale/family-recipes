import { render, screen, userEvent } from '@testing-library/react-native';

import type { FamilyPerson, FamilyRelationship, Person } from '../api';

import { buildTreeGenerations, FamilyTree } from './FamilyTree';

jest.useFakeTimers();

const makePerson = (id: string, displayName: string): FamilyPerson => ({
  canIssueClaim: false,
  person: {
    biography: null,
    created_at: '',
    created_by_user_id: 'user-1',
    display_name: displayName,
    id,
    profile_photo_path: null,
    updated_at: '',
    user_id: null,
  } satisfies Person,
  role: 'MEMBER',
});

const people = [
  makePerson('grandparent', 'Abuela'),
  makePerson('parent', 'Madre'),
  makePerson('child', 'Hija'),
];

const relationship = (
  id: string,
  kind: FamilyRelationship['kind'],
  from: string,
  to: string,
): FamilyRelationship => ({
  created_at: '',
  created_by_user_id: 'user-1',
  family_id: 'family-1',
  from_person_id: from,
  id,
  kind,
  to_person_id: to,
});

it('groups an acyclic parent graph into visual generations', () => {
  const generations = buildTreeGenerations(people, [
    relationship('one', 'PARENT_CHILD', 'grandparent', 'parent'),
    relationship('two', 'PARENT_CHILD', 'parent', 'child'),
  ]);

  expect(
    generations.map(([generation, entries]) => [
      generation,
      entries.map(({ person }) => person.display_name),
    ]),
  ).toEqual([
    [0, ['Abuela']],
    [1, ['Madre']],
    [2, ['Hija']],
  ]);
});

it('lets a family manager create a parent-child connection', async () => {
  const onCreate = jest.fn().mockResolvedValue('relationship-id');
  const user = userEvent.setup();
  await render(
    <FamilyTree
      canManage
      familyId="family-1"
      people={people.slice(0, 2)}
      relationships={[]}
      onCreate={onCreate}
      onDelete={jest.fn()}
    />,
  );

  await user.press(screen.getByRole('button', { name: 'Agregar parentesco' }));
  await user.press(
    screen.getByRole('button', { name: 'Padre o madre: Abuela' }),
  );
  await user.press(screen.getByRole('button', { name: 'Hijo o hija: Madre' }));
  await user.press(screen.getByRole('button', { name: 'Guardar parentesco' }));

  expect(onCreate).toHaveBeenCalledWith({
    familyId: 'family-1',
    fromPersonId: 'grandparent',
    kind: 'PARENT_CHILD',
    toPersonId: 'parent',
  });
});

it('renders the tree read-only for a regular member', async () => {
  await render(
    <FamilyTree
      canManage={false}
      familyId="family-1"
      people={people}
      relationships={[
        relationship('one', 'PARENT_CHILD', 'grandparent', 'parent'),
      ]}
      onCreate={jest.fn()}
      onDelete={jest.fn()}
    />,
  );

  expect(screen.getByText('Árbol familiar')).toBeOnTheScreen();
  expect(screen.getByText('Padres: Abuela')).toBeOnTheScreen();
  expect(
    screen.queryByRole('button', { name: 'Agregar parentesco' }),
  ).not.toBeOnTheScreen();
  expect(
    screen.queryByRole('button', { name: 'Eliminar vínculo' }),
  ).not.toBeOnTheScreen();
});
