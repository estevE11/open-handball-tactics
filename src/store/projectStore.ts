import { create } from 'zustand'
import type { DrillProject, Tool } from '../types/project'
import { library } from '../lib/browserStorage'

// Serialize writes so an older save can never finish after a newer edit.
let pending: Promise<void> = Promise.resolve()
let revision = 0
interface BoardState {
  project: DrillProject | null; frameIndex: number; tool: Tool; selected: string | null
  past: DrillProject[]; future: DrillProject[]; saveStatus: 'saved' | 'saving' | 'error'; error: string | null
  open: (project: DrillProject) => void
  edit: (change: (draft: DrillProject) => void) => void
  undo: () => void; redo: () => void; setTool: (tool: Tool) => void
  setSelected: (id: string | null) => void; setFrame: (index: number) => void
  retry: () => void
}
function persist(project: DrillProject) {
  const current = ++revision
  useProjectStore.setState({ saveStatus: 'saving', error: null })
  pending = pending.catch(() => {}).then(() => library.save(project)).then(() => {
    if (revision === current) useProjectStore.setState({ saveStatus: 'saved' })
  }).catch(error => {
    if (revision === current) useProjectStore.setState({ saveStatus: 'error', error: String(error instanceof Error ? error.message : error) })
  })
}
export async function flushSaves() {
  await pending
  if (useProjectStore.getState().saveStatus === 'error') throw new Error('Save failed. Export a backup or retry before leaving this drill.')
}
export const useProjectStore = create<BoardState>((set, get) => ({
  project: null, frameIndex: 0, tool: 'select', selected: null, past: [], future: [], saveStatus: 'saved', error: null,
  open: project => set({ project: structuredClone(project), frameIndex: 0, selected: null, past: [], future: [], saveStatus: 'saved', error: null }),
  edit: change => {
    const state = get(); if (!state.project) return
    const project = structuredClone(state.project); change(project); project.updatedAt = Date.now()
    set({ project, past: [...state.past.slice(-49), state.project], future: [] })
    persist(project)
  },
  undo: () => {
    const state = get(); const project = state.past.at(-1); if (!project || !state.project) return
    set({ project, past: state.past.slice(0, -1), future: [state.project, ...state.future], frameIndex: Math.min(state.frameIndex, project.keyframes.length - 1), selected: null }); persist(project)
  },
  redo: () => {
    const state = get(); const project = state.future[0]; if (!project || !state.project) return
    set({ project, past: [...state.past, state.project], future: state.future.slice(1), frameIndex: Math.min(state.frameIndex, project.keyframes.length - 1), selected: null }); persist(project)
  },
  setTool: tool => set({ tool, selected: null }), setSelected: selected => set({ selected }), setFrame: frameIndex => set({ frameIndex, selected: null }),
  retry: () => { const project = get().project; if (project) persist(project) },
}))
