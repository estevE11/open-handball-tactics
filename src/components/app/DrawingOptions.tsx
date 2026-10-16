import { useProjectStore } from "../../store/projectStore";

export function DrawingOptions() {
  const { tool, project, frameIndex, drawing, setDrawing, playbackTime } =
    useProjectStore();
  if (tool !== "draw" && tool !== "erase") return null;
  const strokeCount = project?.keyframes[frameIndex].drawings?.length ?? 0;
  return (
    <aside
      inert={playbackTime !== null}
      className="drawing-options"
      role="group"
      aria-label="Freehand drawing settings"
    >
      <label>
        Color
        <input
          type="color"
          aria-label="Drawing color"
          value={drawing.color}
          onChange={(e) => setDrawing({ color: e.target.value })}
        />
      </label>
      <label>
        Thickness <span className="drawing-value">{drawing.width}</span>
        <input
          type="range"
          aria-label="Drawing thickness"
          min="1"
          max="12"
          step="0.5"
          value={drawing.width}
          onChange={(e) => setDrawing({ width: Number(e.target.value) })}
        />
      </label>
      <label>
        Opacity{" "}
        <span className="drawing-value">
          {Math.round(drawing.opacity * 100)}%
        </span>
        <input
          type="range"
          aria-label="Drawing opacity"
          min="0.1"
          max="1"
          step="0.1"
          value={drawing.opacity}
          onChange={(e) => setDrawing({ opacity: Number(e.target.value) })}
        />
      </label>
      <label>
        Smoothing{" "}
        <span className="drawing-value">
          {Math.round(drawing.smoothing * 100)}%
        </span>
        <input
          type="range"
          aria-label="Drawing smoothing"
          min="0"
          max="0.8"
          step="0.1"
          value={drawing.smoothing}
          onChange={(e) => setDrawing({ smoothing: Number(e.target.value) })}
        />
      </label>
      <label className="pen-only">
        <input
          type="checkbox"
          checked={drawing.penOnly}
          onChange={(e) => setDrawing({ penOnly: e.target.checked })}
        />
        Pen only
      </label>
      <span className="drawing-hint">
        {strokeCount >= 500
          ? "Stroke limit reached. Erase or clear to draw more."
          : tool === "erase"
            ? "Drag across a stroke to erase it. Undo restores it."
            : "Draw with mouse, touch, or pen. Right-drag erases whole strokes."}
        {drawing.penOnly && " Fingers are ignored."}
      </span>
    </aside>
  );
}
