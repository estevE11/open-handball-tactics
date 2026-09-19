import { dataUrl, download } from "./projectIo";

export async function snapshot(
  format: "svg" | "png",
  title: string,
  background = "#fafaf8",
) {
  const original = document.querySelector<SVGSVGElement>("#tactical-canvas");
  if (!original) return;
  const svg = original.cloneNode(true) as SVGSVGElement;
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", String(original.viewBox.baseVal.width * 2));
  svg.setAttribute("height", String(original.viewBox.baseVal.height * 2));
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
