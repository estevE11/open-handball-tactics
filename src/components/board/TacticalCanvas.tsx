import { useRef, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import type {
  DrillProject,
  Point,
  TacticalArrow,
  TacticalToken,
} from "../../types/project";
import { Court } from "./Court";
import { Arrow, ArrowHandles } from "./Arrow";
import { Token } from "./Token";
import { DrawingLayer } from "./DrawingLayer";
import { Voronoi } from "./Voronoi";
import { sampleProject } from "../../lib/animation";
import { tokenRotation } from "../../lib/projectCompatibility";
import { playerKit } from "../../lib/kits";
import {
  courtSize,
  courtRotation,
  courtViewBox,
} from "../../lib/courtGeometry";
import {
  editableControls,
  translateArrow,
  withControls,
} from "../../lib/arrowGeometry";
import { carriedBalls, dragTokenPositions } from "../../lib/ballCarry";

type Gesture = {
  kind:
    | "token"
    | "draw-arrow"
    | "move-arrow"
    | "control"
    | "start"
    | "end"
    | "rotate";
  id: string;
  start: Point;
  point: Point;
  offset?: Point;
  rotation?: number;
  index?: number;
  originalArrow?: TacticalArrow;
  ballIds?: string[];
};
export function TacticalCanvas({
  assetUrls,
  onAssetDrop,
  onion,
  renderScene,
}: {
  assetUrls: Record<string, string>;
  onAssetDrop: (id: string, point: Point) => void;
  onion: boolean;
  renderScene?: { project: DrillProject; time: number; voronoi: boolean };
}) {
  const {
    project: storedProject,
    frameIndex,
    tool: storedTool,
    selected: storedSelected,
    edit,
    setSelected,
    setTool,
    playbackTime: storedPlaybackTime,
    voronoi: storedVoronoi,
  } = useProjectStore();
  const project = renderScene?.project ?? storedProject;
  const playbackTime = renderScene?.time ?? storedPlaybackTime;
  const voronoi = renderScene?.voronoi ?? storedVoronoi;
  const tool = renderScene ? "select" : storedTool;
  const selected = renderScene ? null : storedSelected;
  const svg = useRef<SVGSVGElement>(null);
  const scene = useRef<SVGGElement>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  if (!project) return null;
  const frame =
    playbackTime === null
      ? project.keyframes[frameIndex]
      : sampleProject(project, playbackTime).frame;
  const config = project.courtConfig;
  const { width, height } = courtSize(config);
  const sceneRotation = courtRotation(config);
  function drawingPoint(event: { clientX: number; clientY: number }): Point {
    const bounds = svg.current!.getBoundingClientRect();
    const matrix = scene.current?.getScreenCTM()?.inverse();
    // Ink can use the SVG's letterboxed space around the court. Capture keeps
    // strokes continuous at the edges, but never extends them into the UI.
    const p = new DOMPoint(
      Math.max(bounds.left, Math.min(bounds.right, event.clientX)),
      Math.max(bounds.top, Math.min(bounds.bottom, event.clientY)),
    ).matrixTransform(matrix);
    return { x: p.x, y: p.y };
  }
  function point(event: { clientX: number; clientY: number }): Point {
    const p = drawingPoint(event);
    return {
      x: Math.max(0, Math.min(width, p.x)),
      y: Math.max(0, Math.min(height, p.y)),
    };
  }
  function begin(
    event: React.PointerEvent,
    kind: Gesture["kind"],
    id: string,
    origin?: Point,
    index?: number,
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
      index,
      offset: origin ? { x: origin.x - p.x, y: origin.y - p.y } : undefined,
      rotation:
        kind === "rotate"
          ? tokenRotation(frame.tokens.find((t) => t.id === id)!)
          : undefined,
      originalArrow: frame.arrows.find((a) => a.id === id),
      ballIds:
        kind === "token"
          ? carriedBalls(frame.tokens, id, config.playerScale)
          : [],
    });
  }
  function previewArrow(arrow: TacticalArrow): TacticalArrow {
    if (!gesture || gesture.id !== arrow.id) return arrow;
    const original = gesture.originalArrow ?? arrow;
    if (gesture.kind === "move-arrow")
      return translateArrow(
        original,
        {
          x: gesture.point.x - gesture.start.x,
          y: gesture.point.y - gesture.start.y,
        },
        { width, height },
      );
    if (gesture.kind === "start" || gesture.kind === "end")
      return { ...original, [gesture.kind]: gesture.point };
    if (gesture.kind === "control") {
      const controls = [...editableControls(original)];
      controls[gesture.index ?? 0] = gesture.point;
      return withControls(original, controls);
    }
    return arrow;
  }
  function down(event: React.PointerEvent) {
    if (event.button !== 0 || playbackTime !== null) return;
    if (tool === "draw" || tool === "erase") return;
    const p = point(event);
    if (tool === "select") {
      setSelected(null);
      return;
    }
    if (["run", "pass", "dribble", "screen"].includes(tool)) {
      svg.current?.setPointerCapture(event.pointerId);
      setGesture({
        kind: "draw-arrow",
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
        tool === "ball"
          ? "#f6f1e7"
          : tool === "ladder"
            ? "#e9b54c"
            : tool === "cone"
              ? "#e87935"
              : tool === "defender"
                ? "#eaa958"
                : tool === "goalkeeper"
                  ? "#879a85"
                  : tool === "attacker"
                    ? "#4f8cba"
                    : "#46564d",
      size:
        tool === "ball" ? 6 : tool === "cone" ? 5 : tool === "ladder" ? 22 : 14,
      position: p,
    };
    edit((d) => {
      d.keyframes[frameIndex].tokens.push(token);
    });
    setTool("select");
    setSelected(token.id);
  }
  const dragPositions =
    gesture?.kind === "token"
      ? dragTokenPositions(
          frame.tokens,
          gesture.id,
          gesture.point,
          gesture.ballIds ?? [],
          { width, height },
        )
      : new Map<string, Point>();
  const previewTokens = frame.tokens.map((token) =>
    dragPositions.has(token.id)
      ? { ...token, position: dragPositions.get(token.id)! }
      : gesture?.id === token.id && gesture.kind === "rotate"
        ? { ...token, rotation: gesture.rotation }
        : token,
  );
  function finish() {
    if (!gesture) return;
    if (
      gesture.kind === "draw-arrow" &&
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
          controlPoints: [],
          color: "#46564d",
        });
      });
    } else if (gesture.kind === "token") {
      const original = frame.tokens.find((t) => t.id === gesture.id);
      const next = dragPositions.get(gesture.id);
      if (
        original &&
        next &&
        (original.position.x !== next.x || original.position.y !== next.y)
      )
        edit((d) => {
          for (const token of d.keyframes[frameIndex].tokens) {
            const position = dragPositions.get(token.id);
            if (position) token.position = position;
          }
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
    } else if (gesture.originalArrow) {
      const next = previewArrow(gesture.originalArrow);
      if (JSON.stringify(next) !== JSON.stringify(gesture.originalArrow))
        edit((d) => {
          const index = d.keyframes[frameIndex].arrows.findIndex(
            (a) => a.id === gesture.id,
          );
          if (index !== -1) d.keyframes[frameIndex].arrows[index] = next;
        });
    }
    setGesture(null);
  }
  const selectedArrow = frame.arrows.find((arrow) => arrow.id === selected);
  return (
    <svg
      id={renderScene ? undefined : "tactical-canvas"}
      ref={svg}
      className={`tactical-canvas ${tool !== "select" ? "drawing" : ""}`}
      viewBox={courtViewBox(config)}
      aria-label="Interactive handball court"
      onPointerDown={down}
      onPointerMove={(e) => {
        if (!gesture) return;
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
      {/* Rotate the entire scene; saved coordinates and animation stay court-relative. */}
      <g
        ref={scene}
        data-court-scene="true"
        transform={
          sceneRotation === -90
            ? "translate(0 400) rotate(-90)"
            : sceneRotation === 180
              ? "translate(400 400) rotate(180)"
              : undefined
        }
      >
        <Court config={config} />
        {voronoi && (
          <Voronoi
            tokens={previewTokens}
            project={project}
            width={width}
            height={height}
          />
        )}
        {onion && frameIndex > 0 && playbackTime === null && (
          <g opacity=".2" pointerEvents="none">
            {project.keyframes[frameIndex - 1].tokens.map((token) => (
              <Token
                key={token.id}
                token={token}
                labels={config.showLabels}
                playerScale={config.playerScale}
                sceneRotation={sceneRotation}
                kit={playerKit(project, token)}
                image={token.assetId ? assetUrls[token.assetId] : undefined}
              />
            ))}
          </g>
        )}
        {frame.arrows.map((arrow) => (
          <Arrow
            key={arrow.id}
            arrow={previewArrow(arrow)}
            onPointerDown={
              tool === "select" && playbackTime === null
                ? (e) => begin(e, "move-arrow", arrow.id)
                : undefined
            }
          />
        ))}
        {gesture?.kind === "draw-arrow" && (
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
        {[...previewTokens]
          .sort(
            (a, b) =>
              Number(a.equipment === "ball") - Number(b.equipment === "ball"),
          )
          .map((token) => (
            <Token
              key={token.id}
              token={token}
              playerScale={config.playerScale}
              sceneRotation={sceneRotation}
              kit={playerKit(project, token)}
              selected={selected === token.id}
              labels={config.showLabels}
              image={token.assetId ? assetUrls[token.assetId] : undefined}
              onPointerDown={
                playbackTime === null
                  ? (e) => begin(e, "token", token.id, token.position)
                  : undefined
              }
              onRotate={
                playbackTime === null
                  ? (e) => begin(e, "rotate", token.id)
                  : undefined
              }
            />
          ))}
        {selectedArrow && playbackTime === null && (
          <ArrowHandles
            arrow={previewArrow(selectedArrow)}
            onHandle={(e, kind, origin, index) =>
              begin(e, kind, selectedArrow.id, origin, index)
            }
          />
        )}
        <DrawingLayer
          key={`${project.id}:${frame.id}:${tool}:${playbackTime === null}:${width}:${height}:${sceneRotation}`}
          strokes={frame.drawings ?? []}
          point={drawingPoint}
          active={
            (tool === "draw" || tool === "erase") && playbackTime === null
          }
        />
      </g>
    </svg>
  );
}
