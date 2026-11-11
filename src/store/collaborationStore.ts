import { create } from "zustand";
import type {
  DrawingStroke,
  Point,
  TacticalArrow,
  TacticalToken,
} from "../types/project";

export interface LivePresence {
  name: string;
  color: string;
  frameId: string;
  cursor: Point | null;
  tokens?: TacticalToken[];
  arrow?: TacticalArrow;
  stroke?: DrawingStroke;
  erased?: string[];
}
interface CollaborationState {
  roomId: string | null;
  link: string;
  status: "local" | "connecting" | "waiting" | "connected";
  synced: boolean;
  error: string | null;
  connectionHint: string | null;
  peers: Record<string, LivePresence>;
  name: string;
  color: string;
  onion: boolean;
  activePane: "editor" | "animation";
  canUndo: boolean;
  canRedo: boolean;
}
export const useCollaborationStore = create<CollaborationState>(() => ({
  roomId: null,
  link: "",
  status: "local",
  synced: false,
  error: null,
  connectionHint: null,
  peers: {},
  name: `Coach ${Math.floor(Math.random() * 900 + 100)}`,
  color: ["#2563eb", "#b45309", "#9333ea", "#047857"][
    Math.floor(Math.random() * 4)
  ],
  onion: false,
  activePane: "editor",
  canUndo: false,
  canRedo: false,
}));
