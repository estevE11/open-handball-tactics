import { useTranslation } from "../../lib/i18n";
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
  const t = useTranslation();
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
  const whatsappVideo = video?.startsWith("video/mp4") ?? false;
  const recording = progress !== null;

  async function generate(
    next: AnimationFormat,
  ): Promise<ReadyAnimation | undefined> {
    setFormat(next);
    setMessage("");
    setError("");
    if (results[next]) return results[next];
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
      const ready = { ...output, url };
      setResults((current) => ({ ...current, [next]: ready }));
      return ready;
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
  async function downloadWhatsAppVideo() {
    if (!whatsappVideo) return;
    const output = await generate("video");
    if (!output) return;
    if (output.extension !== "mp4") {
      setError(
        "This browser could not create an MP4. Try an updated Chrome or Safari.",
      );
      return;
    }
    download(output.blob, `${project.title}.mp4`);
    setMessage(
      "MP4 downloaded. In WhatsApp Web, attach it using Photos & videos to send the movement as a video.",
    );
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
          ? "GIF copied. Animation depends on the receiving app. Use WhatsApp MP4 for WhatsApp Web."
          : "Image copied. Some apps paste a still image. Use WhatsApp MP4 to send the movement on WhatsApp Web.",
      );
    } catch {
      setError(
        "Clipboard access is unavailable or was blocked. Download the file instead; use MP4 for WhatsApp Web.",
      );
    }
  }
  const file = result
    ? new File([result.blob], `${project.title}.${result.extension}`, {
        type: result.blob.type.split(";")[0],
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
    <section className="animated-export" aria-label={t("Animated export")}>
      <h3>{t("Share the whole drill")}</h3>
      <p className="muted">
        {project.keyframes.length < 2
          ? t(
              "One step produces a still image. Add steps in Animation for movement.",
            )
          : t("{v0} steps · {v1} seconds of movement", {
              v0: project.keyframes.length,
              v1: (animationDuration(project) / 1000).toFixed(1),
            })}
      </p>
      <div className="animated-export-choices">
        <button
          className="button primary"
          disabled={recording || !whatsappVideo}
          title={
            whatsappVideo
              ? t("Download an H.264 MP4 for WhatsApp Web")
              : t(
                  "MP4 recording is unavailable in this browser. Try an updated Chrome or Safari.",
                )
          }
          onClick={() => void downloadWhatsAppVideo()}
        >
          <ArrowDownToLine size={16} /> {t("WhatsApp MP4")}
        </button>
        <button
          className="button secondary"
          disabled={recording}
          aria-pressed={format === "gif"}
          onClick={() => void generate("gif")}
        >
          <Image size={16} /> {t("GIF animation")}
        </button>
        <button
          className="button secondary"
          disabled={recording || !video}
          aria-pressed={format === "video"}
          title={
            video
              ? t("Video renders in real time")
              : t("Video export is unavailable; use GIF")
          }
          onClick={() => void generate("video")}
        >
          <Film size={16} /> {t("Video animation")}{" "}
          <small>{video?.startsWith("video/mp4") ? t("MP4") : t("WebM")}</small>
        </button>
      </div>
      <p className="animation-clipboard-note">
        {t(
          "For WhatsApp Web, download MP4 and attach it using Photos & videos. It sends as a video. Pasting or uploading a GIF may produce a still image.",
        )}
        {!whatsappVideo &&
          t(
            " MP4 recording is unavailable here; try an updated Chrome or Safari.",
          )}
      </p>
      {recording && (
        <div className="animation-export-progress">
          <progress
            aria-label={t("Preparing {v0}", {
              v0: format === "gif" ? t("GIF") : t("video"),
            })}
            max={100}
            value={Math.round(progress * 100)}
          />
          <span>
            {Math.round(progress * 100)}%
            {format === "video"
              ? t(" · Recording in real time")
              : t(" · Preparing GIF")}
          </span>
          <button className="text-button" onClick={cancel}>
            {t("Cancel export")}
          </button>
        </div>
      )}
      {result && !recording && (
        <div className="animation-export-result">
          <p className="muted">
            {result.extension.toUpperCase()} · {result.width} × {result.height}{" "}
            · {Math.max(1, Math.round(result.blob.size / 1024))} {t("KB")}
          </p>
          <div className="animation-share-actions">
            <button
              className="button primary"
              onClick={() =>
                download(result.blob, `${project.title}.${result.extension}`)
              }
            >
              <ArrowDownToLine size={15} /> {t("Download")}{" "}
              {result.extension.toUpperCase()}
            </button>
            {result.extension === "gif" && (
              <button
                className="button secondary"
                onClick={() => void copyGif()}
              >
                <Copy size={15} />{" "}
                {nativeGifClipboard() ? t("Copy GIF") : t("Copy image")}
              </button>
            )}
            {canShare && (
              <button className="button secondary" onClick={() => void share()}>
                <Share2 size={15} /> {t("Share")}{" "}
                {result.extension.toUpperCase()}
              </button>
            )}
          </div>
          {result.extension === "gif" ? (
            <img src={result.url} alt={t("Animated drill preview")} />
          ) : (
            <video
              src={result.url}
              controls
              loop
              playsInline
              aria-label={t("Drill video preview")}
            />
          )}
          {result.extension === "gif" && !nativeGifClipboard() && (
            <p className="animation-clipboard-note">
              {t(
                "Copy image includes a PNG preview and an embedded GIF. The receiving app decides whether it accepts animation; WhatsApp Web may use only the still preview. Use WhatsApp MP4 for that app.",
              )}
            </p>
          )}
        </div>
      )}
      {message && (
        <p className="animation-export-message" role="status">
          {t(message)}
        </p>
      )}
      {error && (
        <p className="dialog-error" role="alert">
          {t(error)}
        </p>
      )}
    </section>
  );
}
