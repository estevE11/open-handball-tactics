import { expect, test, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function courtPoint(court: Locator, x: number, y: number) {
  return court.evaluate(
    (element, point) => {
      const p = new DOMPoint(point.x, point.y).matrixTransform(
        element
          .querySelector<SVGGElement>("[data-court-scene]")!
          .getScreenCTM()!,
      );
      return { x: p.x, y: p.y };
    },
    { x, y },
  );
}

async function setRange(input: Locator, value: number | string) {
  await input.evaluate((element, next) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(element, String(next));
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

// Compare actual rendered coordinate systems, including ancestor transforms.
async function expectChipTransform(
  token: Locator,
  angle: number,
  scale: number,
  labelAngle = angle,
) {
  const geometry = await token.evaluate((element) => {
    const shape = element.querySelector<SVGGraphicsElement>(
      "[data-token-glyph] path, [data-token-glyph] circle, [data-token-glyph] rect",
    )!;
    const label = element.querySelector<SVGTextElement>("text")!;
    const court = element.closest("svg")!;
    const relative = (node: SVGGraphicsElement) => {
      const matrix = court
        .getScreenCTM()!
        .inverse()
        .multiply(node.getScreenCTM()!);
      return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
    };
    return {
      shape: relative(shape),
      label: relative(label),
      triangle: shape.tagName === "path",
    };
  });
  for (const [matrix, degrees] of [
    [geometry.shape, angle],
    [geometry.label, labelAngle],
  ] as const) {
    const radians = (degrees * Math.PI) / 180;
    const expected = [
      Math.cos(radians) * scale,
      Math.sin(radians) * scale,
      -Math.sin(radians) * scale,
      Math.cos(radians) * scale,
    ];
    expected.forEach((value, index) =>
      expect(matrix[index]).toBeCloseTo(value, 5),
    );
  }
  // The triangle's lettering is centered at its centroid, within the shared scale.
  expect(
    Math.hypot(
      geometry.label[4] - geometry.shape[4],
      geometry.label[5] - geometry.shape[5],
    ),
  ).toBeCloseTo(geometry.triangle ? (scale * 10) / 3 : 0, 5);
}

async function circleRadius(token: Locator) {
  return token.evaluate((element) => {
    const circle = element.querySelector<SVGCircleElement>(
      "[data-token-glyph] circle",
    )!;
    const matrix = element
      .closest("svg")!
      .getScreenCTM()!
      .inverse()
      .multiply(circle.getScreenCTM()!);
    return circle.r.baseVal.value * Math.hypot(matrix.a, matrix.b);
  });
}

test("player lettering stays attached through shape, size, rotation, animation, and SVG export", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const attacker = page.getByRole("img", { name: "attacker C", exact: true });
  await expect(attacker).toBeVisible();
  await expectChipTransform(
    page.getByRole("img", { name: "defender 1", exact: true }).first(),
    180,
    1,
    0,
  );
  await expectChipTransform(
    page.getByRole("img", { name: "goalkeeper GK" }),
    180,
    13 / 14,
    0,
  );
  await setRange(page.getByLabel("Player scale"), 1.5);
  await attacker.click();
  await setRange(page.getByLabel("Token size"), 28);
  await page.getByLabel("Object rotation").fill("45");
  for (const shape of ["circle", "triangle", "square"]) {
    await page
      .getByRole("button", { name: `Use ${shape}`, exact: true })
      .click();
    await expectChipTransform(attacker, 45, 3);
  }
  await page.getByRole("tab", { name: "Animation", exact: true }).click();
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page.getByRole("tab", { name: "Editor", exact: true }).click();
  await attacker.click();
  await setRange(page.getByLabel("Token size"), 14);
  await page.getByLabel("Object rotation").fill("135");
  await page.getByRole("tab", { name: "Animation", exact: true }).click();
  await page.getByLabel("Onion skin").check();
  const copies = page.getByRole("img", { name: "attacker C", exact: true });
  await expect(copies).toHaveCount(2);
  await expectChipTransform(copies.first(), 45, 3);
  await expectChipTransform(copies.last(), 135, 1.5, -45);
  await setRange(page.getByLabel("Animation timeline"), 750);
  await expect(copies).toHaveCount(1);
  await expectChipTransform(attacker, 90, 2.25);
  await page.getByRole("button", { name: /^Export/ }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /SVG snapshot/ }).click();
  const download = await downloading;
  const svg = await readFile((await download.path())!, "utf8");
  const exported = await context.newPage();
  await exported.setContent(svg);
  await expectChipTransform(
    exported.getByRole("img", { name: "attacker C", exact: true }),
    90,
    2.25,
  );
  await expect(exported.locator("[data-token-glyph][filter]")).toHaveCount(0);
  await exported.screenshot({ path: "/tmp/handball-chip-labels.png" });
  await exported.close();
  await page.getByLabel("Close dialog").click();
  await page.getByRole("button", { name: "Edit step", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("All changes saved");
  await page.reload();
  await expect(attacker).toBeVisible();
  await expectChipTransform(attacker, 45, 3);
});

test("defenders and goalkeepers face attackers, rotate, and animate between steps", async ({
  page,
}) => {
  await page.goto("/");
  const defender = page
    .getByRole("img", { name: "defender 1", exact: true })
    .first();
  const keeper = page.getByRole("img", { name: "goalkeeper GK" });
  await expect(defender.locator("[data-token-body]")).toHaveAttribute(
    "transform",
    "rotate(180)",
  );
  await expect(keeper.locator("[data-token-body]")).toHaveAttribute(
    "transform",
    "rotate(180)",
  );
  await expect(keeper.locator("[data-token-glyph] path")).toHaveCount(1);
  await defender.click();
  await expect(defender.locator("[data-token-glyph]")).toHaveAttribute(
    "filter",
    /url/,
  );
  await expect(defender.locator("rect")).toHaveCount(0);
  await page.getByLabel("Object rotation").fill("350");
  await page.getByRole("tab", { name: "Animation", exact: true }).click();
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page.getByRole("tab", { name: "Editor", exact: true }).click();
  await defender.click();
  await page.getByLabel("Object rotation").fill("10");
  await page.getByRole("tab", { name: "Animation", exact: true }).click();
  await setRange(page.getByLabel("Animation timeline"), 750);
  await expect(defender.locator("[data-token-body]")).toHaveAttribute(
    "transform",
    "rotate(360)",
  );
  await page
    .getByRole("button", { name: "Play animation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause animation", exact: true }),
  ).toBeVisible();
  await expect(defender.locator("[data-token-body]")).toHaveAttribute(
    "transform",
    "rotate(10)",
  );
  await page.getByRole("button", { name: "Edit step", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("All changes saved");
  await page.reload();
  await expect(defender.locator("[data-token-body]")).toHaveAttribute(
    "transform",
    "rotate(350)",
  );
  await page.getByRole("tab", { name: "Animation", exact: true }).click();
  await page.getByRole("button", { name: /02 Step 2/ }).click();
  await expect(defender.locator("[data-token-body]")).toHaveAttribute(
    "transform",
    "rotate(10)",
  );
});

test("workspace court defaults persist while drill overrides and equipment sizes stay independent", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Build the attack" }),
  ).toBeVisible();
  await page.getByLabel("Workspace defaults", { exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Template").selectOption("full");
  await setRange(dialog.getByLabel("Court floor color"), "#abcabc");
  await dialog.getByLabel("Canvas background").selectOption("custom");
  await setRange(dialog.getByLabel("Canvas background color"), "#d5e6f7");
  await setRange(dialog.getByLabel("Player scale"), 1.5);
  await setRange(dialog.getByLabel("Court line weight"), 3);
  await dialog.getByLabel("Show grid", { exact: true }).check();
  await dialog.getByRole("button", { name: "Save defaults" }).click();
  await expect(page.getByLabel("Template")).toHaveValue("half");
  await expect(page.getByLabel("Player scale")).toHaveValue("1");
  await page.getByLabel("Toggle library").click();
  await page
    .getByRole("button", { name: "New drill", exact: true })
    .first()
    .click();
  await dialog
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Global defaults drill");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByLabel("Template")).toHaveValue("full");
  await expect(page.getByLabel("Court floor color")).toHaveValue("#abcabc");
  await expect(
    page.getByLabel("Canvas background", { exact: true }),
  ).toHaveValue("custom");
  await expect(page.getByLabel("Canvas background color")).toHaveValue(
    "#d5e6f7",
  );
  await expect(page.locator(".canvas-area")).toHaveCSS(
    "background-color",
    "rgb(213, 230, 247)",
  );
  await expect(page.getByLabel("Show grid", { exact: true })).toBeChecked();
  const attacker = page.getByRole("img", { name: "attacker A", exact: true });
  expect(await circleRadius(attacker)).toBeCloseTo(21);
  await expect(
    page
      .getByRole("img", { name: "equipment ball" })
      .locator("[data-token-glyph] circle"),
  ).toHaveAttribute("r", "6");
  await setRange(page.getByLabel("Court floor color"), "#eeddaa");
  await setRange(page.getByLabel("Player scale"), 0.75);
  expect(await circleRadius(attacker)).toBeCloseTo(10.5);
  await expect(page.getByRole("status")).toHaveText("All changes saved");
  await page.reload();
  await expect(page.getByLabel("Court floor color")).toHaveValue("#eeddaa");
  await page.getByLabel("Workspace defaults", { exact: true }).click();
  await expect(dialog.getByLabel("Court floor color")).toHaveValue("#abcabc");
  await expect(dialog.getByLabel("Player scale")).toHaveValue("1.5");
  await page.getByLabel("Close dialog").click();
  await page.getByRole("button", { name: "Apply workspace defaults" }).click();
  await expect(page.getByLabel("Court floor color")).toHaveValue("#abcabc");
  await expect(page.getByLabel("Player scale")).toHaveValue("1.5");
});

test("full court is horizontal with court-relative dragging, arrows, steps, and export", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const court = page.getByLabel("Interactive handball court");
  const attacker = page.getByRole("img", { name: "attacker C", exact: true });
  await expect(attacker).toBeVisible();
  const original = await attacker.getAttribute("transform");
  await page.getByLabel("Template").selectOption("full");
  await expect(court).toHaveAttribute("viewBox", "-12 -12 824 424");
  await expect(attacker).toHaveAttribute("transform", original!);
  await expectChipTransform(attacker, -90, 1, 0);
  const start = await courtPoint(court, 200, 286);
  // Use the token's actual center, independent of selection handles.
  const center = await attacker.evaluate((element) => {
    const p = new DOMPoint().matrixTransform(
      (element as SVGGraphicsElement).getScreenCTM()!,
    );
    return { x: p.x, y: p.y };
  });
  const target = await courtPoint(court, 240, 650);
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await page.mouse.up();
  const position = await attacker.evaluate((element) => {
    const matrix = (
      element as SVGGraphicsElement
    ).transform.baseVal.consolidate()!.matrix;
    return { x: matrix.e, y: matrix.f };
  });
  expect(position.x).toBeCloseTo(240, 3);
  expect(position.y).toBeCloseTo(650, 3);
  await page.getByRole("button", { name: "Pass arrow", exact: true }).click();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await page.mouse.up();
  const arrow = court.locator("[data-arrow-line]");
  await expect(arrow).toHaveCount(1);
  const path = await arrow.getAttribute("d");
  await page.getByRole("tab", { name: "Animation", exact: true }).click();
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page.getByLabel("Onion skin").check();
  await expect(
    page.getByRole("img", { name: "attacker C", exact: true }),
  ).toHaveCount(2);
  await setRange(page.getByLabel("Animation timeline"), 750);
  await expectChipTransform(attacker, -90, 1, 0);
  await page.screenshot({
    path: "/tmp/handball-horizontal.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /^Export/ }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /SVG snapshot/ }).click();
  const download = await downloading;
  const exported = await context.newPage();
  await exported.setContent(await readFile((await download.path())!, "utf8"));
  const svg = exported.locator("svg");
  expect(Number(await svg.getAttribute("width"))).toBeGreaterThan(
    Number(await svg.getAttribute("height")),
  );
  await expectChipTransform(
    exported.getByRole("img", { name: "attacker C", exact: true }),
    -90,
    1,
    0,
  );
  await exported.close();
  await page.getByLabel("Close dialog").click();
  await page.getByRole("button", { name: "Edit step", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("All changes saved");
  await page.reload();
  await expect(court).toHaveAttribute("viewBox", "-12 -12 824 424");
  await expect(arrow).toHaveAttribute("d", path!);
  await page.getByLabel("Template").selectOption("half");
  await expect(court).toHaveAttribute("viewBox", "-12 -16 424 432");
  await page.getByLabel("Court size").selectOption("16");
  await expect(page.getByLabel("Court size")).toHaveValue("16");
  await expect(court).toHaveAttribute("viewBox", "-12 -16 424 352");
  await expectChipTransform(attacker, 0, 1);
});

test("arrows move as a whole and support draggable endpoints and multiple Bézier points", async ({
  page,
}) => {
  await page.goto("/");
  const court = page.getByLabel("Interactive handball court");
  await expect(court).toBeVisible();
  const start = await courtPoint(court, 70, 340),
    end = await courtPoint(court, 160, 365);
  await page.getByRole("button", { name: "Run arrow", exact: true }).click();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.mouse.up();
  await page
    .getByRole("button", { name: "Select & move (V)", exact: true })
    .click();
  const line = court.locator("[data-arrow-line]");
  const original = await line.getAttribute("d");
  const middle = await courtPoint(court, 115, 352.5),
    target = await courtPoint(court, 155, 332.5);
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await page.mouse.up();
  await expect(line).not.toHaveAttribute("d", original!);
  await expect(court.getByLabel("Arrow start point")).toBeVisible();
  const originalColor = await line.getAttribute("stroke");
  await page.getByLabel("Line color", { exact: true }).fill("#e11d48");
  await expect(line).toHaveAttribute("stroke", "#e11d48");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(line).toHaveAttribute("stroke", originalColor!);
  await page.mouse.click(target.x, target.y);
  await page.getByLabel("Line color", { exact: true }).fill("#e11d48");
  await page.getByLabel("Arrowheads", { exact: true }).selectOption("both");
  await expect(court.locator("[data-arrow-head]")).toHaveCount(2);
  for (const head of await court.locator("[data-arrow-head]").all())
    await expect(head).toHaveAttribute("stroke", "#e11d48");
  await page.getByLabel("Arrowheads", { exact: true }).selectOption("none");
  await expect(court.locator("[data-arrow-head]")).toHaveCount(0);
  await page.getByLabel("Arrowheads", { exact: true }).selectOption("start");
  await expect(court.locator('[data-arrow-head="start"]')).toHaveCount(1);
  await expect(court.locator('[data-arrow-head="end"]')).toHaveCount(0);
  await page.getByLabel("Arrowheads", { exact: true }).selectOption("both");
  await page.getByRole("button", { name: "Add Bézier point" }).click();
  await page.getByRole("button", { name: "Add Bézier point" }).click();
  await expect(court.locator('[aria-label^="Bézier point"]')).toHaveCount(3);
  const curveBefore = await line.getAttribute("d");
  const handle = (await court
    .getByLabel("Bézier point 2", { exact: true })
    .boundingBox())!;
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(handle.x + 15, handle.y - 50, { steps: 5 });
  await page.mouse.up();
  await expect(line).not.toHaveAttribute("d", curveBefore!);
  const curve = await line.getAttribute("d");
  expect(curve!.match(/Q/g)).toHaveLength(3);
  const endpoint = (await court.getByLabel("Arrow end point").boundingBox())!;
  await page.mouse.move(
    endpoint.x + endpoint.width / 2,
    endpoint.y + endpoint.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(endpoint.x + 40, endpoint.y + 10, { steps: 5 });
  await page.mouse.up();
  await expect(line).not.toHaveAttribute("d", curve!);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(line).toHaveAttribute("d", curve!);
  await expect(page.getByRole("status")).toHaveText("All changes saved");
  await page.reload();
  await expect(court.locator("[data-arrow-line]")).toHaveAttribute("d", curve!);
  await expect(court.locator("[data-arrow-head]")).toHaveCount(2);
  await expect(line).toHaveAttribute("stroke", "#e11d48");
});

test("training equipment has distinct proportions and supports rotation", async ({
  page,
}) => {
  await page.goto("/");
  const court = page.getByLabel("Interactive handball court");
  await expect(court).toBeVisible();
  await page.getByRole("button", { name: "Cone", exact: true }).click();
  const conePosition = await courtPoint(court, 90, 330);
  await page.mouse.click(conePosition.x, conePosition.y);
  const cone = court.locator('[data-equipment="cone"]');
  await expect(cone).toBeVisible();
  const coneBox = (await cone.boundingBox())!;
  const playerBox = (await page
    .getByRole("img", { name: "defender 1", exact: true })
    .first()
    .boundingBox())!;
  expect(coneBox.width).toBeLessThan(playerBox.width);
  await page
    .getByRole("button", { name: "Agility ladder", exact: true })
    .click();
  const ladderPosition = await courtPoint(court, 300, 340);
  await page.mouse.click(ladderPosition.x, ladderPosition.y);
  const ladder = court.locator('[data-equipment="ladder"]');
  await expect(ladder.locator("[data-ladder-rung]")).toHaveCount(8);
  const ladderBox = (await ladder.boundingBox())!;
  expect(ladderBox.height).toBeGreaterThan(ladderBox.width * 2.5);
  await page.getByLabel("Object rotation").fill("90");
  await expect(
    page
      .getByRole("img", { name: "equipment ladder" })
      .locator("[data-token-body]"),
  ).toHaveAttribute("transform", "rotate(90)");
  await expect(page.getByRole("status")).toHaveText("All changes saved");
  await page.screenshot({
    path: "/tmp/handball-equipment.png",
    fullPage: true,
  });
  await page.reload();
  await expect(court.locator('[data-equipment="cone"]')).toHaveCount(1);
  await expect(court.locator('[data-equipment="ladder"]')).toHaveCount(1);
});

test("dark mode persists and leaves the canvas pixels unchanged", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Build the attack" }),
  ).toBeVisible();
  const court = page.getByLabel("Interactive handball court");
  const lightCanvas = await court.screenshot();
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  expect(await court.screenshot()).toEqual(lightCanvas);
  await expect(page.locator(".topbar")).toHaveCSS(
    "background-color",
    "rgb(32, 38, 40)",
  );
  await page.screenshot({ path: "/tmp/handball-dark.png", fullPage: true });
  await page.reload();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.getByLabel("Workspace defaults", { exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Interface theme")
    .selectOption("system");
  await expect(page.locator("html")).not.toHaveClass("dark");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass("dark");
  await page.getByLabel("Close dialog").click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "/tmp/handball-dark-mobile.png",
    fullPage: true,
  });
});
