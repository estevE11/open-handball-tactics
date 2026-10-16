import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function courtPoint(page: Page, x: number, y: number) {
  return page.locator("[data-court-scene]").evaluate(
    (element, point) => {
      const p = new DOMPoint(point.x, point.y).matrixTransform(
        (element as SVGGElement).getScreenCTM()!,
      );
      return { x: p.x, y: p.y };
    },
    { x, y },
  );
}

test("Voronoi toggle sits left of Undo/Redo, colors all player regions, and updates during dragging and animation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const toggle = page.getByRole("button", {
    name: "Voronoi mode",
    exact: true,
  });
  const cells = page.locator("[data-voronoi-player]");
  const attacks = page.locator('[data-voronoi-team="attacker"]');
  const defenses = page.locator('[data-voronoi-team="defender"]');
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(cells).toHaveCount(0);
  expect(
    await page
      .locator(".history button")
      .evaluateAll((buttons) =>
        buttons.map((b) => b.getAttribute("aria-label")),
      ),
  ).toEqual(["Voronoi mode", "Undo", "Redo"]);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  await expect(attacks).toHaveCount(6);
  await expect(defenses).toHaveCount(7);
  expect(
    await cells.evaluateAll((elements) =>
      elements.every(
        (e) =>
          e.getAttribute("fill-opacity") === "0.3" &&
          getComputedStyle(e).stroke === "rgb(70, 86, 77)",
      ),
    ),
  ).toBe(true);
  await expect(attacks.first()).toHaveAttribute("fill", "#4f8cba");
  await expect(defenses.first()).toHaveAttribute("fill", "#eaa958");
  const original = (await attacks.last().getAttribute("points"))!;
  const from = await courtPoint(page, 299, 256),
    to = await courtPoint(page, 350, 290);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await expect(attacks.last()).not.toHaveAttribute("points", original);
  await page.mouse.up();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(attacks.last()).toHaveAttribute("points", original);
  await page.getByRole("tab", { name: "Animation", exact: true }).click();
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
  const moved = (await attacks.last().getAttribute("points"))!;
  await page.getByLabel("Animation timeline").evaluate((element) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(element, "750");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(attacks.last()).not.toHaveAttribute("points", original);
  await expect(attacks.last()).not.toHaveAttribute("points", moved);
  await expect(cells).toHaveCount(13);
  await page.getByRole("button", { name: "Edit step", exact: true }).click();
  await toggle.click();
  await expect(cells).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Voronoi uses team kit colors and exports the active overlay", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Voronoi mode", exact: true }).click();
  for (const [role, color] of [
    ["Attacker", "#b32939"],
    ["Defender", "#226644"],
  ]) {
    await page
      .getByRole("button", { name: `${role} kit`, exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "Create kit", exact: true })
      .click();
    await dialog.getByLabel("Kit name").fill(`${role} team`);
    await dialog.getByLabel("Primary color", { exact: true }).fill(color);
    await dialog
      .getByRole("button", { name: "Save and apply", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    const cells = page.locator(`[data-voronoi-team="${role.toLowerCase()}"]`);
    await expect(cells.first()).toHaveAttribute("fill", color);
    expect(
      await cells.evaluateAll(
        (elements, color) =>
          elements.every((e) => e.getAttribute("fill") === color),
        color,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/voronoi-teams.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /^Export/ }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /SVG snapshot/ }).click();
  const exported = await context.newPage();
  await exported.setContent(
    await readFile((await (await downloading).path())!, "utf8"),
  );
  await expect(exported.locator("[data-voronoi-player]")).toHaveCount(13);
  await expect(
    exported.locator('[data-voronoi-team="attacker"]').first(),
  ).toHaveAttribute("fill", "#b32939");
  await expect(
    exported.locator('[data-voronoi-team="defender"]').first(),
  ).toHaveAttribute("fill-opacity", "0.3");
  await exported.close();
});

test("Voronoi stays bounded and interactive on rotated, custom, and mobile courts", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Voronoi mode", exact: true }).click();
  for (const mode of ["bottom", "full", "custom_box"]) {
    if (mode === "bottom")
      await page.getByLabel("Goal position").selectOption("bottom");
    else await page.getByLabel("Template").selectOption(mode);
    const size =
      mode === "full"
        ? { width: 400, height: 800 }
        : { width: 400, height: 400 };
    expect(
      await page.locator("[data-voronoi-player]").evaluateAll(
        (cells, bounds) =>
          cells.every((cell) =>
            cell
              .getAttribute("points")!
              .split(" ")
              .every((pair) => {
                const [x, y] = pair.split(",").map(Number);
                return (
                  x >= -1e-7 &&
                  y >= -1e-7 &&
                  x <= bounds.width + 1e-7 &&
                  y <= bounds.height + 1e-7
                );
              }),
          ),
        size,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = page.getByRole("button", {
    name: "Voronoi mode",
    exact: true,
  });
  await toggle.click();
  await expect(page.locator("[data-voronoi-player]")).toHaveCount(0);
  await toggle.click();
  await expect(page.locator("[data-voronoi-player]")).toHaveCount(13);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
