import { expect, test, type Page } from "@playwright/test";
import { newProject } from "../src/lib/projectDefaults";
import { newKit } from "../src/lib/kits";

async function storedProjects(page: Page) {
  return page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const request = indexedDB.open("ohb.library.v1");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const read = db
            .transaction("projects")
            .objectStore("projects")
            .getAll();
          read.onsuccess = () => {
            db.close();
            resolve(read.result);
          };
          read.onerror = () => reject(read.error);
        };
      }),
  );
}

test("language switches and persists while custom names, labels, kits and project data stay untouched", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Interactive handball court")).toBeVisible();
  const custom = newProject("Export", "custom-folder");
  custom.tags = ["Editor", "New folder"];
  custom.description = "Keep this English coaching note exactly as entered.";
  custom.keyframes[0].name = "Animation";
  custom.keyframes[0].tokens.find(
    (token) => token.role === "attacker" && token.label === "B",
  )!.label = "New folder";
  custom.teamKits = { attacker: { ...newKit(), name: "Solid color" } };
  await page.evaluate(
    (project) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("ohb.library.v1");
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(
            ["projects", "folders"],
            "readwrite",
          );
          transaction.objectStore("projects").clear();
          transaction.objectStore("projects").put(project);
          transaction.objectStore("folders").put({
            id: "custom-folder",
            name: "Help",
            parentId: null,
            childrenFolderIds: [],
            drillIds: [project.id],
          });
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    custom,
  );
  await page.reload();
  const before = await storedProjects(page);
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Interface language", exact: true })
    .selectOption("es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(
    page.getByRole("button", { name: "Duplicar", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Compartir sala en directo",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Exportar", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(
    "Todos los cambios guardados",
  );
  await expect(page.locator(".topbar h1")).toHaveText("Export");
  await expect(page.locator(".topbar .tag").first()).toHaveText("Editor");
  await expect(
    page.getByRole("button", { name: "Seleccionar y mover (V)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Portero", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Plantilla", exact: true }),
  ).toHaveValue("half");
  await expect(
    page.getByRole("button", { name: "Equipación: Atacante", exact: true }),
  ).toContainText("Solid color");
  const court = page.getByLabel("Pista de balonmano interactiva", {
    exact: true,
  });
  await court
    .getByRole("img", { name: "atacante New folder", exact: true })
    .dblclick();
  const properties = page.getByRole("dialog", {
    name: "Propiedades del elemento",
    exact: true,
  });
  await expect(
    properties.getByRole("heading", {
      name: "Propiedades del atacante",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    properties.getByRole("textbox", {
      name: "Etiqueta de la ficha",
      exact: true,
    }),
  ).toHaveValue("New folder");
  await expect(properties.getByLabel("Brazos", { exact: true })).toBeVisible();
  await expect(
    properties.getByRole("button", { name: "Usar círculo", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/spanish-properties.png" });
  await properties
    .getByLabel("Cerrar propiedades del elemento", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Equipación: Atacante", exact: true })
    .click();
  const kits = page.getByRole("dialog");
  await expect(
    kits.getByRole("heading", { name: "Diseños básicos", exact: true }),
  ).toBeVisible();
  await expect(
    kits.getByRole("button", {
      name: "Usar Diagonal inversa · 3 franjas",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    kits.getByRole("button", { name: "Usar Solid color", exact: true }),
  ).toBeVisible();
  await kits.getByLabel("Cerrar diálogo", { exact: true }).click();
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  const exporting = page.getByRole("dialog", {
    name: "Llévate tu trabajo",
    exact: true,
  });
  await expect(
    exporting.getByRole("button", { name: /^Imagen PNG/ }),
  ).toBeVisible();
  await expect(
    exporting.getByRole("button", { name: /^Imagen SVG/ }),
  ).toBeVisible();
  await expect(
    exporting.getByRole("button", { name: /^Proyecto de balonmano/ }),
  ).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    }),
  );
  await exporting
    .getByRole("button", { name: "Copiar imagen al portapapeles", exact: true })
    .click();
  await expect(exporting.getByRole("alert")).toContainText(
    "Este navegador no puede copiar imágenes.",
  );
  await exporting.getByLabel("Cerrar diálogo", { exact: true }).click();
  await page.getByRole("button", { name: "Más acciones", exact: true }).click();
  await page.getByRole("button", { name: "Ayuda", exact: true }).click();
  const help = page.getByRole("dialog", {
    name: "Tu espacio de trabajo local",
    exact: true,
  });
  await expect(
    help.getByText("Tus ideas. Tu pista.", { exact: true }),
  ).toBeVisible();
  await expect(help).toContainText(
    "Los ejercicios y las imágenes se guardan en este navegador",
  );
  await help.getByLabel("Cerrar diálogo", { exact: true }).click();
  expect(await storedProjects(page)).toEqual(before);
  await page.getByRole("button", { name: "Más acciones", exact: true }).click();
  await page
    .getByRole("button", { name: "Valores predeterminados", exact: true })
    .click();
  const preferences = page.getByRole("dialog", {
    name: "Valores predeterminados",
    exact: true,
  });
  await expect(
    preferences.getByRole("combobox", {
      name: "Tema de la interfaz",
      exact: true,
    }),
  ).toBeVisible();
  await preferences
    .getByRole("combobox", { name: "Idioma de la interfaz", exact: true })
    .selectOption("en");
  await page
    .getByRole("dialog", { name: "Workspace defaults", exact: true })
    .getByLabel("Close dialog", { exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("button", { name: "Export", exact: true }),
  ).toBeVisible();
  await page.reload();
  expect(await storedProjects(page)).toEqual(before);
});

test("Spanish startup, animation, library creation and drill actions work on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.addInitScript(() => localStorage.setItem("ohb.language.v1", "es"));
  await page.goto("/");
  await expect(page.locator(".topbar h1")).toHaveText("Construye el ataque");
  await page
    .getByRole("button", { name: "Mostrar u ocultar ajustes", exact: true })
    .click();
  await page.getByRole("tab", { name: "Animación", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /01 Posiciones iniciales/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Añadir paso", exact: true }).click();
  await expect(page.getByRole("button", { name: /02 Paso 2/ })).toBeVisible();
  await page
    .getByRole("button", { name: "Mostrar u ocultar ajustes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mostrar u ocultar biblioteca", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Abrir explorador de la biblioteca",
      exact: true,
    })
    .click();
  const explorer = page.getByRole("dialog", {
    name: "Explorador de la biblioteca",
    exact: true,
  });
  await explorer
    .getByRole("button", { name: "Nueva carpeta", exact: true })
    .click();
  const folder = page.getByRole("dialog", {
    name: "Crear una carpeta",
    exact: true,
  });
  await folder
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("My folder");
  await folder.getByRole("button", { name: "Crear", exact: true }).click();
  await explorer
    .getByRole("button", { name: "Abrir carpeta My folder", exact: true })
    .click();
  await explorer
    .getByRole("button", { name: "Nuevo ejercicio", exact: true })
    .click();
  const creating = page.getByRole("dialog", {
    name: "Crear un ejercicio",
    exact: true,
  });
  await creating
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("English label");
  await creating.getByRole("button", { name: "Crear", exact: true }).click();
  await explorer
    .getByRole("button", {
      name: "Gestionar ejercicio English label",
      exact: true,
    })
    .click();
  const details = page.getByRole("dialog", {
    name: "Detalles del ejercicio",
    exact: true,
  });
  await expect(
    details.getByRole("textbox", { name: "Nombre", exact: true }),
  ).toHaveValue("English label");
  await details
    .getByRole("button", { name: "Duplicar ejercicio", exact: true })
    .click();
  await explorer
    .getByRole("button", {
      name: "Gestionar ejercicio English label (copia)",
      exact: true,
    })
    .click();
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe(
      "¿Eliminar «English label (copia)»? Esta acción no se puede deshacer.",
    );
    await dialog.accept();
  });
  await details
    .getByRole("button", { name: "Eliminar ejercicio", exact: true })
    .click();
  await expect(
    explorer.getByRole("button", {
      name: "Gestionar ejercicio English label (copia)",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.screenshot({ path: "test-results/spanish-explorer-mobile.png" });
  expect(
    await explorer.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
