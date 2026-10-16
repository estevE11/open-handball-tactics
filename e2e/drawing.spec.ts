import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function courtPoint(page: Page, x: number, y: number) {
  return page.locator("[data-court-scene]").evaluate(
    (element, p) => {
      const screen = new DOMPoint(p.x, p.y).matrixTransform(
        (element as SVGGElement).getScreenCTM()!,
      );
      return { x: screen.x, y: screen.y };
    },
    { x, y },
  );
}
async function drag(
  page: Page,
  points: [number, number][],
  button: "left" | "right" = "left",
) {
  const screen = await Promise.all(
    points.map(([x, y]) => courtPoint(page, x, y)),
  );
  await page.mouse.move(screen[0].x, screen[0].y);
  await page.mouse.down({ button });
  for (const p of screen.slice(1))
    await page.mouse.move(p.x, p.y, { steps: 6 });
  await page.mouse.up({ button });
}
async function setRange(input: Locator, value: number | string) {
  await input.evaluate((element, next) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(element, String(next));
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test("smooth strokes, whole-trace right erase, undo, clear, save, and exports", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const tokens = page.locator("#tactical-canvas [data-token-glyph]");
  await expect(tokens).toHaveCount(14);
  await page.getByRole("button", { name: "Run arrow", exact: true }).click();
  await drag(page, [
    [60, 350],
    [160, 350],
  ]);
  const arrows = page.locator("#tactical-canvas [data-arrow-id]");
  const arrowCount = await arrows.count();
  await page
    .getByRole("button", { name: "Freehand drawing (B)", exact: true })
    .click();
  await page.getByLabel("Drawing color", { exact: true }).fill("#ff3366");
  await setRange(page.getByLabel("Drawing thickness", { exact: true }), 6);
  await setRange(page.getByLabel("Drawing opacity", { exact: true }), 0.5);
  await setRange(page.getByLabel("Drawing smoothing", { exact: true }), 0.7);
  const ink = page.locator("[data-drawing-stroke]");
  await drag(page, [
    [50, 200],
    [80, 230],
    [120, 200],
    [160, 230],
  ]);
  await drag(page, [
    [250, 180],
    [280, 210],
    [320, 180],
  ]);
  await expect(ink).toHaveCount(2);
  await expect(ink.first()).toHaveAttribute("stroke", "#ff3366");
  await expect(ink.first()).toHaveAttribute("stroke-width", "6");
  await expect(ink.first()).toHaveAttribute("opacity", "0.5");
  await expect(ink.first()).toHaveAttribute("d", / Q /);
  const firstPath = await ink.first().getAttribute("d");
  await drag(
    page,
    [
      [50, 190],
      [50, 245],
    ],
    "right",
  );
  await expect(ink).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(ink).toHaveCount(2);
  await expect(ink.first()).toHaveAttribute("d", firstPath!);
  await page.screenshot({
    path: "test-results/drawing-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Clear drawing", exact: true })
    .click();
  await expect(ink).toHaveCount(0);
  await expect(tokens).toHaveCount(14);
  await expect(arrows).toHaveCount(arrowCount);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(ink).toHaveCount(2);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(ink).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("All changes saved");
  await page.reload();
  await expect(ink).toHaveCount(2);
  await expect(ink.first()).toHaveAttribute("d", firstPath!);

  await page.getByRole("button", { name: /^Export/ }).click();
  const svgDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /SVG snapshot/ }).click();
  const svg = await readFile((await (await svgDownload).path())!, "utf8");
  expect(svg).toContain(firstPath);
  const exported = await context.newPage();
  await exported.setContent(svg);
  await expect(exported.locator("[data-drawing-stroke]")).toHaveCount(2);
  await exported.close();
  const backupDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /Handball project/ }).click();
  const backup = await readFile((await (await backupDownload).path())!);
  expect(
    JSON.parse(backup.toString()).project.keyframes[0].drawings,
  ).toHaveLength(2);
  await page.getByLabel("Close dialog").click();
  await page.locator('input[type="file"][accept^=".hbd"]').setInputFiles({
    name: "drawings.hbd",
    mimeType: "application/json",
    buffer: backup,
  });
  await expect(ink).toHaveCount(2);
  expect(errors).toEqual([]);
});

for (const orientation of ["bottom", "full"] as const) {
  test(`${orientation} court: drawing coordinates and step-local erasing stay correct`, async ({
    page,
  }) => {
    await page.goto("/");
    if (orientation === "full")
      await page.getByLabel("Template").selectOption("full");
    else await page.getByLabel("Goal position").selectOption("bottom");
    await page
      .getByRole("button", { name: "Freehand drawing (B)", exact: true })
      .click();
    await drag(page, [
      [50, 200],
      [100, 230],
      [160, 200],
    ]);
    const ink = page.locator("[data-drawing-stroke]");
    await expect(ink).toHaveCount(1);
    const path = (await ink.getAttribute("d"))!;
    const values = path.match(/-?[\d.]+/g)!.map(Number);
    expect(values[0]).toBeCloseTo(50);
    expect(values[1]).toBeCloseTo(200);
    expect(values.at(-2)).toBeCloseTo(160);
    expect(values.at(-1)).toBeCloseTo(200);
    await page.getByRole("tab", { name: "Animation", exact: true }).click();
    await page.getByRole("button", { name: "Add step", exact: true }).click();
    await expect(ink).toHaveAttribute("d", path);
    await page
      .getByRole("button", { name: "Erase whole strokes (E)", exact: true })
      .click();
    await drag(page, [
      [45, 200],
      [55, 200],
    ]);
    await expect(ink).toHaveCount(0);
    await page.getByRole("button", { name: /01.*Starting positions/ }).click();
    await expect(ink).toHaveAttribute("d", path);
    await page
      .getByRole("button", { name: "Clear drawing", exact: true })
      .click();
    await expect(ink).toHaveCount(0);
  });
}

test("native pen events, pen-only rejection, canceled strokes, and capture", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Freehand drawing (B)", exact: true })
    .click();
  await page.getByLabel("Pen only", { exact: true }).check();
  const ink = page.locator("[data-drawing-stroke]");
  await drag(page, [
    [50, 200],
    [100, 230],
  ]);
  await expect(ink).toHaveCount(0);
  const surface = page.locator("[data-drawing-surface]");
  await surface.dispatchEvent("pointerdown", {
    pointerId: 42,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: 400,
    clientY: 400,
  });
  await surface.dispatchEvent("pointerup", {
    pointerId: 42,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 0,
    clientX: 400,
    clientY: 400,
  });
  await expect(ink).toHaveCount(0);
  const cdp = await context.newCDPSession(page);
  const a = await courtPoint(page, 80, 200),
    b = await courtPoint(page, 140, 240);
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...a,
    button: "left",
    buttons: 1,
    clickCount: 1,
    pointerType: "pen",
    force: 0.5,
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    ...b,
    button: "left",
    buttons: 1,
    pointerType: "pen",
    force: 0.8,
  });
  // An unrelated pointer must not finish the pen's stroke.
  await surface.dispatchEvent("pointerup", {
    pointerId: 42,
    pointerType: "touch",
    button: 0,
    buttons: 0,
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    ...b,
    button: "left",
    buttons: 0,
    clickCount: 1,
    pointerType: "pen",
  });
  await expect(ink).toHaveCount(1);
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...a,
    button: "right",
    buttons: 2,
    clickCount: 1,
    pointerType: "pen",
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    ...a,
    button: "right",
    buttons: 0,
    clickCount: 1,
    pointerType: "pen",
  });
  await expect(ink).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(ink).toHaveCount(1);
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...a,
    button: "left",
    buttons: 1,
    clickCount: 1,
    pointerType: "pen",
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    ...b,
    buttons: 1,
    pointerType: "pen",
  });
  await page.locator("[data-drawing-layer]").evaluate((element) => {
    // Cancel whichever captured native pen pointer is active.
    for (let id = 1; id < 10; id++)
      if (element.hasPointerCapture(id))
        element.dispatchEvent(
          new PointerEvent("pointercancel", {
            bubbles: true,
            pointerId: id,
            pointerType: "pen",
          }),
        );
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    ...b,
    button: "left",
    buttons: 0,
    pointerType: "pen",
  });
  await expect(ink).toHaveCount(1);
  expect(errors).toEqual([]);
});

test.describe("tablet drawing", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("touch dots, eraser controls, and settings fit a small screen", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Freehand drawing (B)", exact: true })
      .click();
    const p = await courtPoint(page, 200, 200);
    await page.touchscreen.tap(p.x, p.y);
    const ink = page.locator("[data-drawing-stroke]");
    await expect(ink).toHaveCount(1);
    await page
      .getByRole("button", { name: "Erase whole strokes (E)", exact: true })
      .click();
    const q = await courtPoint(page, 200, 200);
    await page.touchscreen.tap(q.x, q.y);
    await expect(ink).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await expect(
      page.getByLabel("Drawing color", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Drawing smoothing", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/drawing-mobile.png",
      fullPage: true,
    });
  });
});

for (const view of ["top", "bottom", "full"] as const) {
  test(`${view}: drawing covers the entire canvas and survives court edits, resize, and export`, async ({
    page,
    context,
  }) => {
    await page.goto("/");
    if (view === "full") await page.getByLabel("Template").selectOption("full");
    else await page.getByLabel("Goal position").selectOption(view);
    await page
      .getByRole("button", { name: "Freehand drawing (B)", exact: true })
      .click();
    await expect(page.locator("[data-drawing-surface]")).toBeVisible();
    const canvas = (await page.locator("#tactical-canvas").boundingBox())!;
    const start = { x: canvas.x + 12, y: canvas.y + 32 };
    const end = {
      x: canvas.x + canvas.width - 12,
      y: canvas.y + canvas.height - 12,
    };
    const expected = await page.locator("[data-court-scene]").evaluate(
      (element, coords) => {
        const inverse = (element as SVGGElement).getScreenCTM()!.inverse();
        return coords.map((p) => {
          const point = new DOMPoint(p.x, p.y).matrixTransform(inverse);
          return { x: point.x, y: point.y };
        });
      },
      [start, end],
    );
    expect(
      expected.some(
        (p) =>
          p.x < 0 ||
          p.y < 0 ||
          p.x > 400 ||
          p.y > (view === "full" ? 800 : 400),
      ),
    ).toBe(true);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 24 });
    await page.mouse.up();
    const ink = page.locator("[data-drawing-stroke]");
    await expect(ink).toHaveCount(1);
    const path = (await ink.getAttribute("d"))!;
    const numbers = path.match(/-?[\d.]+/g)!.map(Number);
    expect(numbers[0]).toBeCloseTo(expected[0].x);
    expect(numbers[1]).toBeCloseTo(expected[0].y);
    expect(numbers.at(-2)).toBeCloseTo(expected[1].x);
    expect(numbers.at(-1)).toBeCloseTo(expected[1].y);
    await page.getByLabel("Court area color", { exact: true }).fill("#ddeeff");
    await expect(ink).toHaveAttribute("d", path);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(ink).toHaveAttribute("d", path);
    await expect(page.locator(".save-status")).toHaveText("All changes saved");
    await page.reload();
    await expect(ink).toHaveAttribute("d", path);
    await page.getByRole("button", { name: /^Export/ }).click();
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: /SVG snapshot/ }).click();
    const svg = await readFile((await (await downloading).path())!, "utf8");
    const exported = await context.newPage();
    await exported.setContent(svg);
    expect(
      await exported.locator("[data-drawing-stroke]").evaluate((element) => {
        const stroke = element as SVGGraphicsElement;
        const svg = stroke.ownerSVGElement!;
        const box = stroke.getBBox();
        const matrix = svg
          .getScreenCTM()!
          .inverse()
          .multiply(stroke.getScreenCTM()!);
        const corners = [
          new DOMPoint(box.x, box.y),
          new DOMPoint(box.x + box.width, box.y + box.height),
        ].map((p) => p.matrixTransform(matrix));
        const view = svg.viewBox.baseVal;
        return corners.every(
          (p) =>
            p.x >= view.x &&
            p.y >= view.y &&
            p.x <= view.x + view.width &&
            p.y <= view.y + view.height,
        );
      }),
    ).toBe(true);
    await exported.close();
    await page.getByLabel("Close dialog").click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("button", { name: "Freehand drawing (B)", exact: true })
      .click();
    await expect(page.locator("[data-drawing-surface]")).toBeVisible();
    const target = await courtPoint(page, expected[0].x, expected[0].y);
    await page.mouse.click(target.x, target.y, { button: "right" });
    await expect(ink).toHaveCount(0);
  });
}
