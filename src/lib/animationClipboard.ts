import type { AnimationResult } from "./animationExport";

export function nativeGifClipboard() {
  return (
    typeof ClipboardItem !== "undefined" &&
    typeof ClipboardItem.supports === "function" &&
    ClipboardItem.supports("image/gif")
  );
}

export async function copyAnimationGif(
  result: AnimationResult,
): Promise<"gif" | "html"> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
    throw new Error(
      "This browser cannot copy images. Use Download GIF or Share GIF.",
    );
  if (result.extension !== "gif" || !result.gifDataUrl)
    throw new Error("Generate a GIF first.");
  if (nativeGifClipboard()) {
    await navigator.clipboard.write([
      new ClipboardItem({ "image/gif": result.blob }),
    ]);
    return "gif";
  }
  // Preserve the animation in HTML where the receiving app accepts it. PNG is
  // a compatible still-image alternative, never reported as a native GIF copy.
  const html = `<img src="${result.gifDataUrl}" alt="Animated handball drill" width="${result.width}" height="${result.height}">`;
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "image/png": result.poster,
    }),
  ]);
  return "html";
}
