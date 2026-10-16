import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import type { DrawingStroke, Point } from "../../types/project";
import {
  appendDrawingPoint,
  drawingHit,
  drawingPath,
  drawingPolyline,
} from "../../lib/drawingGeometry";

type InkGesture = {
  pointerId: number;
  pointerType: string;
  last: Point;
  stroke: DrawingStroke | null;
  erased: Set<string>;
  traces: { stroke: DrawingStroke; polyline: Point[] }[];
};

function Stroke({ stroke }: { stroke: DrawingStroke }) {
  const first = stroke.points[0];
  const style = {
    fill: "none",
    stroke: stroke.color,
    strokeWidth: stroke.width,
    opacity: stroke.opacity,
  };
  return stroke.points.length === 1 ? (
    <circle
      data-drawing-stroke={stroke.id}
      cx={first.x}
      cy={first.y}
      r={stroke.width / 2}
      fill={stroke.color}
      opacity={stroke.opacity}
    />
  ) : (
    <path
      data-drawing-stroke={stroke.id}
      d={drawingPath(stroke.points)}
      {...style}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function DrawingLayer({
  strokes,
  point,
  active,
}: {
  strokes: DrawingStroke[];
  point: (event: { clientX: number; clientY: number }) => Point;
  active: boolean;
}) {
  const { tool, drawing, edit, frameIndex } = useProjectStore();
  const layer = useRef<SVGGElement>(null);
  const [bounds, setBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  useLayoutEffect(() => {
    const element = layer.current!;
    const svg = element.ownerSVGElement!;
    const observer = new ResizeObserver(() => {
      const rect = svg.getBoundingClientRect();
      const matrix = element.getScreenCTM()!.inverse();
      const corners = [
        new DOMPoint(rect.left, rect.top),
        new DOMPoint(rect.right, rect.top),
        new DOMPoint(rect.left, rect.bottom),
        new DOMPoint(rect.right, rect.bottom),
      ].map((point) => point.matrixTransform(matrix));
      const x = Math.min(...corners.map((p) => p.x));
      const y = Math.min(...corners.map((p) => p.y));
      setBounds({
        x,
        y,
        width: Math.max(...corners.map((p) => p.x)) - x,
        height: Math.max(...corners.map((p) => p.y)) - y,
      });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const gesture = useRef<InkGesture | null>(null);
  const tick = useRef<number | null>(null);
  const [preview, setPreview] = useState<{
    stroke: DrawingStroke | null;
    erased: string[];
  }>({ stroke: null, erased: [] });
  useEffect(
    () => () => {
      if (tick.current !== null) cancelAnimationFrame(tick.current);
    },
    [],
  );

  function refresh() {
    if (tick.current !== null) return;
    tick.current = requestAnimationFrame(() => {
      tick.current = null;
      const current = gesture.current;
      setPreview({
        stroke: current?.stroke
          ? { ...current.stroke, points: [...current.stroke.points] }
          : null,
        erased: [...(current?.erased ?? [])],
      });
    });
  }
  function reset() {
    gesture.current = null;
    if (tick.current !== null) cancelAnimationFrame(tick.current);
    tick.current = null;
    setPreview({ stroke: null, erased: [] });
  }
  function erase(current: InkGesture, p: Point, radius: number) {
    for (const { stroke, polyline } of current.traces) {
      if (
        !current.erased.has(stroke.id) &&
        drawingHit(stroke, current.last, p, radius, polyline)
      )
        current.erased.add(stroke.id);
    }
    current.last = p;
  }
  function eraserRadius(element: SVGGElement) {
    const matrix = element.getScreenCTM();
    // A small, screen-sized target remains usable on a zoomed-out full court.
    return 8 / Math.max(0.01, Math.hypot(matrix?.a ?? 1, matrix?.b ?? 0));
  }
  function down(event: React.PointerEvent<SVGGElement>) {
    event.stopPropagation();
    if (
      !active ||
      (drawing.penOnly && event.pointerType !== "pen") ||
      (event.pointerType === "touch" && !event.isPrimary)
    )
      return;
    if (![0, 2, 5].includes(event.button)) return;
    if (gesture.current) {
      // A pen takes precedence over a finger/palm that landed first.
      if (
        event.pointerType !== "pen" ||
        gesture.current.pointerType !== "touch"
      )
        return;
      if (event.currentTarget.hasPointerCapture(gesture.current.pointerId))
        event.currentTarget.releasePointerCapture(gesture.current.pointerId);
      reset();
    }
    event.preventDefault();
    const p = point(event);
    const erasing =
      tool === "erase" ||
      event.button === 2 ||
      event.button === 5 ||
      (event.buttons & 34) !== 0;
    if (!erasing && strokes.length >= 500) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const current: InkGesture = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      last: p,
      stroke: erasing
        ? null
        : {
            id: crypto.randomUUID(),
            points: [p],
            color: drawing.color,
            width: drawing.width,
            opacity: drawing.opacity,
          },
      erased: new Set(),
      traces: erasing
        ? strokes.map((stroke) => ({
            stroke,
            polyline: drawingPolyline(stroke.points),
          }))
        : [],
    };
    gesture.current = current;
    if (erasing) erase(current, p, eraserRadius(event.currentTarget));
    refresh();
  }
  function move(event: React.PointerEvent<SVGGElement>) {
    event.stopPropagation();
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const sample of samples.length ? samples : [event]) {
      const p = point(sample);
      if (current.stroke)
        appendDrawingPoint(current.stroke.points, p, drawing.smoothing);
      else erase(current, p, eraserRadius(event.currentTarget));
    }
    refresh();
  }
  function finish(event: React.PointerEvent<SVGGElement>) {
    event.stopPropagation();
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const p = point(event);
    if (current.stroke)
      appendDrawingPoint(current.stroke.points, p, drawing.smoothing, true);
    else erase(current, p, eraserRadius(event.currentTarget));
    if (current.stroke || current.erased.size)
      edit((draft) => {
        const frame = draft.keyframes[frameIndex];
        if (current.stroke) (frame.drawings ??= []).push(current.stroke);
        else
          frame.drawings = (frame.drawings ?? []).filter(
            (stroke) => !current.erased.has(stroke.id),
          );
      });
    reset();
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return (
    <g
      ref={layer}
      data-drawing-layer="true"
      pointerEvents={active ? "auto" : "none"}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={(event) => {
        event.stopPropagation();
        if (gesture.current?.pointerId === event.pointerId) reset();
      }}
      onLostPointerCapture={(event) => {
        if (gesture.current?.pointerId === event.pointerId) reset();
      }}
      onContextMenu={(event) => {
        if (active) event.preventDefault();
      }}
    >
      {strokes
        .filter((stroke) => !preview.erased.includes(stroke.id))
        .map((stroke) => (
          <Stroke key={stroke.id} stroke={stroke} />
        ))}
      {preview.stroke && (
        <g data-editor-only="true" pointerEvents="none">
          <Stroke stroke={preview.stroke} />
        </g>
      )}
      {active && bounds && (
        <rect
          data-editor-only="true"
          data-drawing-surface="true"
          {...bounds}
          fill="transparent"
        />
      )}
    </g>
  );
}
