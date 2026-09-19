import { expect, test, type Locator, type Page } from "@playwright/test";
import { newProject } from "../src/lib/projectDefaults";

async function position(token: Locator) {
  return token.evaluate((element) => {
    const m = (element as SVGGraphicsElement).transform.baseVal.consolidate()!
      .matrix;
    return { x: m.e, y: m.f };
  });
}
async function expectPosition(token: Locator, x: number, y: number) {
  const p = await position(token);
  expect(p.x).toBeCloseTo(x, 3);
  expect(p.y).toBeCloseTo(y, 3);
}
async function drag(
  page: Page,
  token: Locator,
  x: number,
  y: number,
  release = true,
) {
  const from = await token.evaluate((element) => {
    const p = new DOMPoint().matrixTransform(
      (element as SVGGraphicsElement).getScreenCTM()!,
    );
    return { x: p.x, y: p.y };
  });
  const to = await page.locator("[data-court-scene]").evaluate(
    (element, target) => {
      const p = new DOMPoint(target.x, target.y).matrixTransform(
        (element as SVGGraphicsElement).getScreenCTM()!,
      );
      return { x: p.x, y: p.y };
    },
    { x, y },
  );
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  if (release) await page.mouse.up();
}

for (const template of ["half", "half-bottom", "full"] as const) {
  test(`${template} court: touching ball follows player, ball always drags freely, and carried movement survives steps and reload`, async ({
    page,
  }) => {
    const project = newProject("Ball carrying");
    project.courtConfig.type = template === "full" ? "full" : "half";
    project.courtConfig.halfCourtEnd =
      template === "half-bottom" ? "bottom" : "top";
    const tokens = project.keyframes[0].tokens;
    const player = tokens.find((token) => token.role === "attacker")!;
    const ball = tokens.find((token) => token.equipment === "ball")!;
    player.label = "Carrier";
    player.position = { x: 100, y: 200 };
    ball.position = { x: 120, y: 200 };
    // Deliberately put the ball first: it must still be draggable above a later player.
    project.keyframes[0].tokens = [ball, player];
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Build the attack" }),
    ).toBeVisible();
    await page.locator('input[type="file"][accept^=".hbd"]').setInputFiles({
      name: "carrying.hbd",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "open-handball-board",
          version: 1,
          project,
          assets: [],
        }),
      ),
    });
    const chip = page.getByRole("img", {
      name: "attacker Carrier",
      exact: true,
    });
    const ballChip = page.getByRole("img", {
      name: "equipment ball",
      exact: true,
    });
    await expect(chip).toBeVisible();
    await drag(page, chip, 180, 250, false);
    await expectPosition(chip, 180, 250);
    await expectPosition(ballChip, 200, 250);
    await page.mouse.up();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expectPosition(chip, 100, 200);
    await expectPosition(ballChip, 120, 200);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expectPosition(chip, 180, 250);
    await expectPosition(ballChip, 200, 250);
    // Drag into, then out of, the player's center without moving the player.
    await drag(page, ballChip, 180, 250);
    await expectPosition(chip, 180, 250);
    await expectPosition(ballChip, 180, 250);
    await drag(page, ballChip, 300, 300, false);
    await expectPosition(chip, 180, 250);
    await expectPosition(ballChip, 300, 300);
    await page.mouse.up();
    await drag(page, chip, 160, 220);
    await expectPosition(ballChip, 300, 300);
    await drag(page, ballChip, 178, 220);
    await page.getByRole("button", { name: "Add step", exact: true }).click();
    await drag(page, chip, 220, 280);
    await expectPosition(ballChip, 238, 280);
    await page.getByLabel("Animation timeline").evaluate((element) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(element, "750");
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expectPosition(chip, 190, 250);
    await expectPosition(ballChip, 208, 250);
    await page.getByRole("button", { name: "Edit step", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("All changes saved");
    await page.reload();
    await expect(chip).toBeVisible();
    await expectPosition(chip, 160, 220);
    await expectPosition(ballChip, 178, 220);
    await drag(page, chip, 180, 220);
    await expectPosition(ballChip, 198, 220);
  });
}
