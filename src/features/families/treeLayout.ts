import type { FamilyPerson, FamilyRelationship } from './api';

// Partner groups share a generation only when doing so preserves ancestry.
// A family is a DAG, not a strict tree: a child can have multiple parents.
export function buildTreeGenerations(
  people: FamilyPerson[],
  relationships: FamilyRelationship[],
): [number, FamilyPerson[]][] {
  const groups = new Map(people.map(({ person }) => [person.id, person.id]));
  const links = relationships.filter(
    (r) => groups.has(r.from_person_id) && groups.has(r.to_person_id),
  );
  const parents = links.filter((r) => r.kind === 'PARENT_CHILD');
  function ranks(mapping: Map<string, string>) {
    const ids = [...new Set(mapping.values())];
    const levels = new Map(ids.map((id) => [id, 0]));
    for (let pass = 0; pass < ids.length; pass++) {
      let changed = false;
      for (const edge of parents) {
        const from = mapping.get(edge.from_person_id)!;
        const to = mapping.get(edge.to_person_id)!;
        const next = levels.get(from)! + 1;
        if (next > levels.get(to)!) {
          levels.set(to, next);
          changed = true;
        }
      }
      if (!changed) return levels;
    }
    return null;
  }
  for (const edge of links.filter((r) => r.kind === 'PARTNER')) {
    const from = groups.get(edge.from_person_id)!;
    const to = groups.get(edge.to_person_id)!;
    if (from === to) continue;
    const candidate = new Map(
      [...groups].map(([id, group]) => [id, group === to ? from : group]),
    );
    if (ranks(candidate)) {
      for (const [id, group] of candidate) groups.set(id, group);
    }
  }
  const levels =
    ranks(groups) ?? new Map([...groups.values()].map((id) => [id, 0]));
  const rows = new Map<number, FamilyPerson[]>();
  // Keep partner groups adjacent; otherwise retain membership order.
  for (const group of new Set(groups.values())) {
    const level = levels.get(group) ?? 0;
    rows.set(level, [
      ...(rows.get(level) ?? []),
      ...people.filter(({ person }) => groups.get(person.id) === group),
    ]);
  }
  return [...rows].sort(([a], [b]) => a - b);
}

export const NODE_WIDTH = 112;
export const NODE_HEIGHT = 112;
export const AVATAR_SIZE = 56;
const COLUMN_GAP = 28;
const PADDING = 28;

export function layoutFamilyTree(
  people: FamilyPerson[],
  relationships: FamilyRelationship[],
  fontScale = 1,
  viewportWidth = 0,
) {
  const rows = buildTreeGenerations(people, relationships);
  const nodeWidth = NODE_WIDTH * Math.max(1, fontScale);
  const nodeHeight = NODE_HEIGHT * Math.max(1, fontScale);
  const rowGap = 84 + relationships.length * 4;
  const stride = nodeWidth + COLUMN_GAP;
  const contentWidth =
    Math.max(1, ...rows.map(([, entries]) => entries.length)) * stride;
  const width = Math.max(
    viewportWidth,
    contentWidth + PADDING * 2 + relationships.length * 16,
  );
  const nodes = rows.flatMap(([generation, entries], row) =>
    entries.map((entry, column) => ({
      ...entry,
      generation,
      x:
        (width - entries.length * stride) / 2 +
        column * stride +
        COLUMN_GAP / 2,
      y: PADDING + 24 + relationships.length * 4 + row * (nodeHeight + rowGap),
    })),
  );
  const byId = new Map(nodes.map((node) => [node.person.id, node]));
  const edges = relationships.flatMap((relationship, index) => {
    const from = byId.get(relationship.from_person_id);
    const to = byId.get(relationship.to_person_id);
    if (!from || !to) return [];
    const x1 = from.x + nodeWidth / 2;
    const x2 = to.x + nodeWidth / 2;
    let points: [number, number][];
    if (relationship.kind === 'PARTNER') {
      // Route above the nodes so links never pass through another avatar.
      const lane = Math.min(from.y, to.y) - 12 - index * 4;
      points = [
        [x1, from.y],
        [x1, lane],
      ];
      if (from.generation !== to.generation) {
        const outside = PADDING / 2 + index * 8;
        points = [
          [x1, from.y],
          [x1, from.y - 12],
          [outside, from.y - 12],
          [outside, to.y - 12],
          [x2, to.y - 12],
          [x2, to.y],
        ];
      } else points.push([x2, lane], [x2, to.y]);
    } else {
      const start = from.y + AVATAR_SIZE;
      const end = to.y;
      const lane = from.y + nodeHeight + 20 + index * 4;
      points = [
        [x1, start],
        [x1, lane],
      ];
      if (to.generation - from.generation > 1) {
        const outside = PADDING / 2 + index * 8;
        points.push([outside, lane], [outside, end - 24], [x2, end - 24]);
      } else points.push([x2, lane]);
      points.push([x2, end]);
    }
    return [{ relationship, points }];
  });
  return {
    nodes,
    edges,
    width,
    height: Math.max(
      180,
      PADDING + relationships.length * 4 + rows.length * (nodeHeight + rowGap),
    ),
    nodeWidth,
    nodeHeight,
  };
}
