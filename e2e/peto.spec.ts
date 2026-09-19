import { expect, test, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function setRange(input: Locator, value: string) {
  await input.evaluate((element, value) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test("player petos are translucent beneath labels, configurable, and survive steps and exports", async ({
  page,
}) => {
  await page.goto("/");
  const court = page.locator("#tactical-canvas");
  const player = court.getByRole("img", { name: "attacker B", exact: true });
  await player.click();
  await page.getByLabel("Peto", { exact: true }).check();
  await expect(player.locator('[data-peto="yellow"]')).toHaveCount(1);
  await expect(court.locator("[data-peto]")).toHaveCount(1);
  for (const color of ["Orange", "Green", "Blue"]) {
    await page
      .getByRole("button", { name: `${color} peto`, exact: true })
      .click();
    await expect(
      player.locator(`[data-peto="${color.toLowerCase()}"]`),
    ).toHaveCount(1);
  }
  await page.getByLabel("Peto", { exact: true }).uncheck();
  await expect(player.locator("[data-peto]")).toHaveCount(0);
  await page.getByLabel("Peto", { exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Blue peto", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Yellow peto", exact: true }).click();
  for (const shape of ["triangle", "square", "circle"]) {
    await page
      .getByRole("button", { name: `Use ${shape}`, exact: true })
      .click();
    expect(
      await player.evaluate((element) => {
        const shape = element.querySelector('[id$="-shape"]')!;
        const overlay = element.querySelector("[data-peto] path")!;
        const use = element.querySelector("[data-peto] use")!;
        const label = element.querySelector("text")!;
        return (
          use.getAttribute("href") === `#${shape.id}` &&
          !!(
            overlay.compareDocumentPosition(label) &
            Node.DOCUMENT_POSITION_FOLLOWING
          )
        );
      }),
    ).toBe(true);
  }
  await expect(player.locator("[data-peto] path")).toHaveAttribute(
    "fill-opacity",
    "0.62",
  );
  await expect(player.locator("text")).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Attacker kit", exact: true }).click();
  await page
    .getByRole("button", { name: "Use Horizontal · 3 stripes", exact: true })
    .click();
  await expect(player.locator('[data-kit-pattern="stripes"]')).toHaveCount(1);
  await expect(player.locator('[data-peto="yellow"]')).toHaveCount(1);
  await page.screenshot({ path: "/tmp/handball-peto.png", fullPage: true });
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await player.click();
  await page.getByLabel("Object rotation").fill("60");
  await setRange(page.getByLabel("Token size"), "28");
  await setRange(page.getByLabel("Animation timeline"), "750");
  expect(
    await player.evaluate((element) => {
      const shape = (
        element.querySelector('[id$="-shape"]') as SVGGraphicsElement
      ).getScreenCTM()!;
      const peto = (
        element.querySelector("[data-peto] path") as SVGGraphicsElement
      ).getScreenCTM()!;
      return ["a", "b", "c", "d", "e", "f"].every(
        (key) =>
          Math.abs(
            (shape[key as keyof DOMMatrix] as number) -
              (peto[key as keyof DOMMatrix] as number),
          ) < 0.00001,
      );
    }),
  ).toBe(true);
  await page.getByRole("button", { name: "Edit step", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("All changes saved");
  await page.reload();
  await expect(court.locator('[data-peto="yellow"]')).toHaveCount(1);
  await page.getByRole("button", { name: /^Export/ }).click();
  const files: Record<string, Buffer> = {};
  for (const name of ["PNG snapshot", "SVG snapshot", "Handball project"]) {
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: new RegExp(name) })
      .click();
    const download = await downloading;
    files[name] = await readFile((await download.path())!);
    expect(files[name].length).toBeGreaterThan(300);
  }
  const backup = JSON.parse(files["Handball project"].toString());
  expect(
    backup.project.keyframes[0].tokens.find(
      (token: { role: string; label: string }) =>
        token.role === "attacker" && token.label === "B",
    ).peto,
  ).toEqual({ enabled: true, color: "yellow" });
  const exported = await page.context().newPage();
  await exported.setContent(files["SVG snapshot"].toString());
  await expect(exported.locator('[data-peto="yellow"]')).toHaveCount(1);
  expect(
    await exported
      .locator("[data-peto] use")
      .evaluate(
        (element) =>
          !!document.getElementById(element.getAttribute("href")!.slice(1)),
      ),
  ).toBe(true);
  // Raster check: x=0,y=8 inside B's bib, on a white kit stripe, away from its label.
  const pixel = await exported.evaluate(
    async (png) => {
      const image = new Image();
      image.src = png;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      return [...ctx.getImageData(424, 626, 1, 1).data];
    },
    `data:image/png;base64,${files["PNG snapshot"].toString("base64")}`,
  );
  expect(pixel[0]).toBeGreaterThan(240);
  expect(pixel[1]).toBeGreaterThan(210);
  expect(pixel[2]).toBeGreaterThan(80);
  expect(pixel[2]).toBeLessThan(130);
  await exported.close();
  await page.getByLabel("Close dialog").click();
  await page
    .locator('input[type="file"][accept^=".hbd"]')
    .setInputFiles({
      name: "peto.hbd",
      mimeType: "application/json",
      buffer: files["Handball project"],
    });
  await expect(court.locator('[data-peto="yellow"]')).toHaveCount(1);
});

test("defenders and goalkeepers can wear petos; equipment cannot", async ({
  page,
}) => {
  await page.goto("/");
  const court = page.locator("#tactical-canvas");
  for (const name of ["defender 1", "goalkeeper GK"]) {
    const player = court.getByRole("img", { name, exact: true }).first();
    await player.click();
    await page.getByLabel("Peto", { exact: true }).check();
    await expect(player.locator('[data-peto="yellow"]')).toHaveCount(1);
  }
  await court.getByRole("img", { name: "equipment ball", exact: true }).click();
  await expect(page.getByLabel("Peto", { exact: true })).toHaveCount(0);
});
