import { expect, test } from "@playwright/test";

for (const [width, theme] of [
  [1440, "dark"],
  [980, "light"],
  [390, "dark"],
  [320, "light"],
] as const) {
  test(`${width}px ${theme} top bar groups primary actions and keeps secondary actions in a usable menu`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/");
    const header = page.locator(".topbar");
    const primary = header.getByRole("group", {
      name: "Share and export",
      exact: true,
    });
    const menu = header.getByRole("group", {
      name: "Workspace actions",
      exact: true,
    });
    const more = header.getByRole("button", {
      name: "More actions",
      exact: true,
    });
    await expect(primary.getByRole("button")).toHaveCount(2);
    await expect(
      primary.getByRole("button", { name: "Share live room", exact: true }),
    ).toBeVisible();
    const exportButton = primary.getByRole("button", {
      name: "Export",
      exact: true,
    });
    await expect(exportButton.locator("svg")).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Enter fullscreen", exact: true }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", { name: /Switch to (light|dark) mode/ }),
    ).toBeVisible();
    await expect(menu).not.toBeVisible();
    await page.screenshot({
      path: `test-results/topbar-${width}-${theme}.png`,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await more.focus();
    await more.press("Enter");
    await expect(menu).toBeVisible();
    const bounds = (await menu.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await expect(
      menu.getByRole("button", { name: "Duplicate", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("button", { name: "Workspace defaults", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("button", { name: "Help", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/topbar-menu-${width}-${theme}.png`,
    });
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    await expect(more).toBeFocused();
    await more.click();
    await header.getByRole("heading").click();
    await expect(menu).not.toBeVisible();
    await more.click();
    await menu
      .getByRole("button", { name: "Workspace defaults", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(menu).not.toBeVisible();
    await page.getByLabel("Close dialog").click();
    await more.click();
    await menu.getByRole("button", { name: "Help", exact: true }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByText("Your ideas. Your court.", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Close dialog").click();
    await more.click();
    await menu.getByRole("button", { name: "Duplicate", exact: true }).click();
    await expect(
      header.getByRole("heading", {
        name: "Build the attack (copy)",
        exact: true,
      }),
    ).toBeVisible();
    await expect(menu).not.toBeVisible();
    await exportButton.click();
    await expect(
      page.getByRole("dialog").getByRole("button", { name: /^PNG snapshot/ }),
    ).toBeVisible();
    await page.getByLabel("Close dialog").click();
    if (width === 1440) {
      await context.setOffline(true);
      await more.click();
      await expect(
        menu.getByText("Working offline", { exact: true }),
      ).toBeVisible();
      await context.setOffline(false);
    }
  });
}
