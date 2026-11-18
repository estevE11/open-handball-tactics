import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState({ value, text: String(value) });
  if (draft.value !== value) setDraft({ value, text: String(value) });
  function commit(next: number) {
    const valid = Math.max(min, Math.min(max, Math.round(next)));
    setDraft({ value: valid, text: String(valid) });
    if (valid !== value) onChange(valid);
  }
  return (
    <span className="number-stepper">
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        step="1"
        value={draft.text}
        onChange={(event) => {
          const next = event.target.valueAsNumber;
          const valid = Number.isInteger(next) && next >= min && next <= max;
          setDraft({ value: valid ? next : value, text: event.target.value });
          if (valid) onChange(next);
        }}
        onBlur={() => {
          const next = draft.text.trim() ? Number(draft.text) : value;
          commit(Number.isFinite(next) ? next : value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <span className="number-stepper-buttons">
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => commit(value + 1)}
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => commit(value - 1)}
        >
          <ChevronDown size={14} />
        </button>
      </span>
    </span>
  );
}
