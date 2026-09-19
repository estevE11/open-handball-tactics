import { create } from "zustand";
import type { DrillProject, Tool } from "../types/project";
import { library } from "../lib/browserStorage";
import { normalizeProject } from "../lib/projectCompatibility";
import { animationDuration, sampleProject } from "../lib/animation";

// Serialize writes so an older save can never finish after a newer edit.
let pending: Promise<void> = Promise.resolve();
let queued: { project: DrillProject; revision: number } | null = null;
let saving = false;
let revision = 0;
interface BoardState {
  project: DrillProject | null;
  frameIndex: number;
  playbackTime: number | null;
  playing: boolean;
  setPlayback: (time: number, playing?: boolean) => void;
  stopPlayback: () => void;
  tool: Tool;
  selected: string | null;
  past: DrillProject[];
  future: DrillProject[];
  saveStatus: "saved" | "saving" | "error";
  error: string | null;
  open: (project: DrillProject) => void;
  edit: (change: (draft: DrillProject) => void) => void;
  undo: () => void;
  redo: () => void;
  setTool: (tool: Tool) => void;
  setSelected: (id: string | null) => void;
  setFrame: (index: number) => void;
  retry: () => void;
}
function persist(project: DrillProject) {
  const current = ++revision;
  queued = { project, revision: current };
  useProjectStore.setState({ saveStatus: "saving", error: null });
  if (saving) return;
  saving = true;
  pending = (async () => {
    while (queued) {
      const next = queued;
      queued = null;
      try {
        await library.save(next.project);
        if (revision === next.revision && !queued)
          useProjectStore.setState({ saveStatus: "saved" });
      } catch (error) {
        if (revision === next.revision && !queued)
          useProjectStore.setState({
            saveStatus: "error",
            error: String(error instanceof Error ? error.message : error),
          });
      }
    }
    saving = false;
  })();
}
export async function flushSaves() {
  await pending;
  if (saving) await pending;
  if (useProjectStore.getState().saveStatus === "error")
    throw new Error(
      "Save failed. Export a backup or retry before leaving this drill.",
    );
}
export const useProjectStore = create<BoardState>((set, get) => ({
  project: null,
  frameIndex: 0,
  playbackTime: null,
  playing: false,
  setPlayback: (time, playing = false) => {
    const project = get().project;
    if (project)
      set({
        playbackTime: Math.max(0, Math.min(animationDuration(project), time)),
        playing,
        selected: null,
      });
  },
  stopPlayback: () => {
    const state = get();
    set({
      frameIndex:
        state.project && state.playbackTime !== null
          ? sampleProject(state.project, state.playbackTime).index
          : state.frameIndex,
      playbackTime: null,
      playing: false,
    });
  },
  tool: "select",
  selected: null,
  past: [],
  future: [],
  saveStatus: "saved",
  error: null,
  open: (project) =>
    set({
      project: normalizeProject(project),
      frameIndex: 0,
      playbackTime: null,
      playing: false,
      selected: null,
      past: [],
      future: [],
      saveStatus: "saved",
      error: null,
    }),
  edit: (change) => {
    const state = get();
    if (!state.project) return;
    const project = structuredClone(state.project);
    change(project);
    project.updatedAt = Date.now();
    set({
      project,
      playbackTime: null,
      playing: false,
      past: [...state.past.slice(-49), state.project],
      future: [],
    });
    persist(project);
  },
  undo: () => {
    const state = get();
    const project = state.past.at(-1);
    if (!project || !state.project) return;
    set({
      project,
      past: state.past.slice(0, -1),
      future: [state.project, ...state.future],
      frameIndex: Math.min(state.frameIndex, project.keyframes.length - 1),
      selected: null,
      playbackTime: null,
      playing: false,
    });
    persist(project);
  },
  redo: () => {
    const state = get();
    const project = state.future[0];
    if (!project || !state.project) return;
    set({
      project,
      past: [...state.past, state.project],
      future: state.future.slice(1),
      frameIndex: Math.min(state.frameIndex, project.keyframes.length - 1),
      selected: null,
      playbackTime: null,
      playing: false,
    });
    persist(project);
  },
  setTool: (tool) => set({ tool, selected: null }),
  setSelected: (selected) => set({ selected }),
  setFrame: (frameIndex) =>
    set({ frameIndex, selected: null, playbackTime: null, playing: false }),
  retry: () => {
    const project = get().project;
    if (project) persist(project);
  },
}));
