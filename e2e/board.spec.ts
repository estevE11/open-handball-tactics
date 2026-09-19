import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("formations, dragging, arrows, undo, steps, exports, and offline reload", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Build the attack" }),
  ).toBeVisible();
  const court = page.getByLabel("Interactive handball court");
  await expect(court.locator('[aria-label^="defender"]')).toHaveCount(6);
  await expect(court.locator('[aria-label^="attacker"]')).toHaveCount(6);
  await page.getByRole("button", { name: "5:1", exact: true }).click();
  await expect(court.getByRole("img", { name: "defender Av" })).toBeVisible();
  const attacker = court.getByRole("img", { name: "attacker C", exact: true });
  const before = await attacker.getAttribute("transform");
  const box = (await attacker.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 50, box.y + 30, { steps: 5 });
  await page.mouse.up();
  await expect(attacker).not.toHaveAttribute("transform", before!);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(attacker).toHaveAttribute("transform", before!);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(attacker).not.toHaveAttribute("transform", before!);
  await page.getByRole("button", { name: "Pass arrow", exact: true }).click();
  const cb = (await court.boundingBox())!;
  await page.mouse.move(cb.x + cb.width * 0.4, cb.y + cb.height * 0.65);
  await page.mouse.down();
  await page.mouse.move(cb.x + cb.width * 0.6, cb.y + cb.height * 0.75, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(court.locator('path[stroke-dasharray="7 6"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page.getByText("Step 2", { exact: true }).first().click();
  await page.getByLabel("Onion skin").check();
  await page.getByLabel("Template").selectOption("full");
  await expect(court).toHaveAttribute("viewBox", "-22 -25 444 850");
  await page.getByLabel("Template").selectOption("half");
  await expect(page.getByRole("status")).toHaveText("All changes saved");
  await page.reload();
  await expect(court.getByRole("img", { name: "defender Av" })).toBeVisible();
  await expect(page.getByRole("button", { name: /02 Step 2/ })).toBeVisible();
  await page.getByRole("button", { name: /^Export/ }).click();
  for (const name of ["Handball project", "PNG snapshot", "SVG snapshot"]) {
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: new RegExp(name) }).click();
    const download = await downloading;
    expect(await download.failure()).toBeNull();
    const bytes = await readFile((await download.path())!);
    expect(bytes.length).toBeGreaterThan(300);
    if (name === "Handball project")
      expect(JSON.parse(bytes.toString()).project.keyframes).toHaveLength(2);
  }
  await page.getByLabel("Close dialog").click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Build the attack" }),
  ).toBeVisible();
  await expect(
    page.getByText("Working offline", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "6:0", exact: true }).click();
  await expect(court.getByRole("img", { name: "defender Av" })).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("All changes saved");
  expect(errors).toEqual([]);
});

test("nested folders, drill metadata, binary assets, import, and duplication", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Build the attack" }),
  ).toBeVisible();
  await page.getByLabel("Create folder").click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Offense");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByLabel("Create folder").click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Fastbreaks");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page
    .getByRole("button", { name: "New drill", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Wing overload");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Wing overload" }),
  ).toBeVisible();
  await page.getByLabel("Drill details").click();
  await page
    .getByRole("textbox", { name: "Tags", exact: true })
    .fill("U15, Pivot");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByLabel("Search drills").fill("U15");
  await expect(page.locator(".drill-card")).toHaveCount(1);
  await page
    .locator('input[type="file"][accept^="image/png"]')
    .setInputFiles("public/icon-192.png");
  await page.getByRole("button", { name: "Add icon-192.png" }).click();
  await expect(page.locator("#tactical-canvas image")).toHaveCount(1);
  await expect(page.getByRole("status")).toHaveText("All changes saved");
  await page.reload();
  await expect(page.locator("#tactical-canvas image")).toHaveCount(1);
  await expect
    .poll(() => page.locator("#tactical-canvas image").getAttribute("href"))
    .toMatch(/^blob:/);
  await page.getByRole("button", { name: /^Export/ }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /Handball project/ }).click();
  const download = await downloading;
  const backup = await readFile((await download.path())!);
  const json = JSON.parse(backup.toString());
  expect(json.assets[0].data).toMatch(/^data:image\/png;base64,/);
  await page.getByLabel("Close dialog").click();
  await page
    .locator('input[type="file"][accept^=".hbd"]')
    .setInputFiles({
      name: "backup.hbd",
      mimeType: "application/json",
      buffer: backup,
    });
  await expect(page.locator(".drill-card")).toHaveCount(3);
  await expect(page.locator("#tactical-canvas image")).toHaveCount(1);
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Wing overload (copy)" }),
  ).toBeVisible();
  await page.getByLabel("Search drills").fill("Offense");
  await expect(page.locator(".drill-card")).toHaveCount(1);
});

test("mobile workspace stays within viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Build the attack" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByLabel("Toggle settings").click();
  await page.getByLabel("Template").selectOption("custom_box");
  await expect(page.getByLabel("width (m)")).toBeVisible();
  await page.getByLabel("Toggle settings").click();
  await page.getByLabel("Toggle library").click();
  await expect(page.getByLabel("Create folder")).toBeVisible();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
