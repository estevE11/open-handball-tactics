import { useRef, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import type { Point, TacticalArrow, TacticalToken } from "../../types/project";
import { Court } from "./Court";
import { Arrow } from "./Arrow";
import { Token } from "./Token";
import { sampleProject } from "../../lib/animation";
import { tokenRotation } from "../../lib/projectCompatibility";

export function TacticalCanvas({
  assetUrls,
  onAssetDrop,
  onion,
}: {
  assetUrls: Record<string, string>;
  onAssetDrop: (id: string, point: Point) => void;
  onion: boolean;
}) {
  const {
    project,
    frameIndex,
    tool,
    selected,
    edit,
    setSelected,
    setTool,
    playbackTime,
  } = useProjectStore();
  const svg = useRef<SVGSVGElement>(null);
  const [gesture, setGesture] = useState<{
    kind: "token" | "arrow" | "curve" | "rotate";
    id: string;
    start: Point;
    offset?: Point;
    point: Point;
    rotation?: number;
  } | null>(null);
  if (!project) return null;
  const frame =
    playbackTime === null
      ? project.keyframes[frameIndex]
      : sampleProject(project, playbackTime).frame;
  const config = project.courtConfig;
  const width =
    config.type === "custom_box" ? config.dimensions.width * 20 : 400;
  const height =
    config.type === "full"
      ? 800
      : config.type === "half"
        ? 400
        : config.dimensions.height * 20;
  function point(event: { clientX: number; clientY: number }): Point {
    const matrix = svg.current?.getScreenCTM()?.inverse();
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix,
    );
    return {
      x: Math.max(0, Math.min(width, p.x)),
      y: Math.max(0, Math.min(height, p.y)),
    };
  }
  function begin(
    event: React.PointerEvent,
    kind: "token" | "curve" | "rotate",
    id: string,
    origin?: Point,
  ) {
    if (tool !== "select" || playbackTime !== null || event.button !== 0)
      return;
    event.stopPropagation();
    svg.current?.setPointerCapture(event.pointerId);
    const p = point(event);
    setSelected(id);
    setGesture({
      kind,
      id,
      start: p,
      point: origin ?? p,
      offset: origin ? { x: origin.x - p.x, y: origin.y - p.y } : undefined,
      rotation:
        kind === "rotate"
          ? tokenRotation(frame.tokens.find((t) => t.id === id)!)
          : undefined,
    });
  }
  function down(event: React.PointerEvent) {
    if (event.button !== 0 || playbackTime !== null) return;
    const p = point(event);
    if (tool === "select") {
      setSelected(null);
      return;
    }
    if (["run", "pass", "dribble", "screen"].includes(tool)) {
      svg.current?.setPointerCapture(event.pointerId);
      setGesture({
        kind: "arrow",
        id: crypto.randomUUID(),
        start: p,
        point: p,
      });
      return;
    }
    const equipment = ["ball", "cone", "goal", "ladder", "text"].includes(tool)
      ? (tool as TacticalToken["equipment"])
      : undefined;
    const role = equipment ? "equipment" : (tool as TacticalToken["role"]);
    const label =
      tool === "attacker"
        ? String.fromCharCode(
            65 +
              (frame.tokens.filter((t) => t.role === "attacker").length % 26),
          )
        : tool === "defender"
          ? "1"
          : tool === "goalkeeper"
            ? "GK"
            : tool === "text"
              ? "Note"
              : "";
    const token: TacticalToken = {
      id: crypto.randomUUID(),
      role,
      equipment,
      label,
      shape:
        tool === "defender" || tool === "cone" || tool === "goalkeeper"
          ? "triangle"
          : "circle",
      rotation: role === "defender" || role === "goalkeeper" ? 180 : 0,
      color:
        tool === "defender" || tool === "cone"
          ? "#eaa958"
          : tool === "goalkeeper"
            ? "#879a85"
            : tool === "attacker"
              ? "#4f8cba"
              : "#46564d",
      size: tool === "ball" ? 6 : 14,
      position: p,
    };
    edit((d) => {
      d.keyframes[frameIndex].tokens.push(token);
    });
    setTool("select");
    setSelected(token.id);
  }
  function finish() {
    if (!gesture) return;
    if (
      gesture.kind === "arrow" &&
      Math.hypot(
        gesture.point.x - gesture.start.x,
        gesture.point.y - gesture.start.y,
      ) > 5
    ) {
      edit((d) => {
        d.keyframes[frameIndex].arrows.push({
          id: gesture.id,
          type: tool as TacticalArrow["type"],
          start: gesture.start,
          end: gesture.point,
          color: "#46564d",
        });
      });
    } else if (
      gesture.kind === "token" &&
      (gesture.point.x !== gesture.start.x ||
        gesture.point.y !== gesture.start.y)
    ) {
      edit((d) => {
        const t = d.keyframes[frameIndex].tokens.find(
          (t) => t.id === gesture.id,
        );
        if (t) t.position = gesture.point;
      });
    } else if (gesture.kind === "rotate") {
      const original = frame.tokens.find((t) => t.id === gesture.id);
      if (original && gesture.rotation !== tokenRotation(original))
        edit((d) => {
          const token = d.keyframes[frameIndex].tokens.find(
            (t) => t.id === gesture.id,
          );
          if (token) token.rotation = gesture.rotation;
        });
    } else if (gesture.kind === "curve") {
      edit((d) => {
        const a = d.keyframes[frameIndex].arrows.find(
          (a) => a.id === gesture.id,
        );
        if (a) a.control = gesture.point;
      });
    }
    setGesture(null);
  }
  return (
    <svg
      id="tactical-canvas"
      ref={svg}
      className={`tactical-canvas ${tool !== "select" ? "drawing" : ""}`}
      viewBox={`-22 -25 ${width + 44} ${height + 50}`}
      aria-label="Interactive handball court"
      onPointerDown={down}
      onPointerMove={(e) => {
        if (gesture) {
          const p = point(e);
          if (gesture.kind === "rotate") {
            const token = frame.tokens.find((t) => t.id === gesture.id);
            if (!token) return;
            const angle =
              ((Math.atan2(p.y - token.position.y, p.x - token.position.x) *
                180) /
                Math.PI +
                450) %
              360;
            setGesture({
              ...gesture,
              rotation: e.shiftKey ? Math.round(angle / 15) * 15 : angle,
            });
            return;
          }
          setGesture({
            ...gesture,
            point: {
              x: Math.max(0, Math.min(width, p.x + (gesture.offset?.x ?? 0))),
              y: Math.max(0, Math.min(height, p.y + (gesture.offset?.y ?? 0))),
            },
          });
        }
      }}
      onPointerUp={finish}
      onPointerCancel={() => setGesture(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("application/handball-asset");
        if (id && playbackTime === null) onAssetDrop(id, point(e));
      }}
    >
      <Court config={config} />
      {onion && frameIndex > 0 && playbackTime === null && (
        <g opacity="0.2" pointerEvents="none">
          {project.keyframes[frameIndex - 1].tokens.map((t) => (
            <Token
              playerScale={config.playerScale}
              key={t.id}
              token={t}
              image={t.assetId ? assetUrls[t.assetId] : undefined}
            />
          ))}
        </g>
      )}
      {frame.arrows.map((a) => (
        <Arrow
          key={a.id}
          arrow={
            gesture?.kind === "curve" && gesture.id === a.id
              ? { ...a, control: gesture.point }
              : a
          }
          selected={selected === a.id}
          onSelect={
            tool === "select" && playbackTime === null
              ? () => setSelected(a.id)
              : undefined
          }
          onControl={(e) => begin(e, "curve", a.id)}
        />
      ))}
      {gesture?.kind === "arrow" && (
        <Arrow
          arrow={{
            id: gesture.id,
            start: gesture.start,
            end: gesture.point,
            type: tool as TacticalArrow["type"],
            color: "#46564d",
          }}
        />
      )}
      {frame.tokens.map((t) => (
        <Token
          playerScale={config.playerScale}
          key={t.id}
          token={
            gesture?.kind === "token" && gesture.id === t.id
              ? { ...t, position: gesture.point }
              : gesture?.kind === "rotate" && gesture.id === t.id
                ? { ...t, rotation: gesture.rotation }
                : t
          }
          selected={selected === t.id}
          labels={config.showLabels}
          image={t.assetId ? assetUrls[t.assetId] : undefined}
          onPointerDown={
            playbackTime === null
              ? (e) => begin(e, "token", t.id, t.position)
              : undefined
          }
          onRotate={
            playbackTime === null ? (e) => begin(e, "rotate", t.id) : undefined
          }
        />
      ))}
    </svg>
  );
}
