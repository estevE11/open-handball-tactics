import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type { DrillProject } from "../types/project";
import { TacticalCanvas } from "../components/board/TacticalCanvas";
import { snapshotSource } from "./snapshot";
import { dataUrl } from "./projectIo";
import { animationExportPlan } from "./animationExportPlan";

export function checkExportCanceled(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Export canceled.", "AbortError");
}

export function canvasPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Could not create the animation preview.")),
      "image/png",
    ),
  );
}

export async function createAnimationRenderer(
  project: DrillProject,
  urls: Record<string, string>,
  voronoi: boolean,
  signal: AbortSignal,
) {
  const plan = animationExportPlan(project);
  const assets: Record<string, string> = {};
  await Promise.all(
    project.customAssets.map(async (asset) => {
      const url = urls[asset.id];
      if (!url)
        throw new Error(
          "An image is still loading. Try exporting again in a moment.",
        );
      assets[asset.id] = url.startsWith("data:")
        ? url
        : await dataUrl(await (await fetch(url, { signal })).blob());
    }),
  );
  checkExportCanceled(signal);
  const host = document.createElement("div");
  host.dataset.animationExportRenderer = "true";
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${plan.width}px;height:${plan.height}px;pointer-events:none;`;
  document.body.append(host);
  const root = createRoot(host);
  const canvas = document.createElement("canvas");
  canvas.width = plan.width;
  canvas.height = plan.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    root.unmount();
    host.remove();
    throw new Error("Canvas export is unavailable.");
  }
  const background =
    project.courtConfig.background === "floor"
      ? project.courtConfig.themeColors.floor
      : project.courtConfig.background;
  return {
    canvas,
    context,
    plan,
    async draw(time: number) {
      checkExportCanceled(signal);
      flushSync(() =>
        root.render(
          <TacticalCanvas
            assetUrls={assets}
            onAssetDrop={() => {}}
            onion={false}
            renderScene={{ project, time, voronoi }}
          />,
        ),
      );
      const svg = host.querySelector("svg")!;
      const { blob } = await snapshotSource(svg, background, plan.bounds);
      const url = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        checkExportCanceled(signal);
        context.fillStyle = background;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    dispose() {
      root.unmount();
      host.remove();
    },
  };
}
