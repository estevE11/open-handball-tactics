import { useCollaborationStore } from "../../store/collaborationStore";
import { drawingPath } from "../../lib/drawingGeometry";
import { Arrow } from "./Arrow";

export function RemotePresence({
  frameId,
  sceneRotation,
}: {
  frameId: string;
  sceneRotation: number;
}) {
  const peers = useCollaborationStore((s) => s.peers);
  return (
    <g pointerEvents="none" data-editor-only="true">
      {Object.entries(peers)
        .filter(([, peer]) => peer.frameId === frameId)
        .map(([id, peer]) => (
          <g key={id} data-peer-presence={id}>
            {peer.arrow && <Arrow arrow={peer.arrow} />}
            {peer.stroke && (
              <path
                data-peer-stroke={id}
                d={drawingPath(peer.stroke.points)}
                fill="none"
                stroke={peer.stroke.color}
                strokeWidth={peer.stroke.width}
                opacity={peer.stroke.opacity}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {peer.cursor && (
              <g
                data-peer-cursor={id}
                transform={`translate(${peer.cursor.x} ${peer.cursor.y}) rotate(${-sceneRotation})`}
              >
                <path
                  d="M0 0 L3 14 L6 9 L12 8 Z"
                  fill={peer.color}
                  stroke="white"
                  strokeWidth="1.3"
                />
                <rect
                  x="10"
                  y="11"
                  width={Math.max(45, peer.name.length * 5.8 + 12)}
                  height="17"
                  rx="4"
                  fill={peer.color}
                />
                <text
                  x="16"
                  y="23"
                  fontSize="10"
                  fill="white"
                  fontFamily="system-ui"
                >
                  {peer.name}
                </text>
              </g>
            )}
          </g>
        ))}
    </g>
  );
}
