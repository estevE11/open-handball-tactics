import * as Y from "yjs";

type Cell =
  | { kind: "object"; rank?: number }
  | { kind: "list" }
  | { kind: "value"; value: unknown };

// Address fields and ID-bearing entities independently. Concurrent additions and
// edits to different players survive; deleting an entity hides orphaned fields.
// Ordered point arrays and tags are atomic values, not independently editable text.
function flatten(
  value: unknown,
  path: string[] = [],
  cells = new Map<string, string>(),
  rank?: number,
) {
  const key = JSON.stringify(path);
  const put = (cell: Cell) => cells.set(key, JSON.stringify(cell));
  if (
    Array.isArray(value) &&
    value.every((v) => v && typeof v === "object" && typeof v.id === "string")
  ) {
    put({ kind: "list" });
    value.forEach((v, index) => flatten(v, [...path, v.id], cells, index));
  } else if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    put({ kind: "object", ...(rank === undefined ? {} : { rank }) });
    Object.entries(value).forEach(([name, child]) => {
      if (child !== undefined) flatten(child, [...path, name], cells);
    });
  } else put({ kind: "value", value });
  return cells;
}

export function patchShared(
  root: Y.Map<string>,
  before: unknown,
  after: unknown,
  origin: unknown,
) {
  const previous = flatten(before);
  const next = flatten(after);
  root.doc!.transact(() => {
    for (const key of previous.keys()) if (!next.has(key)) root.delete(key);
    for (const [key, value] of next)
      if (previous.get(key) !== value) root.set(key, value);
  }, origin);
}

export function readShared(root: Y.Map<string>): unknown {
  type Node = { cell?: Cell; children: Map<string, Node> };
  const tree: Node = { children: new Map() };
  for (const [key, value] of root) {
    let node = tree;
    for (const part of JSON.parse(key) as string[]) {
      if (!node.children.has(part))
        node.children.set(part, { children: new Map() });
      node = node.children.get(part)!;
    }
    node.cell = JSON.parse(value) as Cell;
  }
  function decode(node: Node): unknown {
    if (!node.cell) return undefined;
    if (node.cell.kind === "value") return node.cell.value;
    const children = [...node.children].filter(([, child]) => child.cell);
    if (node.cell.kind === "list")
      return children
        .sort(([a, x], [b, y]) => {
          const rank = (n: Node) =>
            n.cell?.kind === "object" ? (n.cell.rank ?? 0) : 0;
          return rank(x) - rank(y) || a.localeCompare(b);
        })
        .map(([, child]) => decode(child));
    return Object.fromEntries(
      children.map(([name, child]) => [name, decode(child)]),
    );
  }
  return decode(tree);
}
