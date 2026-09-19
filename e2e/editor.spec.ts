import { expect, test, type Locator } from "@playwright/test";

async function setRange(input: Locator, value: number) {
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
