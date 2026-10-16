import { dataUrl, download } from "./projectIo";

export async function snapshotSource(
  original: SVGSVGElement,
  background = "#fafaf8",
  bounds?: { x: number; y: number; width: number; height: number },
) {
  const svg = original.cloneNode(true) as SVGSVGElement;
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const view = bounds ?? original.viewBox.baseVal;
  let left = view.x,
    top = view.y,
    right = view.x + view.width,
    bottom = view.y + view.height;
  const inverse = original.getScreenCTM()!.inverse();
  // Court snapshots also include ink placed in the surrounding canvas space,
  // even if a later window resize hides that ink in the editor.
  for (const stroke of original.querySelectorAll<SVGGraphicsElement>(
    "[data-drawing-stroke]",
  )) {
    if (bounds || stroke.closest("[data-editor-only]")) continue;
    const box = stroke.getBBox();
    const matrix = inverse.multiply(stroke.getScreenCTM()!);
    const padding = Number(stroke.getAttribute("stroke-width") ?? 0) / 2 + 4;
    for (const point of [
      new DOMPoint(box.x - padding, box.y - padding),
      new DOMPoint(box.x + box.width + padding, box.y - padding),
      new DOMPoint(box.x - padding, box.y + box.height + padding),
      new DOMPoint(box.x + box.width + padding, box.y + box.height + padding),
    ]) {
      const p = point.matrixTransform(matrix);
      left = Math.min(left, p.x);
      top = Math.min(top, p.y);
      right = Math.max(right, p.x);
      bottom = Math.max(bottom, p.y);
    }
  }
  svg.setAttribute("viewBox", `${left} ${top} ${right - left} ${bottom - top}`);
  svg.setAttribute("width", String((right - left) * 2));
  svg.setAttribute("height", String((bottom - top) * 2));
  svg.style.background = background;
  svg
    .querySelectorAll("[data-editor-only]")
    .forEach((element) => element.remove());
  svg
    .querySelectorAll("[data-token-glyph]")
    .forEach((element) => element.removeAttribute("filter"));
  for (const image of svg.querySelectorAll("image")) {
    // Object URLs are temporary. Resolve the displayed image to a self-contained data URL.
    const href = image.getAttribute("href");
    if (href?.startsWith("blob:")) {
      const blob = await (await fetch(href)).blob();
      image.setAttribute("href", await dataUrl(blob));
    }
  }
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
    type: "image/svg+xml",
  });
  return { blob, width: right - left, height: bottom - top };
}

export async function snapshot(
  format: "svg" | "png",
  title: string,
  background = "#fafaf8",
) {
  const original = document.querySelector<SVGSVGElement>("#tactical-canvas");
  if (!original) return;
  const { blob } = await snapshotSource(original, background);
  if (format === "svg") {
    download(blob, `${title}.svg`);
    return;
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PNG export is unavailable.");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not export image."))),
        "image/png",
      ),
    );
    download(png, `${title}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
