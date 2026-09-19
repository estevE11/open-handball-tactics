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
  await page
    .locator('input[type="file"][accept^=".hbd"]')
    .setInputFiles({
      name: "bottom.hbd",
      mimeType: "application/json",
      buffer: file,
    });
  await expect(page.getByLabel("Goal position")).toHaveValue("bottom");
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
