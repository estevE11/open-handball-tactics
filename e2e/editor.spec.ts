import { expect, test, type Locator } from "@playwright/test";

async function courtPoint(court: Locator, x: number, y: number) {
  return court.evaluate(
    (element, point) => {
      const p = new DOMPoint(point.x, point.y).matrixTransform(
        (element as SVGSVGElement).getScreenCTM()!,
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
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await defender.click();
  await page.getByLabel("Object rotation").fill("10");
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
  await setRange(dialog.getByLabel("Player scale"), 1.5);
  await setRange(dialog.getByLabel("Court line weight"), 3);
  await dialog.getByLabel("Show grid", { exact: true }).check();
  await dialog.getByRole("button", { name: "Save defaults" }).click();
  await expect(page.getByLabel("Template")).toHaveValue("half");
  await expect(page.getByLabel("Player scale")).toHaveValue("1");
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
  await expect(page.getByLabel("Show grid", { exact: true })).toBeChecked();
  const attacker = page.getByRole("img", { name: "attacker A", exact: true });
  await expect(attacker.locator("[data-token-glyph] circle")).toHaveAttribute(
    "r",
    "21",
  );
  await expect(
    page
      .getByRole("img", { name: "equipment ball" })
      .locator("[data-token-glyph] circle"),
  ).toHaveAttribute("r", "6");
  await setRange(page.getByLabel("Court floor color"), "#eeddaa");
  await setRange(page.getByLabel("Player scale"), 0.75);
  await expect(attacker.locator("[data-token-glyph] circle")).toHaveAttribute(
    "r",
    "10.5",
  );
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
  await page.getByLabel("Arrowheads", { exact: true }).selectOption("both");
  await expect(court.locator("[data-arrow-head]")).toHaveCount(2);
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
