import { render, screen, userEvent } from '@testing-library/react-native';

import type { FamilyPerson, FamilyRelationship, Person } from '../api';

import { buildTreeGenerations, FamilyTree } from './FamilyTree';

jest.useFakeTimers();

const makePerson = (id: string, displayName: string): FamilyPerson => ({
  membershipUpdatedAt: '2026-11-05T00:00:00Z',
  canIssueClaim: false,
  person: {
    deleted_at: null,
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
  expect(
    screen.getByRole('button', { name: 'Ver perfil de Madre' }),
  ).toHaveProp('accessibilityHint', expect.stringContaining('Padres: Abuela'));
  expect(
    screen.getByTestId('tree-edge-one', { includeHiddenElements: true }),
  ).toBeOnTheScreen();
  expect(
    screen.queryByRole('button', { name: 'Agregar parentesco' }),
  ).not.toBeOnTheScreen();
  expect(
    screen.queryByRole('button', { name: 'Eliminar vínculo' }),
  ).not.toBeOnTheScreen();
});

it('opens a person by tapping their initial node', async () => {
  const onSelectPerson = jest.fn();
  const user = userEvent.setup();
  await render(
    <FamilyTree
      canManage={false}
      familyId="family-1"
      people={people}
      relationships={[]}
      onCreate={jest.fn()}
      onDelete={jest.fn()}
      onSelectPerson={onSelectPerson}
    />,
  );
  expect(screen.getByText('A')).toBeOnTheScreen();
  await user.press(
    screen.getByRole('button', { name: 'Ver perfil de Abuela' }),
  );
  expect(onSelectPerson).toHaveBeenCalledWith('grandparent');
});

it('aligns partners without ancestry with their partner’s generation', () => {
  const partner = makePerson('partner', 'Pareja');
  const result = buildTreeGenerations(
    [...people, partner],
    [
      relationship('one', 'PARENT_CHILD', 'grandparent', 'parent'),
      relationship('two', 'PARENT_CHILD', 'parent', 'child'),
      relationship('three', 'PARTNER', 'parent', 'partner'),
      relationship('four', 'PARENT_CHILD', 'partner', 'child'),
    ],
  );
  expect(
    result.map(([generation, entries]) => [
      generation,
      entries.map(({ person }) => person.id),
    ]),
  ).toEqual([
    [0, ['grandparent']],
    [1, ['parent', 'partner']],
    [2, ['child']],
  ]);
});

it('preserves parent hierarchy when a partner group would create a cycle', () => {
  const result = buildTreeGenerations(people, [
    relationship('one', 'PARENT_CHILD', 'grandparent', 'parent'),
    relationship('two', 'PARENT_CHILD', 'parent', 'child'),
    relationship('three', 'PARTNER', 'grandparent', 'child'),
  ]);
  expect(result.map(([level]) => level)).toEqual([0, 1, 2]);
});

it('keeps relationship deletion available behind its management control', async () => {
  const onDelete = jest.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  await render(
    <FamilyTree
      canManage
      familyId="family-1"
      people={people}
      relationships={[
        relationship('one', 'PARENT_CHILD', 'grandparent', 'parent'),
      ]}
      onCreate={jest.fn()}
      onDelete={onDelete}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Eliminar vínculo' })).toBeNull();
  await user.press(
    screen.getByRole('button', { name: 'Vínculos registrados' }),
  );
  await user.press(screen.getByRole('button', { name: 'Eliminar vínculo' }));
  expect(onDelete).toHaveBeenCalledWith('one');
});

it('keeps nodes and branch routes within the canvas at large font sizes', () => {
  const { layoutFamilyTree } = jest.requireActual(
    '../treeLayout',
  ) as typeof import('../treeLayout');
  const links = [
    relationship('one', 'PARENT_CHILD', 'grandparent', 'parent'),
    relationship('two', 'PARENT_CHILD', 'parent', 'child'),
    relationship('skip', 'PARENT_CHILD', 'grandparent', 'child'),
    relationship('partner', 'PARTNER', 'grandparent', 'child'),
    relationship('missing', 'PARENT_CHILD', 'absent', 'child'),
  ];
  const layout = layoutFamilyTree(
    [...people, makePerson('unconnected', 'Persona sin vínculos')],
    links,
    2,
    320,
  );
  expect(layout.nodes).toHaveLength(4);
  expect(layout.edges).toHaveLength(4);
  for (const node of layout.nodes) {
    expect(node.x).toBeGreaterThanOrEqual(0);
    expect(node.x + layout.nodeWidth).toBeLessThanOrEqual(layout.width);
    expect(node.y + layout.nodeHeight).toBeLessThanOrEqual(layout.height);
  }
  for (const edge of layout.edges) {
    for (const [x, y] of edge.points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(layout.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(layout.height);
    }
  }
});
