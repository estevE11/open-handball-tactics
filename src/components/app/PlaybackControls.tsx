import { useEffect } from "react";
import { Play, Pause, RotateCcw, Pencil } from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import { animationDuration, frameTime } from "../../lib/animation";

export function PlaybackControls() {
  const {
    project,
    frameIndex,
    playbackTime,
    playing,
    setPlayback,
    stopPlayback,
    edit,
  } = useProjectStore();
  useEffect(() => {
    if (!playing || !project) return;
    const started = performance.now();
    const offset = useProjectStore.getState().playbackTime ?? 0;
    const duration = animationDuration(project);
    let request: number;
    const tick = (now: number) => {
      const time = Math.min(duration, offset + now - started);
      setPlayback(time, time < duration);
      if (time < duration) request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, project, setPlayback]);
  if (!project) return null;
  const duration = animationDuration(project);
  const time = playbackTime ?? frameTime(project, frameIndex);
  return (
    <div className="playback-controls">
      <button
        className="icon-button"
        aria-label={playing ? "Pause animation" : "Play animation"}
        disabled={!duration}
        onClick={() => setPlayback(time >= duration ? 0 : time, !playing)}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button
        className="icon-button"
        aria-label="Restart animation"
        disabled={!duration}
        onClick={() => setPlayback(0, playing)}
      >
        <RotateCcw size={15} />
      </button>
      <input
        type="range"
        aria-label="Animation timeline"
        min={0}
        max={duration || 1}
        step={10}
        value={time}
        disabled={!duration}
        onChange={(e) => setPlayback(Number(e.target.value))}
      />
      <span className="playback-time">
        {(time / 1000).toFixed(1)} / {(duration / 1000).toFixed(1)}s
      </span>
      {playbackTime !== null ? (
        <button className="text-button" onClick={stopPlayback}>
          <Pencil size={13} /> Edit step
        </button>
      ) : (
        <label className="duration-label">
          To next step
          <input
            type="number"
            aria-label="Transition duration in seconds"
            min="0.1"
            max="30"
            step="0.1"
            disabled={frameIndex === project.keyframes.length - 1}
            value={project.keyframes[frameIndex].duration / 1000}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value))
                edit((d) => {
                  d.keyframes[frameIndex].duration = Math.max(
                    100,
                    Math.min(30000, value * 1000),
                  );
                });
            }}
          />
          <span>s</span>
        </label>
      )}
    </div>
  );
}
