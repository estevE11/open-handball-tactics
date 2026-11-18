import { expect, test, type Locator, type Page } from "@playwright/test";

async function center(item: Locator) {
  return item.evaluate((element) => {
    const point = new DOMPoint().matrixTransform(
      (element as SVGGraphicsElement).getScreenCTM()!,
    );
    return { x: point.x, y: point.y };
  });
}

async function courtPoint(page: Page, x: number, y: number) {
  return page.locator("[data-court-scene]").evaluate(
    (element, [x, y]) => {
      const point = new DOMPoint(x, y).matrixTransform(
        (element as SVGGraphicsElement).getScreenCTM()!,
      );
      return { x: point.x, y: point.y };
    },
    [x, y],
  );
}

test("item popup replaces the inspector, edits properties, and dismisses without disrupting selection or dragging", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const court = page.getByLabel("Interactive handball court");
  const player = court.getByRole("img", { name: "attacker C", exact: true });
  const popup = page.getByRole("dialog", {
    name: "Item properties",
    exact: true,
  });
  await player.click();
  await expect(popup).toHaveCount(0);
  await expect(
    page.locator(".inspector").getByLabel("Token label"),
  ).toHaveCount(0);
  await court.focus();
  await page.keyboard.press("Enter");
  await expect(popup).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await player.dblclick();
  await expect(popup).toBeVisible();
  await expect(popup.locator('input[type="range"]')).toHaveCount(0);
  const size = popup.getByRole("spinbutton", { name: "Token size" });
  const rotation = popup.getByRole("spinbutton", { name: "Object rotation" });
  await popup
    .getByRole("button", { name: "Increase token size", exact: true })
    .click();
  await expect(size).toHaveValue("15");
  await popup
    .getByRole("button", { name: "Decrease token size", exact: true })
    .click();
  await expect(size).toHaveValue("14");
  await size.fill("28");
  await size.press("Tab");
  await rotation.fill("45");
  await popup
    .getByRole("button", { name: "Increase object rotation", exact: true })
    .click();
  await expect(rotation).toHaveValue("46");
  await popup.getByRole("button", { name: "Use square", exact: true }).click();
  await popup.getByLabel("Token color", { exact: true }).fill("#ef3344");
  await popup.getByLabel("Arms", { exact: true }).check();
  await popup.getByLabel("Peto", { exact: true }).check();
  await popup.getByRole("button", { name: "Green peto", exact: true }).click();
  await expect(player.locator("[data-player-arms]")).toHaveCount(1);
  await expect(player.locator('[data-peto="green"]')).toHaveCount(1);
  await expect(player.locator("[data-token-body]")).toHaveAttribute(
    "transform",
    "rotate(46)",
  );
  await expect(player.locator('[id$="-shape"]')).toHaveAttribute(
    "fill",
    "#ef3344",
  );
  const deleteBox = (await popup
    .getByRole("button", { name: "Delete", exact: true })
    .boundingBox())!;
  const labelBox = (await popup
    .getByLabel("Token label", { exact: true })
    .boundingBox())!;
  expect(deleteBox.y).toBeLessThan(labelBox.y);
  await page.screenshot({ path: "test-results/item-properties-desktop.png" });
  const original = await player.getAttribute("transform");
  const point = await center(player);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(popup).toHaveCount(0);
  await page.mouse.move(point.x - 55, point.y - 30, { steps: 5 });
  await page.mouse.up();
  await expect(player).not.toHaveAttribute("transform", original!);
  await expect(popup).toHaveCount(0);
  await player.dblclick();
  await expect(size).toHaveValue("28");
  await size.fill("999");
  await rotation.click();
  await expect(size).toHaveValue("50");
  await size.fill("");
  await rotation.click();
  await expect(size).toHaveValue("50");
  await page
    .getByRole("heading", { name: "Court · this drill", exact: true })
    .click();
  await expect(popup).toHaveCount(0);
  await expect(page.getByLabel("Template")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Delete is shared by players, equipment, text, and images and can be undone", async ({
  page,
}) => {
  await page.goto("/");
  const court = page.getByLabel("Interactive handball court");
  const popup = page.getByRole("dialog", {
    name: "Item properties",
    exact: true,
  });
  async function removeAndUndo(item: Locator, player = false) {
    const id = (await item.getAttribute("data-item-id"))!;
    const stable = court.locator(`[data-item-id="${id}"]`);
    await item.dblclick();
    await expect(
      popup.getByRole("spinbutton", { name: "Token size" }),
    ).toBeVisible();
    await expect(
      popup.getByRole("spinbutton", { name: "Object rotation" }),
    ).toBeVisible();
    await expect(popup.getByLabel("Arms", { exact: true })).toHaveCount(
      player ? 1 : 0,
    );
    await popup.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(stable).toHaveCount(0);
    await expect(popup).toHaveCount(0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(stable).toHaveCount(1);
  }
  await removeAndUndo(
    court.getByRole("img", { name: "attacker B", exact: true }),
    true,
  );
  await removeAndUndo(
    court.getByRole("img", { name: "equipment ball", exact: true }),
  );
  for (const [tool, equipment] of [
    ["Cone", "cone"],
    ["Mini goal", "goal"],
    ["Agility ladder", "ladder"],
    ["Text note", "Note"],
  ]) {
    await page.getByRole("button", { name: tool, exact: true }).click();
    const point = await courtPoint(page, 80, 340);
    await page.mouse.click(point.x, point.y);
    const item = court.getByRole("img", {
      name: `equipment ${equipment}`,
      exact: true,
    });
    await removeAndUndo(item);
    await item.click();
    await page.keyboard.press("Delete");
  }
  await page
    .locator('input[type="file"][accept^="image/png"]')
    .setInputFiles("public/icon-192.png");
  await page
    .getByRole("button", { name: "Add icon-192.png", exact: true })
    .click();
  await removeAndUndo(
    court.getByRole("img", { name: "equipment icon-192.png", exact: true }),
  );
  await expect(court.locator("image")).toHaveAttribute("href", /^blob:/);
});

test("trajectory popup retains all arrow settings and closes when reshaping or moving the line", async ({
  page,
}) => {
  await page.goto("/");
  const court = page.getByLabel("Interactive handball court");
  const popup = page.getByRole("dialog", {
    name: "Item properties",
    exact: true,
  });
  const start = await courtPoint(page, 50, 340),
    end = await courtPoint(page, 150, 340);
  const middle = await courtPoint(page, 100, 340);
  await page.getByRole("button", { name: "Run arrow", exact: true }).click();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.mouse.up();
  await page
    .getByRole("button", { name: "Select & move (V)", exact: true })
    .click();
  await page.mouse.dblclick(middle.x, middle.y);
  await expect(popup).toBeVisible();
  await popup.getByLabel("Arrowheads").selectOption("both");
  await popup.getByLabel("Line color").fill("#e11d48");
  await popup.getByRole("button", { name: "Add Bézier point" }).click();
  await popup.getByRole("button", { name: "Remove Bézier point 2" }).click();
  await expect(court.locator("[data-arrow-head]")).toHaveCount(2);
  await expect(court.locator("[data-arrow-line]")).toHaveAttribute(
    "stroke",
    "#e11d48",
  );
  const handle = (await court.getByLabel("Arrow end point").boundingBox())!;
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(handle.x + 30, handle.y - 30, { steps: 5 });
  await page.mouse.up();
  await expect(popup).toHaveCount(0);
  await page.mouse.dblclick(start.x + 10, start.y - 3);
  await expect(popup).toBeVisible();
  await popup.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(court.locator("[data-arrow-line]")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(court.locator("[data-arrow-line]")).toHaveCount(1);
});

test.describe("touch item properties", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("double-tap opens a usable popup, touch drag and outside tap dismiss it, and fullscreen Escape closes the popup first", async ({
    page,
    context,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(document, "fullscreenEnabled", { value: false });
    });
    await page.goto("/");
    const player = page.getByRole("img", { name: "attacker B", exact: true });
    const popup = page.getByRole("dialog", {
      name: "Item properties",
      exact: true,
    });
    let point = await center(player);
    const original = await player.getAttribute("transform");
    await page.touchscreen.tap(point.x, point.y);
    await expect(popup).toHaveCount(0);
    await page.touchscreen.tap(point.x, point.y);
    await expect(popup).toBeVisible();
    await expect(player).toHaveAttribute("transform", original!);
    const bounds = (await popup.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
    expect(point.y < bounds.y || point.y > bounds.y + bounds.height).toBe(true);
    await popup.getByLabel("Arms", { exact: true }).check();
    await popup.getByLabel("Peto", { exact: true }).check();
    await page.screenshot({ path: "test-results/item-properties-mobile.png" });
    point = await center(player);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: point.x, y: point.y }],
    });
    await expect(popup).toHaveCount(0);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x + 30, y: point.y - 25 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(player).not.toHaveAttribute("transform", original!);
    point = await center(player);
    await page.touchscreen.tap(point.x, point.y);
    await page.touchscreen.tap(point.x, point.y);
    await expect(popup).toBeVisible();
    await page.touchscreen.tap(8, 70);
    await expect(popup).toHaveCount(0);
    await page
      .getByRole("button", { name: "Enter fullscreen", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Hide properties", exact: true })
      .click();
    point = await center(player);
    await page.touchscreen.tap(point.x, point.y);
    await page.touchscreen.tap(point.x, point.y);
    await expect(popup).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
    await expect(page.locator(".app-shell")).toHaveClass(/is-fullscreen/);
    await page.keyboard.press("Escape");
    await expect(page.locator(".app-shell")).not.toHaveClass(/is-fullscreen/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  });
});
