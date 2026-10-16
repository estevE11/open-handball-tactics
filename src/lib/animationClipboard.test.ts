import { afterEach, expect, it, vi } from "vitest";
import { copyAnimationGif } from "./animationClipboard";
import type { AnimationResult } from "./animationExport";

afterEach(() => vi.unstubAllGlobals());
const result: AnimationResult = {
  blob: new Blob(["GIF89a"], { type: "image/gif" }),
  poster: new Blob(["poster"], { type: "image/png" }),
  extension: "gif",
  gifDataUrl: "data:image/gif;base64,R0lGODlh",
  width: 720,
  height: 720,
};
function clipboard(nativeGif: boolean) {
  class Item {
    static supports = (mime: string) => nativeGif && mime === "image/gif";
    constructor(readonly data: Record<string, Blob>) {}
  }
  const write = vi
    .fn<(items: Item[]) => Promise<void>>()
    .mockResolvedValue(undefined);
  vi.stubGlobal("ClipboardItem", Item);
  vi.stubGlobal("navigator", { clipboard: { write } });
  return write;
}
it("writes actual GIF bytes where the native clipboard supports them", async () => {
  const write = clipboard(true);
  expect(await copyAnimationGif(result)).toBe("gif");
  expect(write.mock.calls[0][0][0].data).toEqual({ "image/gif": result.blob });
});
it("preserves embedded animation in the HTML fallback and reports the fallback", async () => {
  const write = clipboard(false);
  expect(await copyAnimationGif(result)).toBe("html");
  const data = write.mock.calls[0][0][0].data;
  expect(await data["text/html"].text()).toContain(result.gifDataUrl);
  expect(data["image/png"]).toBe(result.poster);
});
it("reports unavailable or denied clipboard access without pretending to copy", async () => {
  clipboard(false).mockRejectedValue(
    new DOMException("Denied", "NotAllowedError"),
  );
  await expect(copyAnimationGif(result)).rejects.toThrow("Denied");
  vi.stubGlobal("navigator", {});
  await expect(copyAnimationGif(result)).rejects.toThrow("Download GIF");
});
