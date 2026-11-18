import { expect, test, type Page } from "@playwright/test";
import { newProject } from "../src/lib/projectDefaults";
import type { FolderNode } from "../src/types/project";

async function seedLibrary(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Build the attack" }),
  ).toBeVisible();
  const folders: FolderNode[] = [
    {
      id: "offense",
      name: "Offense",
      parentId: null,
      childrenFolderIds: [],
      drillIds: [],
    },
    {
      id: "def",
      name: "DEF",
      parentId: "offense",
      childrenFolderIds: [],
      drillIds: [],
    },
    {
      id: "exercises",
      name: "exercicis",
      parentId: "def",
      childrenFolderIds: [],
      drillIds: [],
    },
    {
      id: "empty",
      name: "Another folder",
      parentId: "def",
      childrenFolderIds: [],
      drillIds: [],
    },
    {
      id: "grandchild",
      name: "Hidden grandchild",
      parentId: "exercises",
      childrenFolderIds: [],
      drillIds: [],
    },
    {
      id: "other",
      name: "Other",
      parentId: null,
      childrenFolderIds: [],
      drillIds: [],
    },
  ];
  const projects = [
    newProject("Parent drill", "def"),
    newProject("Zebra drill", "def"),
    newProject("Child drill", "exercises"),
    newProject("Other drill", "other"),
  ];
  projects[0].tags = ["Defense"];
  for (const folder of folders) {
    folder.childrenFolderIds = folders
      .filter((f) => f.parentId === folder.id)
      .map((f) => f.id);
    folder.drillIds = projects
      .filter((p) => p.folderId === folder.id)
      .map((p) => p.id);
  }
  await page.evaluate(
    async ({ folders, projects }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("ohb.library.v1");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            ["folders", "projects"],
            "readwrite",
          );
          folders.forEach((folder) =>
            transaction.objectStore("folders").put(folder),
          );
          projects.forEach((project) =>
            transaction.objectStore("projects").put(project),
          );
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => {
            database.close();
            reject(transaction.error);
          };
        };
      });
    },
    { folders, projects },
  );
  await page.reload();
  await expect(page.getByLabel("Interactive handball court")).toBeVisible();
  await page.getByLabel("Toggle library").click();
}

for (const width of [1440, 390]) {
  test(`${width}px explorer creates folders and drills in the current location from its header`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: width === 1440 ? "dark" : "light" });
    await seedLibrary(page);
    const activeTitle = await page.locator(".topbar h1").textContent();
    await page.getByLabel("Open library explorer", { exact: true }).click();
    const explorer = page.getByRole("dialog", {
      name: "Library explorer",
      exact: true,
    });
    const heading = explorer.locator(".modal-heading");
    const path = explorer.getByRole("navigation", {
      name: "Current folder path",
    });
    const newFolder = heading.getByRole("button", {
      name: "New folder",
      exact: true,
    });
    const newDrill = heading.getByRole("button", {
      name: "New drill",
      exact: true,
    });
    const close = heading.getByRole("button", {
      name: "Close dialog",
      exact: true,
    });
    const positions = await Promise.all(
      [newFolder, newDrill, close].map((button) => button.boundingBox()),
    );
    expect(positions[0]!.x).toBeLessThan(positions[1]!.x);
    expect(positions[1]!.x).toBeLessThan(positions[2]!.x);
    expect(positions[0]!.y).toBeCloseTo(positions[1]!.y);
    for (const [name, parent] of [
      ["Root", ""],
      ["Nested", "def"],
    ]) {
      if (parent) {
        await explorer
          .getByRole("button", { name: "Open folder Offense", exact: true })
          .click();
        await explorer
          .getByRole("button", { name: "Open folder DEF", exact: true })
          .click();
        await explorer.getByLabel("List view", { exact: true }).click();
      }
      const originalPath = await path.textContent();
      await explorer
        .getByLabel("Search library", { exact: true })
        .fill("nothing matches this search");
      await newFolder.click();
      const folderForm = page.getByRole("dialog", {
        name: "Create a folder",
        exact: true,
      });
      await expect(
        folderForm.getByRole("combobox", { name: "Folder", exact: true }),
      ).toHaveValue(parent);
      await folderForm
        .getByRole("textbox", { name: "Name", exact: true })
        .fill(`${name} new folder`);
      await folderForm
        .getByRole("button", { name: "Create", exact: true })
        .click();
      await expect(folderForm).not.toBeVisible();
      await expect(explorer).toBeVisible();
      await expect(path).toHaveText(originalPath!);
      await expect(
        explorer.getByLabel("Search library", { exact: true }),
      ).toHaveValue("");
      await expect(
        explorer.getByRole("button", {
          name: `Open folder ${name} new folder`,
          exact: true,
        }),
      ).toBeVisible();
      await newDrill.click();
      const drillForm = page.getByRole("dialog", {
        name: "Create a drill",
        exact: true,
      });
      await expect(
        drillForm.getByRole("combobox", { name: "Folder", exact: true }),
      ).toHaveValue(parent);
      await drillForm
        .getByRole("textbox", { name: "Name", exact: true })
        .fill(`${name} new drill`);
      await drillForm
        .getByRole("button", { name: "Create", exact: true })
        .click();
      await expect(drillForm).not.toBeVisible();
      await expect(explorer).toBeVisible();
      await expect(path).toHaveText(originalPath!);
      await expect(page.locator(".topbar h1")).toHaveText(activeTitle!);
      await explorer
        .getByRole("button", {
          name: `Manage drill ${name} new drill`,
          exact: true,
        })
        .click();
      const details = page.getByRole("dialog", {
        name: "Drill details",
        exact: true,
      });
      await expect(
        details.getByRole("combobox", { name: "Folder", exact: true }),
      ).toHaveValue(parent);
      await details.getByLabel("Close dialog", { exact: true }).click();
      await page.screenshot({
        path: `test-results/explorer-create-${width}-${name}.png`,
      });
      expect(
        await explorer.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      ).toBe(true);
    }
  });
}

test("sidebar drill menus edit, move, duplicate and delete the chosen drill without changing the active board", async ({
  page,
}) => {
  await seedLibrary(page);
  const sidebar = page.locator("#library-sidebar");
  await sidebar
    .locator(".drill-card")
    .filter({ hasText: "Build the attack" })
    .click();
  await page.getByLabel("Toggle library").click();
  const header = page.locator(".topbar h1");
  const details = page.getByRole("dialog", {
    name: "Drill details",
    exact: true,
  });
  await sidebar
    .getByRole("button", { name: "Manage drill Parent drill", exact: true })
    .click();
  await expect(header).toHaveText("Build the attack");
  await expect(details.getByLabel("Name", { exact: true })).toHaveValue(
    "Parent drill",
  );
  await details.getByLabel("Name", { exact: true }).fill("Edited parent");
  await details
    .getByRole("combobox", { name: "Folder", exact: true })
    .selectOption("other");
  await details.getByLabel("Tags", { exact: true }).fill("U17, Defense");
  await details
    .getByRole("textbox", { name: "Coaching notes", exact: true })
    .fill("Keep the wings wide.");
  await details
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(details).not.toBeVisible();
  await expect(header).toHaveText("Build the attack");
  await sidebar
    .getByRole("button", { name: "Manage drill Edited parent", exact: true })
    .click();
  await details
    .getByRole("button", { name: "Duplicate drill", exact: true })
    .click();
  await expect(details).not.toBeVisible();
  await expect(header).toHaveText("Build the attack");
  await sidebar
    .getByRole("button", {
      name: "Manage drill Edited parent (copy)",
      exact: true,
    })
    .click();
  await expect(
    details.getByRole("combobox", { name: "Folder", exact: true }),
  ).toHaveValue("other");
  await expect(details.getByLabel("Tags", { exact: true })).toHaveValue(
    "U17, Defense",
  );
  await expect(
    details.getByRole("textbox", { name: "Coaching notes", exact: true }),
  ).toHaveValue("Keep the wings wide.");
  await page.screenshot({ path: "test-results/sidebar-drill-actions.png" });
  page.once("dialog", (dialog) => dialog.dismiss());
  await details
    .getByRole("button", { name: "Delete drill", exact: true })
    .click();
  await expect(details).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await details
    .getByRole("button", { name: "Delete drill", exact: true })
    .click();
  await expect(details).not.toBeVisible();
  await expect(
    sidebar.getByRole("button", {
      name: "Manage drill Edited parent (copy)",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    sidebar.getByRole("button", {
      name: "Manage drill Edited parent",
      exact: true,
    }),
  ).toBeVisible();
  await expect(header).toHaveText("Build the attack");
  await page.reload();
  await page.getByLabel("Toggle library").click();
  await sidebar
    .getByRole("button", { name: "Manage drill Edited parent", exact: true })
    .click();
  await expect(
    details.getByRole("combobox", { name: "Folder", exact: true }),
  ).toHaveValue("other");
  await expect(details.getByLabel("Tags", { exact: true })).toHaveValue(
    "U17, Defense",
  );
});

test("deleting the active last drill through its sidebar menu leaves a usable board", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Toggle library").click();
  await page
    .getByRole("button", { name: "Manage drill Build the attack", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("dialog", { name: "Drill details", exact: true })
    .getByRole("button", { name: "Delete drill", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".topbar h1")).toHaveText("Untitled drill");
  await expect(page.getByLabel("Interactive handball court")).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`${width}px explorer drill menus manage non-active drills in both grid and list views`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await seedLibrary(page);
    const sidebar = page.locator("#library-sidebar");
    await sidebar
      .locator(".drill-card")
      .filter({ hasText: "Build the attack" })
      .click();
    await page.getByLabel("Toggle library").click();
    await page.getByLabel("Open library explorer", { exact: true }).click();
    const explorer = page.getByRole("dialog", {
      name: "Library explorer",
      exact: true,
    });
    const details = page.getByRole("dialog", {
      name: "Drill details",
      exact: true,
    });
    let title = "Parent drill";
    for (const view of ["Grid", "List"]) {
      await explorer.getByLabel(`${view} view`, { exact: true }).click();
      await explorer
        .getByRole("button", { name: `Manage drill ${title}`, exact: true })
        .click();
      title = `${view} edited`;
      await details.getByLabel("Name", { exact: true }).fill(title);
      await details
        .getByRole("combobox", { name: "Folder", exact: true })
        .selectOption("other");
      await details
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(explorer).toBeVisible();
      await expect(page.locator(".topbar h1")).toHaveText("Build the attack");
      await explorer
        .getByRole("button", { name: `Manage drill ${title}`, exact: true })
        .click();
      await page.screenshot({
        path: `test-results/explorer-drill-actions-${width}-${view}.png`,
      });
      await details
        .getByRole("button", { name: "Duplicate drill", exact: true })
        .click();
      await expect(explorer).toBeVisible();
      await explorer
        .getByRole("button", {
          name: `Manage drill ${title} (copy)`,
          exact: true,
        })
        .click();
      page.once("dialog", (dialog) => dialog.accept());
      await details
        .getByRole("button", { name: "Delete drill", exact: true })
        .click();
      await expect(explorer).toBeVisible();
      await expect(
        explorer.getByRole("button", {
          name: `Manage drill ${title} (copy)`,
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        explorer.getByRole("button", {
          name: `Manage drill ${title}`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator(".topbar h1")).toHaveText("Build the attack");
    }
    expect(
      await explorer.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
  });
}

test("sidebar shows only the current path, lists child folders first, and has one New drill action", async ({
  page,
}) => {
  await seedLibrary(page);
  const sidebar = page.locator("#library-sidebar");
  const path = sidebar.getByRole("navigation", { name: "Current folder path" });
  const contents = sidebar.getByRole("list", { name: "Folder contents" });
  await expect(path.locator(".path-link")).toHaveText(["All drills"]);
  await contents
    .getByRole("button", { name: "Open folder Offense", exact: true })
    .click();
  await contents
    .getByRole("button", { name: "Open folder DEF", exact: true })
    .click();
  await expect(path.locator(".path-link")).toHaveText([
    "All drills",
    "Offense",
    "DEF",
  ]);
  await expect(path).not.toContainText("exercicis");
  await expect(contents.locator(":scope > li")).toHaveCount(4);
  await expect(contents.locator(":scope > li").nth(0)).toContainText(
    "Another folder",
  );
  await expect(contents.locator(":scope > li").nth(1)).toContainText(
    "exercicis",
  );
  await expect(
    contents.locator(":scope > li").nth(2).locator(".drill-card"),
  ).toHaveCount(1);
  await expect(
    contents.locator(":scope > li").nth(3).locator(".drill-card"),
  ).toHaveCount(1);
  await expect(contents).not.toContainText("Child drill");
  await expect(contents).not.toContainText("Hidden grandchild");
  await expect(
    sidebar.getByRole("button", { name: "New drill", exact: true }),
  ).toHaveCount(1);
  await expect(
    sidebar.getByRole("button", { name: "Create a drill", exact: true }),
  ).toHaveCount(0);
  await expect(sidebar.locator(".new-drill")).toHaveCount(0);
  await contents
    .getByRole("button", { name: "Open folder exercicis", exact: true })
    .click();
  await expect(path.locator(".path-link")).toHaveText([
    "All drills",
    "Offense",
    "DEF",
    "exercicis",
  ]);
  await expect(contents.locator(":scope > li").first()).toContainText(
    "Hidden grandchild",
  );
  await expect(contents.locator(".drill-card")).toContainText("Child drill");
  await path.getByRole("button", { name: "DEF", exact: true }).click();
  await contents
    .getByRole("button", { name: "Open folder Another folder", exact: true })
    .click();
  await expect(contents).toHaveText("A fresh space for your next idea.");
  await expect(
    sidebar.getByRole("button", { name: "New drill", exact: true }),
  ).toHaveCount(1);
  await expect(
    sidebar.getByRole("button", { name: "Create a drill", exact: true }),
  ).toHaveCount(0);
  await sidebar.getByRole("button", { name: "New drill", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Create a drill", exact: true })
      .locator('select[name="parent"]'),
  ).toHaveValue("empty");
});

test("explorer shares folder navigation and ordering across grid/list, search, management, and opening drills", async ({
  page,
}) => {
  await seedLibrary(page);
  const sidebar = page.locator("#library-sidebar");
  await sidebar
    .getByRole("button", { name: "Open folder Offense", exact: true })
    .click();
  await sidebar
    .getByRole("button", { name: "Open folder DEF", exact: true })
    .click();
  await page.getByLabel("Open library explorer", { exact: true }).click();
  const explorer = page.getByRole("dialog", {
    name: "Library explorer",
    exact: true,
  });
  const contents = explorer.getByRole("list", { name: "Folder contents" });
  const tree = explorer.getByRole("complementary", {
    name: "Library folder tree",
  });
  await expect(explorer).toBeVisible();
  expect((await explorer.boundingBox())!.width).toBeGreaterThan(800);
  await expect(
    tree.getByRole("button", { name: "Collapse Offense", exact: true }),
  ).toBeVisible();
  await expect(
    explorer.getByLabel("Grid view", { exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(contents).toHaveCSS("display", "grid");
  await expect(contents.locator(":scope > li").first()).toContainText(
    "Another folder",
  );
  await page.screenshot({ path: "test-results/library-explorer-grid.png" });
  await explorer.getByLabel("List view", { exact: true }).click();
  await expect(contents).toHaveCSS("display", "block");
  await expect(contents.locator(":scope > li").first()).toContainText(
    "Another folder",
  );
  await explorer.getByLabel("Search library", { exact: true }).fill("Defense");
  await expect(contents.locator(".drill-card")).toHaveCount(1);
  await expect(contents).toContainText("Parent drill");
  await explorer.getByLabel("Clear library search", { exact: true }).click();
  await explorer
    .getByLabel("Search library", { exact: true })
    .fill("exercicis");
  await expect(contents.locator(".library-folder")).toHaveCount(1);
  await contents
    .getByRole("button", { name: "Open folder exercicis", exact: true })
    .click();
  await expect(
    explorer.getByLabel("Search library", { exact: true }),
  ).toHaveValue("");
  await expect(contents).toContainText("Child drill");
  await explorer.getByLabel("Parent folder", { exact: true }).click();
  await expect(contents.locator(".drill-card")).toHaveCount(2);
  await tree.getByRole("button", { name: "Other 1", exact: true }).click();
  await tree.getByLabel("Manage Other", { exact: true }).click();
  const manage = page.getByRole("dialog", {
    name: "Manage folder",
    exact: true,
  });
  await manage
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Archive");
  await manage
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(manage).not.toBeVisible();
  await expect(
    explorer.getByRole("navigation", { name: "Current folder path" }),
  ).toContainText("Archive");
  await expect(
    sidebar.getByRole("navigation", { name: "Current folder path" }),
  ).toContainText("Archive");
  await page.screenshot({ path: "test-results/library-explorer-list.png" });
  await page.keyboard.press("Escape");
  await expect(explorer).not.toBeVisible();
  await expect(sidebar).toHaveAttribute("aria-hidden", "false");
  await page.getByLabel("Open library explorer", { exact: true }).click();
  await explorer
    .locator(".drill-card")
    .filter({ hasText: "Other drill" })
    .click();
  await expect(explorer).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Other drill", exact: true }),
  ).toBeVisible();
  await expect(sidebar).toHaveAttribute("aria-hidden", "true");
});

test("mobile dark explorer keeps list/grid and the complete tree usable without overflowing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedLibrary(page);
  await page
    .getByLabel("Close library", { exact: true })
    .click({ position: { x: 385, y: 400 } });
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page
    .getByRole("button", { name: "Switch to dark mode", exact: true })
    .click();
  await page.getByLabel("Toggle library", { exact: true }).click();
  await page.getByLabel("Open library explorer", { exact: true }).click();
  const explorer = page.getByRole("dialog", {
    name: "Library explorer",
    exact: true,
  });
  const tree = explorer.getByRole("complementary", {
    name: "Library folder tree",
  });
  await expect(tree).not.toBeVisible();
  await explorer.getByLabel("Toggle folder tree", { exact: true }).click();
  await expect(tree).toBeVisible();
  await tree.locator(".folder-select").filter({ hasText: "DEF" }).click();
  await expect(tree).not.toBeVisible();
  await expect(
    explorer.getByRole("navigation", { name: "Current folder path" }),
  ).toContainText("DEF");
  const contents = explorer.getByRole("list", { name: "Folder contents" });
  await expect(contents.locator(":scope > li").first()).toContainText(
    "Another folder",
  );
  await page.screenshot({
    path: "test-results/library-explorer-mobile-grid.png",
  });
  await explorer.getByLabel("List view", { exact: true }).click();
  await expect(contents).toHaveCSS("display", "block");
  expect(
    await explorer.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const box = (await explorer.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(390);
  expect(box.height).toBeLessThanOrEqual(844);
  await page.screenshot({
    path: "test-results/library-explorer-mobile-list.png",
  });
  await explorer.getByLabel("Close dialog", { exact: true }).click();
  await expect(explorer).not.toBeVisible();
});
