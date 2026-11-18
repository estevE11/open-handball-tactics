import { afterEach, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { z } from "zod";
import {
  applyLanguage,
  LANGUAGE_KEY,
  translate,
  useLanguageStore,
} from "./i18n";
import spanish from "./translations/es.json" with { type: "json" };
import { BASIC_KITS, kitDisplayName, newKit } from "./kits";

afterEach(() => {
  useLanguageStore.setState({ language: "en" });
  applyLanguage("en");
  vi.unstubAllGlobals();
});

it("persists the language without changing project preferences and translates validation", () => {
  const values = new Map([["ohb.preferences.v1", "unchanged"]]);
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  useLanguageStore.getState().setLanguage("es");
  expect(values.get(LANGUAGE_KEY)).toBe("es");
  expect(values.get("ohb.preferences.v1")).toBe("unchanged");
  expect(translate("New folder")).toBe("Nueva carpeta");
  expect(z.string().safeParse(1).error?.message).toContain("se esperaba");
  useLanguageStore.getState().setLanguage("en");
  expect(translate("New folder")).toBe("New folder");
});

it("translates canonical errors and interpolation without translating custom values", () => {
  expect(translate("Manage drill {v0}", { v0: "New folder" }, "es")).toBe(
    "Gestionar ejercicio New folder",
  );
  expect(translate("Missing image: Export", {}, "es")).toBe(
    "Falta la imagen: Export",
  );
  expect(
    translate("Delete “Delete drill”? This cannot be undone.", {}, "es"),
  ).toBe("¿Eliminar «Delete drill»? Esta acción no se puede deshacer.");
  expect(translate("Personal note {x}", {}, "es")).toBe("Personal note {x}");
});

it("translates basic kit designs and preserves custom kit names", () => {
  useLanguageStore.getState().setLanguage("es");
  expect(kitDisplayName(BASIC_KITS[0])).toBe("Color liso");
  expect(kitDisplayName({ ...newKit(), name: "Solid color" })).toBe(
    "Solid color",
  );
});

it("has Spanish for every static UI message and built-in error", () => {
  function files(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? files(join(directory, entry.name))
        : [join(directory, entry.name)],
    );
  }
  const missing: string[] = [];
  for (const file of files("src").filter(
    (file) => /\.tsx?$/.test(file) && !file.includes(".test."),
  )) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function visit(node: ts.Node) {
      const call =
        ts.isCallExpression(node) &&
        ["t", "tr", "translate"].includes(node.expression.getText(source));
      const error =
        ts.isNewExpression(node) &&
        ["Error", "DOMException"].includes(node.expression.getText(source));
      if (call || error) {
        const argument = node.arguments?.[0];
        if (
          argument &&
          ts.isStringLiteral(argument) &&
          !Object.hasOwn(spanish, argument.text)
        )
          missing.push(`${file}: ${argument.text}`);
      }
      if (
        ts.isJsxText(node) &&
        /[A-Za-z]/.test(node.getText(source)) &&
        !["English", "Español"].includes(node.getText(source).trim())
      )
        missing.push(
          `${file}: untranslated JSX ${node.getText(source).trim()}`,
        );
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(missing).toEqual([]);
});
