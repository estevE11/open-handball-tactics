import { expect, test, type Page } from "@playwright/test";

async function useViewportFullscreen(page: Page) {
  // Keep viewport sizes deterministic; native fullscreen is covered separately.
  await page.addInitScript(() => {
    Object.defineProperty(document, "fullscreenEnabled", { value: false });
  });
}

async function courtGeometry(page: Page) {
  return page.locator("#tactical-canvas").evaluate((element) => {
    const svg = element as SVGSVGElement;
    const box = svg.getBoundingClientRect();
    const matrix = svg.getScreenCTM()!;
    const view = svg.viewBox.baseVal;
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      matrix: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f],
      scale: Math.min(box.width / view.width, box.height / view.height),
      viewWidth: view.width,
      viewHeight: view.height,
    };
  });
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  for (const type of ["half", "full"] as const) {
    test(`${type} court at ${viewport.width}px: panels overlay the maximized court without resizing it`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await useViewportFullscreen(page);
      await page.goto("/");
      await page
        .getByRole("button", { name: "Enter fullscreen", exact: true })
        .click();
      await page.getByLabel("Template").selectOption(type);
      const tools = page.locator(".fullscreen-tools");
      const properties = page.locator(".fullscreen-properties");
      await expect(tools).toHaveAttribute(
        "data-edge",
        type === "full" ? "top" : "left",
      );
      await expect(properties).toHaveAttribute(
        "data-edge",
        type === "full" ? "bottom" : "right",
      );
      await expect(page.locator(".topbar")).toBeHidden();
      await expect(page.locator(".library-sidebar")).toBeHidden();
      await expect(page.locator(".canvas-topline")).toBeHidden();
      const before = await courtGeometry(page);
      expect(before).toMatchObject({ x: 0, y: 0, ...viewport });
      expect(before.matrix[0]).toBeCloseTo(before.scale);
      expect(before.matrix[3]).toBeCloseTo(before.scale);
      expect(before.matrix[1]).toBe(0);
      expect(before.matrix[2]).toBe(0);
      // Each court fills the limiting dimension, retaining its exact proportions.
      if (type === "full" || viewport.width === 390)
        expect(before.viewWidth * before.scale).toBeCloseTo(viewport.width);
      else
        expect(before.viewHeight * before.scale).toBeCloseTo(viewport.height);
      for (const name of ["tools", "properties"]) {
        await page
          .getByRole("button", { name: `Hide ${name}`, exact: true })
          .click();
        const show = page.getByRole("button", {
          name: `Show ${name}`,
          exact: true,
        });
        await expect(show).toBeFocused();
        const panel = page.getByRole("region", {
          name: `${name === "tools" ? "Tools" : "Properties"} panel`,
          includeHidden: true,
        });
        await expect(panel).toHaveAttribute("inert", "");
        await expect(panel).toBeHidden();
        const handle = (await show.boundingBox())!;
        expect(handle.x).toBeGreaterThanOrEqual(0);
        expect(handle.y).toBeGreaterThanOrEqual(0);
        expect(handle.x + handle.width).toBeLessThanOrEqual(viewport.width);
        expect(handle.y + handle.height).toBeLessThanOrEqual(viewport.height);
        expect(await courtGeometry(page)).toEqual(before);
      }
      await page.screenshot({
        path: `test-results/fullscreen-${type}-${viewport.width}-hidden.png`,
      });
      for (const name of ["tools", "properties"]) {
        await page
          .getByRole("button", { name: `Show ${name}`, exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: `Hide ${name}`, exact: true }),
        ).toBeFocused();
        expect(await courtGeometry(page)).toEqual(before);
      }
      await expect
        .poll(() =>
          page
            .locator(".fullscreen-panel-surface")
            .evaluateAll((panels) =>
              panels.every(
                (panel) => getComputedStyle(panel).transform === "none",
              ),
            ),
        )
        .toBe(true);
      await page.screenshot({
        path: `test-results/fullscreen-${type}-${viewport.width}.png`,
      });
      await page
        .getByRole("button", { name: "Exit fullscreen", exact: true })
        .click();
      await expect(page.locator(".topbar")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Enter fullscreen", exact: true }),
      ).toBeFocused();
    });
  }
}

test("fullscreen supports drawing, selection properties, changing templates, and animation", async ({
  page,
}) => {
  await useViewportFullscreen(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  const before = await courtGeometry(page);
  await page
    .getByRole("button", { name: "Freehand drawing (B)", exact: true })
    .click();
  await expect(
    page
      .locator(".fullscreen-properties")
      .getByLabel("Drawing color", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Drawing color", { exact: true }).fill("#ff3366");
  expect(await courtGeometry(page)).toEqual(before);
  await page.getByRole("button", { name: "Hide tools", exact: true }).click();
  await page
    .getByRole("button", { name: "Hide properties", exact: true })
    .click();
  await page.mouse.move(110, 120);
  await page.mouse.down();
  await page.mouse.move(240, 190, { steps: 8 });
  await page.mouse.up();
  const stroke = page.locator("[data-drawing-stroke]");
  await expect(stroke).toHaveCount(1);
  await expect(stroke).toHaveAttribute("stroke", "#ff3366");
  await page.getByRole("button", { name: "Show tools", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(stroke).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(stroke).toHaveCount(1);
  await page
    .getByRole("button", { name: "Select & move (V)", exact: true })
    .click();
  await page.getByRole("img", { name: "attacker B", exact: true }).click();
  await page
    .getByRole("button", { name: "Show properties", exact: true })
    .click();
  await page.getByLabel("Token label", { exact: true }).fill("Playmaker");
  await page.getByRole("button", { name: "Hide tools", exact: true }).click();
  await page.getByLabel("Template").selectOption("full");
  await expect(page.locator(".fullscreen-tools")).toHaveAttribute(
    "data-edge",
    "top",
  );
  await expect(
    page.getByRole("button", { name: "Show tools", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".fullscreen-properties")).toHaveAttribute(
    "data-edge",
    "bottom",
  );
  await page.getByRole("tab", { name: "Animation", exact: true }).click();
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await expect(page.getByRole("button", { name: /02 Step 2/ })).toBeVisible();
  await page
    .getByRole("button", { name: "Hide properties", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".topbar")).toBeVisible();
  await expect(stroke).toHaveCount(1);
  await expect(
    page.getByRole("img", { name: "attacker Playmaker", exact: true }),
  ).toBeVisible();
});

test("native fullscreen exits cleanly from the browser and with Escape", async ({
  page,
}) => {
  await page.goto("/");
  test.skip(
    !(await page.evaluate(() => document.fullscreenEnabled)),
    "Native fullscreen unavailable",
  );
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator(".topbar")).toBeVisible();
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator(".topbar")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(false);
});

test("a denied native fullscreen request still opens the viewport layout", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "fullscreenEnabled", { value: true });
    document.documentElement.requestFullscreen = () =>
      Promise.reject(new DOMException("Denied", "NotAllowedError"));
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Hide tools", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Hide properties", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".topbar")).toBeVisible();
});
