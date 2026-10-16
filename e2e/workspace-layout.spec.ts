import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`${width}px workspace: pen options stay on the left without losing canvas height`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const toolbar = page.getByRole("toolbar", { name: "Drawing tools" });
    await expect(toolbar).toBeVisible();
    const topbar = (await page.locator(".topbar").boundingBox())!;
    expect((await toolbar.boundingBox())!.y).toBeCloseTo(
      topbar.y + topbar.height,
    );
    await expect(
      page.locator(".pane-switch-row, .workspace-footer"),
    ).toHaveCount(0);
    const canvas = page.locator(".canvas-area");
    const before = (await canvas.boundingBox())!;
    expect(before.y + before.height).toBeCloseTo(1000);
    await page
      .getByRole("button", { name: "Freehand drawing (B)", exact: true })
      .click();
    const options = page.getByRole("group", {
      name: "Freehand drawing settings",
    });
    await expect(options).toBeVisible();
    const side = (await options.boundingBox())!;
    const after = (await canvas.boundingBox())!;
    expect(after.y).toBeCloseTo(before.y);
    expect(after.height).toBeCloseTo(before.height);
    expect(side.y).toBeCloseTo(after.y);
    expect(side.x + side.width).toBeCloseTo(after.x);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    for (const label of [
      "Drawing thickness",
      "Drawing opacity",
      "Drawing smoothing",
    ]) {
      const input = (await page
        .getByLabel(label, { exact: true })
        .boundingBox())!;
      expect(input.x).toBeGreaterThanOrEqual(side.x);
      expect(input.x + input.width).toBeLessThanOrEqual(side.x + side.width);
    }
    await page.getByRole("button", { name: "Help", exact: true }).click();
    const help = page.getByRole("dialog");
    await expect(
      help.getByText("Your ideas. Your court.", { exact: true }),
    ).toBeVisible();
    await expect(
      help.getByText("Private by design", { exact: true }),
    ).toBeVisible();
    await expect(help.getByText("v0.2", { exact: true })).toBeVisible();
    await page.getByLabel("Close dialog").click();
    await page.screenshot({
      path: `test-results/workspace-left-options-${width}.png`,
      fullPage: true,
    });
  });
}
