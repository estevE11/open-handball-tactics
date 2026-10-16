import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Copy, Film, Image, Share2 } from "lucide-react";
import type { DrillProject } from "../../types/project";
import {
  exportAnimation,
  videoMimeType,
  type AnimationFormat,
  type AnimationResult,
} from "../../lib/animationExport";
import {
  copyAnimationGif,
  nativeGifClipboard,
} from "../../lib/animationClipboard";
import { animationDuration } from "../../lib/animation";
import { download } from "../../lib/projectIo";

type ReadyAnimation = AnimationResult & { url: string };

export function AnimatedExport({
  project,
  assetUrls,
  voronoi,
}: {
  project: DrillProject;
  assetUrls: Record<string, string>;
  voronoi: boolean;
}) {
  const [format, setFormat] = useState<AnimationFormat | null>(null);
  const [results, setResults] = useState<
    Partial<Record<AnimationFormat, ReadyAnimation>>
  >({});
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const operation = useRef<AbortController | null>(null);
  const objectUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      operation.current?.abort();
      objectUrls.current.forEach(URL.revokeObjectURL);
    },
    [],
  );
  const result = format ? results[format] : undefined;
  const video = videoMimeType();
  const recording = progress !== null;

  async function generate(next: AnimationFormat) {
    setFormat(next);
    setMessage("");
    setError("");
    if (results[next]) return;
    const controller = new AbortController();
    operation.current = controller;
    setProgress(0);
    try {
      const output = await exportAnimation(
        project,
        assetUrls,
        voronoi,
        next,
        controller.signal,
        setProgress,
      );
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(output.blob);
      objectUrls.current.push(url);
      setResults((current) => ({ ...current, [next]: { ...output, url } }));
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Animation export failed.",
        );
    } finally {
      if (operation.current === controller && !controller.signal.aborted)
        setProgress(null);
    }
  }
  function cancel() {
    operation.current?.abort();
    operation.current = null;
    setProgress(null);
    setMessage("Export canceled.");
  }
  async function copyGif() {
    if (!result) return;
    setError("");
    setMessage("");
    try {
      const copied = await copyAnimationGif(result);
      setMessage(
        copied === "gif"
          ? "GIF copied. Paste to share."
          : "Copied as a rich image. Some apps paste a still image; Download GIF or Share GIF keeps the animation.",
      );
    } catch {
      setError(
        "Clipboard access is unavailable or was blocked. Use Download GIF or Share GIF.",
      );
    }
  }
  const file = result
    ? new File([result.blob], `${project.title}.${result.extension}`, {
        type: result.blob.type,
      })
    : null;
  const canShare = !!file && !!navigator.canShare?.({ files: [file] });
  async function share() {
    if (!file) return;
    setError("");
    try {
      await navigator.share({ files: [file], title: project.title });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setError(
          "Sharing is unavailable. Download the animation and attach it to your message.",
        );
    }
  }
  return (
    <section className="animated-export" aria-label="Animated export">
      <h3>Share the whole drill</h3>
      <p className="muted">
        {project.keyframes.length < 2
          ? "One step produces a still image. Add steps in Animation for movement."
          : `${project.keyframes.length} steps · ${(animationDuration(project) / 1000).toFixed(1)} seconds of movement`}
      </p>
      <div className="animated-export-choices">
        <button
          className="button secondary"
          disabled={recording}
          aria-pressed={format === "gif"}
          onClick={() => void generate("gif")}
        >
          <Image size={16} /> GIF animation
        </button>
        <button
          className="button secondary"
          disabled={recording || !video}
          aria-pressed={format === "video"}
          title={
            video
              ? "Video renders in real time"
              : "Video export is unavailable; use GIF"
          }
          onClick={() => void generate("video")}
        >
          <Film size={16} /> Video animation{" "}
          <small>{video?.startsWith("video/mp4") ? "MP4" : "WebM"}</small>
        </button>
      </div>
      {recording && (
        <div className="animation-export-progress">
          <progress
            aria-label={`Preparing ${format === "gif" ? "GIF" : "video"}`}
            max={100}
            value={Math.round(progress * 100)}
          />
          <span>
            {Math.round(progress * 100)}%
            {format === "video"
              ? " · Recording in real time"
              : " · Preparing GIF"}
          </span>
          <button className="text-button" onClick={cancel}>
            Cancel export
          </button>
        </div>
      )}
      {result && !recording && (
        <div className="animation-export-result">
          <p className="muted">
            {result.extension.toUpperCase()} · {result.width} × {result.height}{" "}
            · {Math.max(1, Math.round(result.blob.size / 1024))} KB
          </p>
          <div className="animation-share-actions">
            <button
              className="button primary"
              onClick={() =>
                download(result.blob, `${project.title}.${result.extension}`)
              }
            >
              <ArrowDownToLine size={15} /> Download{" "}
              {result.extension.toUpperCase()}
            </button>
            {result.extension === "gif" && (
              <button
                className="button secondary"
                onClick={() => void copyGif()}
              >
                <Copy size={15} /> Copy GIF
              </button>
            )}
            {canShare && (
              <button className="button secondary" onClick={() => void share()}>
                <Share2 size={15} /> Share {result.extension.toUpperCase()}
              </button>
            )}
          </div>
          {result.extension === "gif" ? (
            <img src={result.url} alt="Animated drill preview" />
          ) : (
            <video
              src={result.url}
              controls
              loop
              playsInline
              aria-label="Drill video preview"
            />
          )}
          {result.extension === "gif" && !nativeGifClipboard() && (
            <p className="animation-clipboard-note">
              Copy GIF uses the rich-image clipboard in this browser. Some apps
              paste only a still image. Download or Share the GIF to preserve
              animation.
            </p>
          )}
        </div>
      )}
      {message && (
        <p className="animation-export-message" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="dialog-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
