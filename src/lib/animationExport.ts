import type { DrillProject } from "../types/project";
import { dataUrl } from "./projectIo";
import {
  canvasPng,
  checkExportCanceled,
  createAnimationRenderer,
} from "./animationRenderer";

export type AnimationFormat = "gif" | "video";
export interface AnimationResult {
  blob: Blob;
  poster: Blob;
  gifDataUrl?: string;
  extension: "gif" | "mp4" | "webm";
  width: number;
  height: number;
}

export function videoMimeType() {
  if (
    typeof MediaRecorder === "undefined" ||
    !HTMLCanvasElement.prototype.captureStream
  )
    return null;
  return (
    [
      // Container-only MP4 support can select a codec unsuitable for sharing.
      "video/mp4;codecs=avc1.42E01E",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type)) ?? null
  );
}

function wait(milliseconds: number, signal: AbortSignal) {
  checkExportCanceled(signal);
  return new Promise<void>((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      reject(new DOMException("Export canceled.", "AbortError"));
    };
    const timer = setTimeout(
      () => {
        signal.removeEventListener("abort", cancel);
        resolve();
      },
      Math.max(0, milliseconds),
    );
    signal.addEventListener("abort", cancel, { once: true });
  });
}

function workerRequest(
  worker: Worker,
  message: object,
  transfer: Transferable[],
  signal: AbortSignal,
): Promise<{ bytes?: Uint8Array<ArrayBuffer> }> {
  checkExportCanceled(signal);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signal.removeEventListener("abort", cancel);
      worker.onmessage = null;
      worker.onerror = null;
    };
    const cancel = () => {
      cleanup();
      reject(new DOMException("Export canceled.", "AbortError"));
    };
    signal.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (event) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data);
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error("GIF encoding failed. Try exporting again."));
    };
    worker.postMessage(message, transfer);
  });
}

export async function exportAnimation(
  project: DrillProject,
  urls: Record<string, string>,
  voronoi: boolean,
  format: AnimationFormat,
  signal: AbortSignal,
  progress: (value: number) => void,
): Promise<AnimationResult> {
  const renderer = await createAnimationRenderer(
    project,
    urls,
    voronoi,
    signal,
  );
  const { canvas, context, plan } = renderer;
  let worker: Worker | undefined;
  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  try {
    await renderer.draw(0);
    const poster = await canvasPng(canvas);
    if (format === "gif") {
      worker = new Worker(
        new URL("../workers/gif.worker.ts", import.meta.url),
        { type: "module" },
      );
      for (const [index, frame] of plan.frames.entries()) {
        if (index) await renderer.draw(frame.time);
        const rgba = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;
        await workerRequest(
          worker,
          {
            type: "frame",
            rgba: rgba.buffer,
            width: canvas.width,
            height: canvas.height,
            delay: frame.delay,
          },
          [rgba.buffer],
          signal,
        );
        progress((index + 1) / plan.frames.length);
      }
      const { bytes } = await workerRequest(
        worker,
        { type: "finish" },
        [],
        signal,
      );
      const blob = new Blob([bytes!], { type: "image/gif" });
      return {
        blob,
        poster,
        gifDataUrl: await dataUrl(blob),
        extension: "gif",
        width: canvas.width,
        height: canvas.height,
      };
    }
    const mimeType = videoMimeType();
    if (!mimeType)
      throw new Error(
        "Video export is unavailable in this browser. Use GIF instead.",
      );
    stream = canvas.captureStream(20);
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 3_000_000,
    });
    const chunks: Blob[] = [];
    let failure: Error | null = null;
    const recorded = new Promise<Blob>((resolve, reject) => {
      recorder!.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder!.onerror = () => {
        failure = new Error("Video recording failed. Use GIF instead.");
        reject(failure);
      };
      recorder!.onstop = () =>
        resolve(new Blob(chunks, { type: recorder!.mimeType }));
    });
    // The recorder can fail before the rendering loop finishes awaiting frames.
    void recorded.catch(() => {});
    recorder.start();
    const started = performance.now();
    let elapsed = 0;
    for (const [index, frame] of plan.frames.entries()) {
      if (failure) throw failure;
      if (index) await renderer.draw(frame.time);
      (
        stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack
      ).requestFrame?.();
      elapsed += frame.delay;
      await wait(started + elapsed - performance.now(), signal);
      progress((index + 1) / plan.frames.length);
    }
    // Canvas streams emit painted frames. Paint again after the final pause so
    // the recorded file includes that pause instead of ending at the last move.
    await renderer.draw(plan.frames.at(-1)!.time);
    (
      stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack
    ).requestFrame?.();
    await wait(50, signal);
    recorder.stop();
    const blob = await recorded;
    if (!blob.size)
      throw new Error("The browser returned an empty video. Use GIF instead.");
    return {
      blob,
      poster,
      extension: blob.type.startsWith("video/mp4") ? "mp4" : "webm",
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    worker?.terminate();
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
    renderer.dispose();
  }
}
