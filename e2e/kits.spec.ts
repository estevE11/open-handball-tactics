import { expect, test, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function inputValue(input: Locator, value: string) {
  await input.evaluate((element, next) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(element, next);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test("kit library creates, edits, reuses and applies kits across roles, formations, and steps", async ({
  page,
}) => {
  await page.goto("/");
  const court = page.locator("#tactical-canvas");
  const dialog = page.getByRole("dialog");
  await page.getByRole("button", { name: "Attacker kit", exact: true }).click();
  await expect(dialog.locator(".kit-card")).toHaveCount(17);
  await dialog.getByRole("button", { name: "Create kit", exact: true }).click();
  await dialog.getByLabel("Kit name").fill("Home red");
  await dialog
    .getByRole("combobox", { name: "Direction", exact: true })
    .selectOption("diagonal");
  await dialog.getByLabel("Stripe count").selectOption("3");
  await inputValue(dialog.getByLabel("Primary color"), "#b32939");
  await inputValue(dialog.getByLabel("Secondary color"), "#f1e7d0");
  await expect(dialog.locator("[data-kit-stripe]")).toHaveCount(6);
  await dialog.getByRole("button", { name: "Save and apply" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    court.locator('[aria-label^="attacker"][data-kit-id]'),
  ).toHaveCount(6);
  await expect(court.locator("[data-kit-stripe]")).toHaveCount(18);
  await expect(
    court.locator('[aria-label^="defender"][data-kit-id]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page.getByRole("button", { name: "2:4", exact: true }).click();
  await expect(
    court.locator('[aria-label^="attacker"][data-kit-id]'),
  ).toHaveCount(6);
  await page.getByRole("button", { name: "Defender kit", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Use Home red", exact: true })
    .click();
  await expect(
    court.locator('[aria-label^="defender"][data-kit-id]'),
  ).toHaveCount(6);
  await page.getByRole("button", { name: "Attacker kit", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Edit Home red", exact: true })
    .click();
  await dialog.getByLabel("Kit name").fill("Home split");
  await dialog
    .getByRole("combobox", { name: "Pattern", exact: true })
    .selectOption("halves");
  await dialog
    .getByRole("combobox", { name: "Direction", exact: true })
    .selectOption("horizontal");
  await dialog.getByRole("button", { name: "Save and apply" }).click();
  await expect(court.locator('[data-kit-pattern="halves"]')).toHaveCount(12);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(court.locator('[data-kit-pattern="stripes"]')).toHaveCount(12);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(court.locator('[data-kit-pattern="halves"]')).toHaveCount(12);
  await page.getByRole("button", { name: /01 Starting positions/ }).click();
  await expect(court.locator('[data-kit-pattern="halves"]')).toHaveCount(12);
  await page.getByLabel("Animation timeline").evaluate((element) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(element, "750");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(court.locator('[data-kit-pattern="halves"]')).toHaveCount(12);
  await page.getByRole("button", { name: "Edit step", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("All changes saved");
  await page.reload();
  await expect(court.locator('[data-kit-pattern="halves"]')).toHaveCount(12);
  await page.getByRole("button", { name: "Attacker kit", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Use player colors", exact: true })
    .click();
  await expect(
    court.locator('[aria-label^="attacker"][data-kit-id]'),
  ).toHaveCount(0);
  await expect(
    court.locator('[aria-label^="defender"][data-kit-id]'),
  ).toHaveCount(6);
  await page.getByLabel("Toggle library").click();
  await page
    .getByRole("button", { name: "New drill", exact: true })
    .first()
    .click();
  await dialog
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Reuse kits");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "Attacker kit", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Use Home split", exact: true })
    .click();
  await expect(court.locator('[data-kit-pattern="halves"]')).toHaveCount(6);
});

test("kit exports are self-contained and render three stripes in PNG, SVG, and an imported offline drill", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog");
  await page.getByRole("button", { name: "Attacker kit", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Edit Horizontal · 3 stripes", exact: true })
    .click();
  await dialog.getByLabel("Kit name").fill("Export stripes");
  await dialog.getByRole("button", { name: "Save and apply" }).click();
  await page.getByLabel("Player labels", { exact: true }).uncheck();
  await page.getByRole("button", { name: /^Export/ }).click();
  const files: Record<string, Buffer> = {};
  for (const name of ["PNG snapshot", "SVG snapshot", "Handball project"]) {
    const downloading = page.waitForEvent("download");
    await dialog.getByRole("button", { name: new RegExp(name) }).click();
    const download = await downloading;
    files[name] = await readFile((await download.path())!);
  }
  // Read pixels through the center of B (labels hidden), counting actual white bands.
  const whiteBands = await page.evaluate(
    async (png) => {
      const image = new Image();
      image.src = png;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      let bands = 0,
        wasWhite = false;
      for (let y = 602; y <= 653; y++) {
        const [r, g, b] = ctx.getImageData(444, y, 1, 1).data;
        const white = r > 245 && g > 245 && b > 245;
        if (white && !wasWhite) bands++;
        wasWhite = white;
      }
      return bands;
    },
    `data:image/png;base64,${files["PNG snapshot"].toString("base64")}`,
  );
  expect(whiteBands).toBe(3);
  const exported = await page.context().newPage();
  await exported.setContent(files["SVG snapshot"].toString());
  await expect(exported.locator("[data-kit-stripe]")).toHaveCount(18);
  expect(
    await exported.locator('circle[fill^="url"]').evaluateAll((elements) =>
      elements.every((element) => {
        const id = element.getAttribute("fill")!.slice(5, -1);
        return document.getElementById(id)?.tagName === "pattern";
      }),
    ),
  ).toBe(true);
  await exported.close();
  const fresh = await browser.newContext();
  const imported = await fresh.newPage();
  await imported.goto(page.url());
  await expect(
    imported.getByRole("heading", { name: "Build the attack" }),
  ).toBeVisible();
  await imported.locator('input[type="file"][accept^=".hbd"]').setInputFiles({
    name: "kits.hbd",
    mimeType: "application/json",
    buffer: files["Handball project"],
  });
  await expect(
    imported.locator("#tactical-canvas [data-kit-stripe]"),
  ).toHaveCount(18);
  await expect(imported.getByRole("status")).toHaveText("All changes saved");
  await imported.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await imported.reload();
  await expect
    .poll(() => imported.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await fresh.setOffline(true);
  await imported.reload();
  await expect(
    imported.locator("#tactical-canvas [data-kit-stripe]"),
  ).toHaveCount(18);
  await imported
    .getByRole("button", { name: "Attacker kit", exact: true })
    .click();
  await imported
    .getByRole("button", { name: "Edit Export stripes", exact: true })
    .click();
  await expect(imported.getByLabel("Stripe count")).toHaveValue("3");
  await fresh.close();
});

test("kit menu and editor work on mobile in dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.getByLabel("Toggle settings").click();
  await page.getByRole("button", { name: "Defender kit", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Reverse diagonal halves", exact: true })
    .click();
  await page.getByLabel("Kit name").fill("Away kit");
  await inputValue(page.getByLabel("Primary color"), "#bb2244");
  await inputValue(page.getByLabel("Secondary color"), "#ffd166");
  const box = (await page.getByRole("dialog").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "/tmp/handball-kit-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save and apply" }).click();
  await expect(
    page.locator('#tactical-canvas [data-kit-pattern="halves"]'),
  ).toHaveCount(6);
});
