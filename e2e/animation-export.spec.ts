import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function movingDrill(page: Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Animation", exact: true }).click();
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  const points = await page
    .locator("[data-court-scene]")
    .evaluate((element) => {
      const matrix = (element as SVGGElement).getScreenCTM()!;
      return [new DOMPoint(200, 289), new DOMPoint(260, 310)].map((p) => {
        const screen = p.matrixTransform(matrix);
        return { x: screen.x, y: screen.y };
      });
    });
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  await page.mouse.move(points[1].x, points[1].y, { steps: 5 });
  await page.mouse.up();
  await page.getByRole("button", { name: /01 Starting positions/ }).click();
  await page.getByLabel("Transition duration in seconds").fill("0.4");
  await expect(page.getByRole("status")).toHaveText("All changes saved");
}

async function downloadBytes(page: Page, name: string | RegExp) {
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name, exact: typeof name === "string" })
    .click();
  const file = await event;
  return {
    bytes: await readFile((await file.path())!),
    name: file.suggestedFilename(),
  };
}

test("GIF export contains moving frames, copies a rich image, preserves the drill, and handles clipboard denial", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await movingDrill(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async ({ files }: { files: File[] }) => {
        (window as unknown as { sharedGif: object }).sharedGif = {
          name: files[0].name,
          type: files[0].type,
          header: (await files[0].text()).slice(0, 6),
        };
      },
    });
  });
  await page.getByRole("tab", { name: "Editor", exact: true }).click();
  await page
    .locator('input[type="file"][accept^="image/png"]')
    .setInputFiles("public/icon-192.png");
  await page
    .getByRole("button", { name: "Add icon-192.png", exact: true })
    .click();
  await page.getByRole("button", { name: "Voronoi mode", exact: true }).click();
  const beforePosition = await page
    .getByRole("img", { name: "attacker B", exact: true })
    .getAttribute("transform");
  await page.getByRole("button", { name: /^Export/ }).click();
  const before = await downloadBytes(page, /Handball project/);
  await page
    .getByRole("button", { name: "GIF animation", exact: true })
    .click();
  const section = page.getByRole("region", {
    name: "Animated export",
    exact: true,
  });
  await expect(
    section.getByRole("img", { name: "Animated drill preview", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  const gif = await downloadBytes(page, "Download GIF");
  expect(gif.name).toMatch(/\.gif$/);
  expect(gif.bytes.subarray(0, 6).toString()).toBe("GIF89a");
  const decoded = await page.evaluate(async (base64) => {
    type Decoder = {
      tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } };
      decode: (options: {
        frameIndex: number;
      }) => Promise<{ image: VideoFrame }>;
      close: () => void;
    };
    const { ImageDecoder } = window as unknown as {
      ImageDecoder: new (options: {
        data: ArrayBuffer;
        type: string;
      }) => Decoder;
    };
    const decoder = new ImageDecoder({
      data: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer,
      type: "image/gif",
    });
    await decoder.tracks.ready;
    const count = decoder.tracks.selectedTrack.frameCount;
    const canvas = document.createElement("canvas");
    const first = (await decoder.decode({ frameIndex: 0 })).image;
    const last = (await decoder.decode({ frameIndex: count - 1 })).image;
    canvas.width = first.displayWidth;
    canvas.height = first.displayHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(first, 0, 0);
    const a = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    ctx.drawImage(last, 0, 0);
    const b = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let changed = 0;
    for (let i = 0; i < a.length; i += 4)
      if (
        Math.abs(a[i] - b[i]) +
          Math.abs(a[i + 1] - b[i + 1]) +
          Math.abs(a[i + 2] - b[i + 2]) >
        40
      )
        changed++;
    const result = {
      count,
      changed,
      width: canvas.width,
      height: canvas.height,
    };
    first.close();
    last.close();
    decoder.close();
    return result;
  }, gif.bytes.toString("base64"));
  expect(decoded.count).toBe(9);
  expect(decoded.changed).toBeGreaterThan(200);
  expect(Math.max(decoded.width, decoded.height)).toBe(720);
  await page.getByRole("button", { name: "Copy GIF", exact: true }).click();
  await expect(section.getByRole("status")).toContainText(/Copied|copied/);
  const clipboard = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const native = item.types.includes("image/gif");
    return {
      native,
      html: native ? "" : await (await item.getType("text/html")).text(),
      types: item.types,
    };
  });
  if (!clipboard.native) {
    expect(clipboard.html).toContain("data:image/gif;base64,");
    expect(clipboard.types).toContain("image/png");
    await expect(section.getByRole("status")).toContainText(
      "Some apps paste a still image",
    );
  }
  const after = await downloadBytes(page, /Handball project/);
  expect(after.bytes.equals(before.bytes)).toBe(true);
  await page.getByRole("button", { name: "Share GIF", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { sharedGif: object }).sharedGif,
      ),
    )
    .toMatchObject({ type: "image/gif", header: "GIF89a" });
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "write", {
      configurable: true,
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    }),
  );
  await page.getByRole("button", { name: "Copy GIF", exact: true }).click();
  await expect(section.getByRole("alert")).toContainText("blocked");
  await expect(
    page.getByRole("button", { name: "Download GIF", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "test-results/animated-export.png",
    fullPage: true,
  });
  await page.getByLabel("Close dialog").click();
  await expect(page.locator("[data-animation-export-renderer]")).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "attacker B", exact: true }),
  ).toHaveAttribute("transform", beforePosition!);
  expect(errors).toEqual([]);
});

test("video export produces a playable animation and can be canceled without changing playback", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await movingDrill(page);
  await page.getByRole("button", { name: /^Export/ }).click();
  await page.getByRole("button", { name: /^Video animation/ }).click();
  const section = page.getByRole("region", { name: "Animated export" });
  await expect(section.getByRole("progressbar")).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel export", exact: true })
    .click();
  await expect(section.getByRole("status")).toHaveText("Export canceled.");
  await expect(page.locator("[data-animation-export-renderer]")).toHaveCount(0);
  await page.getByRole("button", { name: /^Video animation/ }).click();
  const preview = page.getByLabel("Drill video preview", { exact: true });
  await expect(preview).toBeVisible({ timeout: 20000 });
  await expect
    .poll(() => preview.evaluate((v) => (v as HTMLVideoElement).readyState))
    .toBeGreaterThanOrEqual(2);
  const metadata = await preview.evaluate(async (element) => {
    const video = element as HTMLVideoElement;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(video, 0, 0);
    const a = context.getImageData(0, 0, canvas.width, canvas.height).data;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = 0.7;
    });
    context.drawImage(video, 0, 0);
    const b = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let changed = 0;
    for (let i = 0; i < a.length; i += 4)
      if (Math.abs(a[i] - b[i]) > 30) changed++;
    return {
      width: video.videoWidth,
      height: video.videoHeight,
      changed,
      duration: video.duration,
    };
  });
  expect(metadata.changed).toBeGreaterThan(50);
  expect(Math.max(metadata.width, metadata.height)).toBe(720);
  expect(metadata.duration).toBeGreaterThan(1);
  const video = await downloadBytes(page, /Download (MP4|WEBM)/);
  expect(video.name).toMatch(/\.(mp4|webm)$/);
  expect(video.bytes.length).toBeGreaterThan(2000);
  await page.getByLabel("Close dialog").click();
  await expect(
    page.getByRole("button", { name: "Play animation", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit step", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("closing a GIF export cancels work and the export dialog fits on mobile", async ({
  page,
}) => {
  await movingDrill(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /^Export/ }).click();
  await page
    .getByRole("button", { name: "GIF animation", exact: true })
    .click();
  await page.getByLabel("Close dialog").click();
  await expect(page.locator("[data-animation-export-renderer]")).toHaveCount(0);
  await page.getByRole("button", { name: /^Export/ }).click();
  await page
    .getByRole("button", { name: "GIF animation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Copy GIF", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  const box = (await page.getByRole("dialog").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.height).toBeLessThanOrEqual(844);
  await page.screenshot({
    path: "test-results/animated-export-mobile.png",
    fullPage: true,
  });
});

test("GIF encoding works offline and remains available without video support", async ({
  page,
  context,
}) => {
  await movingDrill(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.evaluate(() =>
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: undefined,
    }),
  );
  await page.getByRole("button", { name: /^Export/ }).click();
  await expect(
    page.getByRole("button", { name: /^Video animation/ }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "GIF animation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Copy GIF", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  const gif = await downloadBytes(page, "Download GIF");
  expect(gif.bytes.subarray(0, 6).toString()).toBe("GIF89a");
});
