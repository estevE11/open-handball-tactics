import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("half court goal position persists per drill, in defaults, and in exports", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const scene = page.locator("[data-court-scene]");
  const keeper = page.getByRole("img", { name: "goalkeeper GK" });
  const center = page.getByRole("img", { name: "attacker B", exact: true });
  await expect(keeper).toBeVisible();
  const original = await keeper.getAttribute("transform");
  expect((await keeper.boundingBox())!.y).toBeLessThan(
    (await center.boundingBox())!.y,
  );
  await page.getByLabel("Workspace defaults", { exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Goal position").selectOption("bottom");
  await dialog.getByRole("button", { name: "Save defaults" }).click();
  await expect(page.getByLabel("Goal position")).toHaveValue("top");
  await page.getByRole("button", { name: "Apply workspace defaults" }).click();
  await expect(scene).toHaveAttribute(
    "transform",
    "translate(400 400) rotate(180)",
  );
  await expect(keeper).toHaveAttribute("transform", original!);
  expect((await keeper.boundingBox())!.y).toBeGreaterThan(
    (await center.boundingBox())!.y,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Goal position")).toHaveValue("top");
  await page.getByLabel("Goal position").selectOption("bottom");
  await expect(page.getByRole("status")).toHaveText("All changes saved");
  await page.reload();
  await expect(page.getByLabel("Goal position")).toHaveValue("bottom");
  await expect(scene).toHaveAttribute(
    "transform",
    "translate(400 400) rotate(180)",
  );
  await page.getByRole("button", { name: /^Export/ }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /SVG snapshot/ }).click();
  const download = await downloading;
  const exported = await context.newPage();
  await exported.setContent(await readFile((await download.path())!, "utf8"));
  await expect(exported.locator("[data-court-scene]")).toHaveAttribute(
    "transform",
    "translate(400 400) rotate(180)",
  );
  await exported.close();
  const backupDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /Handball project/ }).click();
  const backup = await backupDownload;
  const file = await readFile((await backup.path())!);
  expect(JSON.parse(file.toString()).project.courtConfig.halfCourtEnd).toBe(
    "bottom",
  );
  await page.getByLabel("Close dialog").click();
  await page.locator('input[type="file"][accept^=".hbd"]').setInputFiles({
    name: "bottom.hbd",
    mimeType: "application/json",
    buffer: file,
  });
  await expect(page.getByLabel("Goal position")).toHaveValue("bottom");
  await page.getByLabel("Toggle library").click();
  await page
    .getByRole("button", { name: "New drill", exact: true })
    .first()
    .click();
  await dialog
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Defending view");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByLabel("Goal position")).toHaveValue("bottom");
  await expect(scene).toHaveAttribute(
    "transform",
    "translate(400 400) rotate(180)",
  );
});

test("compact defending view crops the unused end of the pitch", async ({
  page,
}) => {
  await page.goto("/");
  const court = page.getByLabel("Interactive handball court");
  await page.getByLabel("Court size").selectOption("16");
  await expect(court).toHaveAttribute("viewBox", "-12 -16 424 352");
  await page.getByLabel("Goal position").selectOption("bottom");
  await expect(court).toHaveAttribute("viewBox", "-12 64 424 352");
});

for (const view of ["top", "bottom", "full"] as const) {
  test(`${view} view: labels stay readable and centered while triangles face the attack`, async ({
    page,
    context,
  }) => {
    await page.goto("/");
    if (view === "full") await page.getByLabel("Template").selectOption("full");
    else await page.getByLabel("Goal position").selectOption(view);
    const defenders = page.getByRole("img", {
      name: "defender 1",
      exact: true,
    });
    const defender = defenders.first();
    const keeper = page.getByRole("img", { name: "goalkeeper GK" });
    const angle = async (token: ReturnType<typeof page.locator>) =>
      token.locator("text").evaluate((element) => {
        const m = (element as SVGTextElement).getScreenCTM()!;
        return (Math.atan2(m.b, m.a) * 180) / Math.PI;
      });
    await expect(defender).toBeVisible();
    expect(await angle(defender)).toBeCloseTo(0);
    expect(await angle(keeper)).toBeCloseTo(0);
    expect(
      await angle(page.getByRole("img", { name: "attacker B", exact: true })),
    ).toBeCloseTo(0);
    const pointing = await defender
      .locator("[data-token-glyph] path")
      .evaluate((element) => {
        const m = (element as SVGGraphicsElement).getScreenCTM()!;
        const tip = new DOMPoint(0, -16).matrixTransform(m);
        const center = new DOMPoint().matrixTransform(m);
        return { x: tip.x - center.x, y: tip.y - center.y };
      });
    if (view === "full") expect(pointing.x).toBeGreaterThan(0);
    else if (view === "top") expect(pointing.y).toBeGreaterThan(0);
    else expect(pointing.y).toBeLessThan(0);
    await defender.click();
    await page.getByLabel("Object rotation").fill("150");
    expect(await angle(defender)).toBeCloseTo(-30);
    await page.getByRole("tab", { name: "Animation", exact: true }).click();
    await page.getByRole("button", { name: "Add step", exact: true }).click();
    await page.getByRole("tab", { name: "Editor", exact: true }).click();
    await defender.click();
    await page.getByLabel("Object rotation").fill("210");
    expect(await angle(defender)).toBeCloseTo(30);
    await page.getByRole("tab", { name: "Animation", exact: true }).click();
    await page.getByLabel("Onion skin").check();
    expect(await angle(defenders.first())).toBeCloseTo(-30);
    expect(await angle(defenders.nth(2))).toBeCloseTo(30);
    await page.getByLabel("Animation timeline").evaluate((element) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(element, "750");
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(await angle(defender)).toBeCloseTo(0);
    await page.screenshot({
      path: `/tmp/handball-labels-${view}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: /^Export/ }).click();
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: /SVG snapshot/ }).click();
    const download = await downloading;
    const exported = await context.newPage();
    await exported.setContent(await readFile((await download.path())!, "utf8"));
    expect(
      await angle(
        exported.getByRole("img", { name: "defender 1", exact: true }).first(),
      ),
    ).toBeCloseTo(0);
    await exported.close();
  });
}
