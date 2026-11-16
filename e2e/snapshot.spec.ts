import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function setRange(input: Locator, value: number) {
  await input.evaluate((element, next) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(element, String(next));
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function downloadSnapshot(page: Page, format: "PNG" | "SVG") {
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: new RegExp(`^${format} snapshot`) })
    .click();
  const download = await downloading;
  expect(await download.failure()).toBeNull();
  return readFile((await download.path())!);
}

test("player arms are independent and persist across steps, views and exports", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const court = page.getByLabel("Interactive handball court");
  await expect(court.locator("[data-player-arms]")).toHaveCount(0);
  await expect(page.getByLabel("Arms", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Player arms", { exact: true })).toHaveCount(0);
  const player = court.getByRole("img", { name: "attacker C", exact: true });
  const otherPlayer = court.getByRole("img", { name: "attacker B", exact: true });
  await player.click();
  await expect(page.getByLabel("Arms", { exact: true })).not.toBeChecked();
  await page.getByLabel("Arms", { exact: true }).check();
  await otherPlayer.click();
  await expect(page.getByLabel("Arms", { exact: true })).not.toBeChecked();
  await page.getByLabel("Arms", { exact: true }).check();
  await expect(court.locator("[data-player-arms]")).toHaveCount(2);
  await page.getByLabel("Arms", { exact: true }).uncheck();
  await expect(player.locator("[data-player-arms]")).toHaveCount(1);
  await expect(otherPlayer.locator("[data-player-arms]")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("All changes saved");
  await page.reload();
  await player.click();
  await expect(page.getByLabel("Arms", { exact: true })).toBeChecked();
  await expect(court.locator("[data-player-arms]")).toHaveCount(1);
  await expect(court.locator("[data-player-arms] line")).toHaveCount(2);
  await expect(
    court.locator('[aria-label^="equipment"] [data-player-arms]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Attacker kit", exact: true }).click();
  const kitDialog = page.getByRole("dialog");
  await expect(kitDialog.locator("[data-player-arms]")).toHaveCount(0);
  await kitDialog
    .getByRole("button", { name: "Create kit", exact: true })
    .click();
  await kitDialog.getByLabel("Kit name").fill("Arms kit");
  await kitDialog.getByLabel("Primary color").fill("#b32939");
  await kitDialog
    .getByRole("button", { name: "Save and apply", exact: true })
    .click();
  await expect(player.locator("[data-player-arms]")).toHaveAttribute(
    "stroke",
    "#000000",
  );
  await expect(player.locator("[data-player-arms]")).toHaveAttribute(
    "stroke-width",
    "1.5",
  );
  await player.click();
  await setRange(page.getByLabel("Player scale", { exact: true }), 1.5);
  await setRange(page.getByLabel("Token size", { exact: true }), 28);
  await page.getByLabel("Object rotation", { exact: true }).fill("45");
  for (const shape of ["circle", "triangle", "square"]) {
    await page
      .getByRole("button", { name: `Use ${shape}`, exact: true })
      .click();
    const geometry = await player.evaluate((element) => {
      const body = element.querySelector<SVGGraphicsElement>('[id$="-shape"]')!;
      return [
        ...element.querySelectorAll<SVGLineElement>("[data-player-arms] line"),
      ].map((line) => ({
        angled:
          line.y2.baseVal.value < line.y1.baseVal.value &&
          Math.abs(line.x2.baseVal.value) > Math.abs(line.x1.baseVal.value),
        sameTransform: ["a", "b", "c", "d", "e", "f"].every(
          (key) =>
            Math.abs(
              (line.getCTM()![key as keyof DOMMatrix] as number) -
                (body.getCTM()![key as keyof DOMMatrix] as number),
            ) < 0.00001,
        ),
      }));
    });
    expect(geometry).toEqual([
      { angled: true, sameTransform: true },
      { angled: true, sameTransform: true },
    ]);
  }
  await court.screenshot({ path: "test-results/player-arms.png" });
  await page.getByRole("tab", { name: "Animation", exact: true }).click();
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page.getByLabel("Onion skin", { exact: true }).check();
  await expect(court.locator("[data-player-arms]")).toHaveCount(2);
  await setRange(page.getByLabel("Animation timeline", { exact: true }), 750);
  await expect(court.locator("[data-player-arms]")).toHaveCount(1);
  await page.getByRole("button", { name: /^Export/ }).click();
  const svg = await downloadSnapshot(page, "SVG");
  const exported = await context.newPage();
  await exported.setContent(svg.toString());
  await expect(exported.locator("[data-player-arms] line")).toHaveCount(2);
  await expect(
    exported.locator('[aria-label^="equipment"] [data-player-arms]'),
  ).toHaveCount(0);
  await expect(exported.locator("[data-token-glyph][filter]")).toHaveCount(0);
  await exported.close();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Handball project/ }).click();
  const backup = await readFile((await (await downloading).path())!);
  const saved = JSON.parse(backup.toString());
  for (const frame of saved.project.keyframes) {
    expect(
      frame.tokens.filter((token: { arms?: boolean }) => token.arms),
    ).toHaveLength(1);
    expect(
      frame.tokens.find((token: { label: string }) => token.label === "C").arms,
    ).toBe(true);
  }
  await page.getByLabel("Close dialog", { exact: true }).click();
  await page.getByRole("button", { name: "Edit step", exact: true }).click();
  await page.getByRole("tab", { name: "Editor", exact: true }).click();
  await player.click();
  await page.getByLabel("Peto", { exact: true }).check();
  await page.getByLabel("Arms", { exact: true }).uncheck();
  await expect(court.locator("[data-player-arms]")).toHaveCount(0);
  await expect(player.locator("[data-peto]")).toHaveCount(1);
  await expect(page.getByRole("status")).toHaveText("All changes saved");
  await page.reload();
  await player.click();
  await expect(
    page.getByLabel("Arms", { exact: true }),
  ).not.toBeChecked();
  await expect(court.locator("[data-player-arms]")).toHaveCount(0);
  await page.locator('input[type="file"][accept^=".hbd"]').setInputFiles({
    name: "arms.hbd",
    mimeType: "application/json",
    buffer: backup,
  });
  await expect(player.locator("[data-player-arms]")).toHaveCount(1);
  await expect(otherPlayer.locator("[data-player-arms]")).toHaveCount(0);
});

test("each player role can have arms while equipment cannot", async ({ page }) => {
  await page.goto("/");
  const court = page.getByLabel("Interactive handball court");
  for (const name of ["attacker B", "defender 1", "goalkeeper GK"]) {
    const player = court.getByRole("img", { name, exact: true }).first();
    await player.click();
    await expect(page.getByLabel("Arms", { exact: true })).not.toBeChecked();
    await page.getByLabel("Arms", { exact: true }).check();
    await expect(player.locator("[data-player-arms]")).toHaveCount(1);
  }
  await expect(court.locator("[data-player-arms]")).toHaveCount(3);
  await court.getByRole("img", { name: "equipment ball", exact: true }).click();
  await expect(page.getByLabel("Arms", { exact: true })).toHaveCount(0);
});

test("clipboard receives the exact PNG export, including background, arms, images, and off-court ink", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page
    .getByLabel("Interactive handball court")
    .getByRole("img", { name: "attacker C", exact: true })
    .click();
  await page.getByLabel("Arms", { exact: true }).check();
  await page
    .getByLabel("Canvas background", { exact: true })
    .selectOption("custom");
  await page
    .getByLabel("Canvas background color", { exact: true })
    .fill("#fff2dd");
  await page
    .locator('input[type="file"][accept^="image/png"]')
    .setInputFiles("public/icon-192.png");
  await page
    .getByRole("button", { name: "Add icon-192.png", exact: true })
    .click();
  await page.getByRole("button", { name: "Voronoi mode", exact: true }).click();
  await page
    .getByRole("button", { name: "Freehand drawing (B)", exact: true })
    .click();
  const points = await page.locator("[data-court-scene]").evaluate((element) =>
    [
      [-30, 100],
      [-20, 150],
      [10, 180],
    ].map(([x, y]) => {
      const point = new DOMPoint(x, y).matrixTransform(
        (element as SVGGElement).getScreenCTM()!,
      );
      return { x: point.x, y: point.y };
    }),
  );
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  for (const point of points.slice(1))
    await page.mouse.move(point.x, point.y, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator("[data-drawing-stroke]")).toHaveCount(1);
  await page.evaluate(() => {
    const write = navigator.clipboard.write.bind(navigator.clipboard);
    Object.defineProperty(navigator.clipboard, "write", {
      configurable: true,
      value: (items: ClipboardItem[]) => {
        (window as unknown as { writtenPng: Promise<number[]> }).writtenPng =
          items[0]
            .getType("image/png")
            .then(async (blob) =>
              Array.from(new Uint8Array(await blob.arrayBuffer())),
            );
        return write(items);
      },
    });
  });
  await page.getByRole("button", { name: /^Export/ }).click();
  const png = await downloadSnapshot(page, "PNG");
  await page.bringToFront();
  await page.getByRole("button", { name: /^Copy image to clipboard/ }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText(
    "Image copied to clipboard.",
  );
  const bytes = await page.evaluate(
    () => (window as unknown as { writtenPng: Promise<number[]> }).writtenPng,
  );
  expect(Buffer.from(bytes).equals(png)).toBe(true);
  // The OS may re-encode PNGs. Verify the actual system clipboard by pixels too.
  const comparison = await page.evaluate(async (base64) => {
    const [item] = await navigator.clipboard.read();
    const expected = await createImageBitmap(
      new Blob([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], {
        type: "image/png",
      }),
    );
    const actual = await createImageBitmap(await item.getType("image/png"));
    const pixels = (image: ImageBitmap) => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, image.width, image.height).data;
    };
    const a = pixels(expected),
      b = pixels(actual);
    const result = {
      sameSize:
        expected.width === actual.width && expected.height === actual.height,
      width: expected.width,
      differentChannels: a.reduce(
        (count, value, index) => count + Number(value !== b[index]),
        0,
      ),
    };
    expected.close();
    actual.close();
    return result;
  }, png.toString("base64"));
  expect(comparison.sameSize).toBe(true);
  expect(comparison.width).toBeGreaterThan(848); // Ink expands the original court bounds.
  expect(comparison.differentChannels).toBe(0);
});

test("denied or unavailable image clipboard reports failure and retains PNG download", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: /^Export/ }).click();
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "write", {
      configurable: true,
      value: () =>
        Promise.reject(new DOMException("Denied", "NotAllowedError")),
    }),
  );
  await page.getByRole("button", { name: /^Copy image to clipboard/ }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Clipboard access was blocked",
  );
  await expect(page.getByRole("dialog").getByRole("status")).toHaveCount(0);
  expect((await downloadSnapshot(page, "PNG")).byteLength).toBeGreaterThan(300);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    }),
  );
  await page.getByRole("button", { name: /^Copy image to clipboard/ }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "This browser cannot copy images",
  );
  await expect(
    page.getByRole("button", { name: /^PNG snapshot/ }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});
