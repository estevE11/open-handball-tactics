import { expect, test, type Locator } from "@playwright/test";

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
