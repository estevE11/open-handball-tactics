import { Layers, Plus, X } from "lucide-react";
import { useProjectStore } from "../../store/projectStore";
import { PlaybackControls } from "./PlaybackControls";

export function AnimationPanel({
  onion,
  setOnion,
}: {
  onion: boolean;
  setOnion: (value: boolean) => void;
}) {
  const { project, frameIndex, edit, setFrame } = useProjectStore();
  if (!project) return null;

  return (
    <section className="animation-panel" aria-label="Animation panel">
      <div className="panel-title animation-panel-heading">
        <span>
          <Layers size={15} />
          <strong>Drill steps</strong>
        </span>
        <span className="steps-count">{project.keyframes.length} / 200</span>
      </div>
      <PlaybackControls />
      <label
        className="onion-toggle"
        title="Show the previous step on the court"
      >
        <input
          type="checkbox"
          aria-label="Onion skin"
          checked={onion}
          onChange={(event) => setOnion(event.target.checked)}
        />
        Onion skin
      </label>
      <div className="steps-list">
        {project.keyframes.map((frame, index) => (
          <div
            className={`step-item ${index === frameIndex ? "active" : ""}`}
            key={frame.id}
          >
            <button className="step-select" onClick={() => setFrame(index)}>
              <span className="step-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{frame.name}</span>
            </button>
            {project.keyframes.length > 1 && index === frameIndex && (
              <button
                className="icon-button"
                aria-label="Delete step"
                onClick={() => {
                  edit((draft) => {
                    draft.keyframes.splice(index, 1);
                  });
                  setFrame(Math.max(0, index - 1));
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        <button
          className="add-step"
          disabled={project.keyframes.length >= 200}
          onClick={() => {
            const index = project.keyframes.length;
            edit((draft) => {
              const frame = structuredClone(draft.keyframes[frameIndex]);
              frame.id = crypto.randomUUID();
              frame.name = `Step ${index + 1}`;
              draft.keyframes.push(frame);
            });
            setFrame(index);
          }}
        >
          <Plus size={17} />
          <span>Add step</span>
        </button>
      </div>
    </section>
  );
}
