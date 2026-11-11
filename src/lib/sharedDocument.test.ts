import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { patchShared, readShared } from "./sharedDocument";

function setup() {
  const a = new Y.Doc(),
    b = new Y.Doc();
  const rootA = a.getMap<string>("board"),
    rootB = b.getMap<string>("board");
  const initial = {
    title: "Attack",
    tokens: [
      { id: "a", label: "A", position: { x: 10, y: 20 } },
      { id: "b", label: "B", position: { x: 30, y: 40 } },
    ],
    settings: { grid: false, colors: ["red", "blue"] },
    drawings: [],
  };
  patchShared(rootA, undefined, initial, "seed");
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  const merge = () => {
    const fromA = Y.encodeStateAsUpdate(a),
      fromB = Y.encodeStateAsUpdate(b);
    Y.applyUpdate(a, fromB);
    Y.applyUpdate(b, fromA);
    expect(readShared(rootA)).toEqual(readShared(rootB));
  };
  return { a, b, rootA, rootB, initial, merge };
}

describe("peer document merging", () => {
  it("merges simultaneous player moves, settings, and additions across disconnection", () => {
    const { rootA, rootB, initial, merge } = setup();
    const left = structuredClone(initial),
      right = structuredClone(initial);
    left.tokens[0].position.x = 100;
    right.tokens[1].position.y = 200;
    left.settings.grid = true;
    left.tokens.push({ id: "new-a", label: "C", position: { x: 1, y: 2 } });
    right.tokens.push({ id: "new-b", label: "D", position: { x: 3, y: 4 } });
    patchShared(rootA, initial, left, "local");
    patchShared(rootB, initial, right, "local");
    merge();
    merge(); // Duplicate full-state exchange is harmless.
    const result = readShared(rootA) as typeof initial;
    expect(result.tokens.map((t) => t.id)).toEqual([
      "a",
      "b",
      "new-a",
      "new-b",
    ]);
    expect(result.tokens[0].position.x).toBe(100);
    expect(result.tokens[1].position.y).toBe(200);
    expect(result.settings.grid).toBe(true);
  });

  it("keeps a deletion when another peer moves that player", () => {
    const { rootA, rootB, initial, merge } = setup();
    const left = structuredClone(initial),
      right = structuredClone(initial);
    left.tokens.shift();
    right.tokens[0].position.x = 999;
    patchShared(rootA, initial, left, "local");
    patchShared(rootB, initial, right, "local");
    merge();
    expect(
      (readShared(rootA) as typeof initial).tokens.map((t) => t.id),
    ).toEqual(["b"]);
  });

  it("undoes only local edits and preserves a peer's changes", () => {
    const { a, b, rootA, rootB, initial } = setup();
    const undo = new Y.UndoManager(rootA, {
      trackedOrigins: new Set(["local"]),
    });
    const left = structuredClone(initial);
    left.tokens[0].label = "Wing";
    patchShared(rootA, initial, left, "local");
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    const before = readShared(rootB) as typeof initial;
    const right = structuredClone(before);
    right.tokens[1].label = "Pivot";
    patchShared(rootB, before, right, "remote");
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    undo.undo();
    const result = readShared(rootA) as typeof initial;
    expect(result.tokens.map((t) => t.label)).toEqual(["A", "Pivot"]);
    undo.redo();
    expect(
      (readShared(rootA) as typeof initial).tokens.map((t) => t.label),
    ).toEqual(["Wing", "Pivot"]);
  });

  it("preserves reorder, empty collections, optional fields, and unusual IDs", () => {
    const a = new Y.Doc(),
      root = a.getMap<string>("board");
    const before = {
      items: [
        { id: "a/[]", value: 1 },
        { id: "__proto__", value: 2 },
      ],
      points: [{ x: 1, y: 2 }],
      optional: { value: true },
    };
    patchShared(root, undefined, before, "local");
    const after = { items: [...before.items].reverse(), points: [] };
    patchShared(root, before, after, "local");
    expect(readShared(root)).toEqual(after);
  });
});
