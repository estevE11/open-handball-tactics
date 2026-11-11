import * as Y from "yjs";
import { z } from "zod";
import type { Room } from "@trystero-p2p/mqtt";
import { liveQuery } from "dexie";
import { db } from "./browserStorage";
import { patchShared, readShared } from "./sharedDocument";
import {
  flushSaves,
  setSharedHistory,
  useProjectStore,
} from "../store/projectStore";
import { usePreferencesStore } from "../store/preferencesStore";
import {
  useCollaborationStore,
  type LivePresence,
} from "../store/collaborationStore";
import {
  courtConfigSchema,
  projectSchema,
  tokenSchema,
  arrowSchema,
  drawingSchema,
} from "../types/project";

const point = z.object({ x: z.number().finite(), y: z.number().finite() });
const drawing = z.object({
  color: z.string().regex(/^#[\da-fA-F]{6}$/),
  width: z.number().min(1).max(12),
  opacity: z.number().min(0.1).max(1),
  smoothing: z.number().min(0).max(1),
  penOnly: z.boolean(),
});
const snapshotSchema = z.object({
  project: projectSchema,
  settings: z.object({
    courtDefaults: courtConfigSchema,
    theme: z.enum(["light", "dark", "system"]),
    drawing,
    voronoi: z.boolean(),
    onion: z.boolean(),
    activePane: z.enum(["editor", "animation"]),
    frameId: z.string(),
    playback: z.object({
      time: z.number().nonnegative().nullable(),
      playing: z.boolean(),
      at: z.number(),
    }),
  }),
});
type SharedSnapshot = z.infer<typeof snapshotSchema>;
const presenceSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[\da-fA-F]{6}$/),
  frameId: z.string(),
  cursor: point.nullable(),
  tokens: z.array(tokenSchema).max(500).optional(),
  arrow: arrowSchema.optional(),
  stroke: drawingSchema.optional(),
  erased: z.array(z.string()).max(500).optional(),
});
const uuid =
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
export function roomFromHash(hash = window.location.hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const id = params.get("room"),
    key = params.get("key");
  return id && key && uuid.test(id) && uuid.test(key) ? { id, key } : null;
}
let session: {
  leave: () => Promise<void>;
  presence: (data: Partial<LivePresence>, force?: boolean) => void;
} | null = null;
let sessionGeneration = 0;
export function publishPresence(data: Partial<LivePresence>, force = false) {
  session?.presence(data, force);
}

function capture(
  previous?: SharedSnapshot,
  previousBoard?: ReturnType<typeof useProjectStore.getState>,
): SharedSnapshot {
  const board = useProjectStore.getState();
  const preferences = usePreferencesStore.getState();
  const ui = useCollaborationStore.getState();
  // Animation frames run locally on each peer; only playback commands enter the document.
  const command =
    !previousBoard ||
    board.playing !== previousBoard.playing ||
    !board.playing ||
    (board.playbackTime ?? 0) < (previousBoard.playbackTime ?? 0);
  return {
    project: { ...board.project!, folderId: null },
    settings: {
      courtDefaults: preferences.courtDefaults,
      theme: preferences.theme,
      drawing: board.drawing,
      voronoi: board.voronoi,
      onion: ui.onion,
      activePane: ui.activePane,
      frameId:
        board.project!.keyframes[board.frameIndex]?.id ??
        board.project!.keyframes[0].id,
      playback: command
        ? { time: board.playbackTime, playing: board.playing, at: Date.now() }
        : previous!.settings.playback,
    },
  };
}

export async function createRoom() {
  await flushSaves();
  const project = useProjectStore.getState().project;
  if (!project) return;
  const credentials = { id: crypto.randomUUID(), key: crypto.randomUUID() };
  // A room owns a copy, so the original local drill and folder stay intact.
  useProjectStore.getState().receive({
    ...structuredClone(project),
    id: credentials.id,
    folderId: null,
  });
  await connectRoom(credentials, true);
}

export async function leaveRoom() {
  ++sessionGeneration;
  const leaving = session;
  const { roomId, synced } = useCollaborationStore.getState();
  session = null;
  const cleanup = leaving?.leave();
  setSharedHistory(null);
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  useCollaborationStore.setState({
    roomId: null,
    link: "",
    status: "local",
    synced: false,
    error: null,
    connectionHint: null,
    peers: {},
    canUndo: false,
    canRedo: false,
  });
  const project = useProjectStore.getState().project;
  if (synced && project?.id === roomId) {
    // Work done after leaving must survive a later rejoin to the shared copy.
    useProjectStore
      .getState()
      .receive({ ...structuredClone(project), id: crypto.randomUUID() });
  }
  useProjectStore.setState({ past: [], future: [] });
  await cleanup;
}

export async function retryRoom() {
  const credentials = roomFromHash();
  if (!credentials) return;
  const generation = ++sessionGeneration;
  const previous = session;
  session = null;
  setSharedHistory(null);
  useCollaborationStore.setState({
    status: "connecting",
    error: null,
    connectionHint: null,
    peers: {},
  });
  await previous?.leave();
  if (generation === sessionGeneration) await connectRoom(credentials);
}

export async function connectRoom(
  credentials: { id: string; key: string },
  seed = false,
) {
  if (session) await leaveRoom();
  const generation = ++sessionGeneration;
  if (!globalThis.RTCPeerConnection)
    throw new Error("This browser does not support peer-to-peer rooms.");
  const doc = new Y.Doc();
  const root = doc.getMap<string>("workspace-v1");
  const local = Symbol("local");
  const cached = await db.rooms.get(credentials.id);
  if (generation !== sessionGeneration) {
    doc.destroy();
    return;
  }
  if (cached) Y.applyUpdate(doc, cached.update);
  else if (seed) patchShared(root, undefined, capture(), "seed");
  let shared = snapshotSchema.safeParse(readShared(root)).data;
  let applying = false,
    closed = false;
  let room: Room;
  let cacheWrite = Promise.resolve();
  const link = `${location.origin}${location.pathname}${location.search}#room=${credentials.id}&key=${credentials.key}`;
  history.replaceState(null, "", link);
  useCollaborationStore.setState({
    roomId: credentials.id,
    link,
    status: "connecting",
    synced: !!shared,
    error: null,
    connectionHint: null,
    peers: {},
  });
  const fail = (error: unknown) => {
    if (!closed)
      useCollaborationStore.setState({
        error: error instanceof Error ? error.message : String(error),
      });
  };
  let discoverySockets: () => Record<string, WebSocket>;
  try {
    const { joinRoom, getRelaySockets } = await import("@trystero-p2p/mqtt");
    discoverySockets = getRelaySockets;
    if (generation !== sessionGeneration) {
      doc.destroy();
      return;
    }
    room = joinRoom(
      {
        appId: "open-handball-tactics-v1",
        password: credentials.key,
        maxReceiveBytes: 16 * 1024 * 1024,
        // Independent public MQTT brokers, without Nostr's timestamp filters or
        // ephemeral-event restrictions. Discovery carries encrypted SDP only.
        relayConfig: {
          urls: [
            "wss://broker.emqx.io:8084/mqtt",
            "wss://public:public@public.cloud.shiftr.io",
            "wss://broker.hivemq.com:8884/mqtt",
            "wss://test.mosquitto.org:8081/mqtt",
          ],
        },
      },
      credentials.id,
      {
        onJoinError: ({ error }) =>
          fail(
            new Error(
              /exchanging SDP/.test(error)
                ? "The browsers found each other, but could not connect directly. Retry the connection; this network may block peer-to-peer traffic."
                : /password/.test(error)
                  ? "The room link could not be verified. Ask the other coach for the complete link."
                  : "A peer could not finish connecting. Retry the connection and make sure both browsers have updated the app.",
            ),
          ),
      },
    );
  } catch (error) {
    doc.destroy();
    useCollaborationStore.setState({
      status: "waiting",
      error:
        "Could not start the connection. Check your internet connection and retry.",
    });
    throw error;
  }
  const updates = room.makeAction<Uint8Array>("doc-v1");
  const sync = room.makeAction<Uint8Array>("sync-v1");
  const presence = room.makeAction<string>("presence-v1");
  const assetRequests = room.makeAction<string>("asset-ask");
  const assets = room.makeAction<Uint8Array>("asset-data");
  const peers = new Set<string>();
  const lastSeen = new Map<string, number>();
  const requested = new Map<string, number>();
  let localPresence: LivePresence = {
    name: useCollaborationStore.getState().name,
    color: useCollaborationStore.getState().color,
    cursor: null,
    frameId: "",
  };
  let lastPresence = 0;
  let presenceTimer: ReturnType<typeof setTimeout> | undefined;
  function sendPresence(data: Partial<LivePresence>, force = false) {
    localPresence = {
      ...localPresence,
      ...data,
      name: useCollaborationStore.getState().name,
      frameId:
        useProjectStore.getState().project?.keyframes[
          useProjectStore.getState().frameIndex
        ]?.id ?? "",
    };
    if (!force && performance.now() - lastPresence < 33) {
      presenceTimer ??= setTimeout(() => {
        presenceTimer = undefined;
        sendPresence({}, true);
      }, 33);
      return;
    }
    clearTimeout(presenceTimer);
    presenceTimer = undefined;
    lastPresence = performance.now();
    if (peers.size)
      void presence.send(JSON.stringify(localPresence)).catch(fail);
  }
  async function requestAssets() {
    if (!shared || !peers.size || closed) return;
    const ids: string[] = [];
    for (const asset of shared.project.customAssets) {
      if (Date.now() - (requested.get(asset.id) ?? 0) < 10000) continue;
      if (!(await db.assets.get(asset.id))) {
        ids.push(asset.id);
        requested.set(asset.id, Date.now());
      }
    }
    if (ids.length && !closed) await assetRequests.send(JSON.stringify(ids));
  }
  function applySnapshot(next: SharedSnapshot, previous?: SharedSnapshot) {
    applying = true;
    try {
      const board = useProjectStore.getState();
      if (JSON.stringify(board.project) !== JSON.stringify(next.project))
        board.receive(next.project);
      const frameIndex = Math.max(
        0,
        next.project.keyframes.findIndex(
          (frame) => frame.id === next.settings.frameId,
        ),
      );
      useProjectStore.setState({
        frameIndex,
        drawing: next.settings.drawing,
        voronoi: next.settings.voronoi,
      });
      if (
        !previous ||
        JSON.stringify(previous.settings.playback) !==
          JSON.stringify(next.settings.playback)
      ) {
        const { time, playing, at } = next.settings.playback;
        if (time === null)
          useProjectStore.setState({ playbackTime: null, playing: false });
        else
          board.setPlayback(
            time + (playing ? Math.max(0, Date.now() - at) : 0),
            playing,
          );
      }
      usePreferencesStore.setState({
        courtDefaults: next.settings.courtDefaults,
        theme: next.settings.theme,
      });
      useCollaborationStore.setState({
        onion: next.settings.onion,
        activePane: next.settings.activePane,
        synced: true,
      });
    } finally {
      applying = false;
    }
    void requestAssets().catch(fail);
  }
  if (shared) applySnapshot(shared);
  const undo = new Y.UndoManager(root, {
    trackedOrigins: new Set([local]),
    captureTimeout: 350,
  });
  function historyState() {
    useCollaborationStore.setState({
      canUndo: undo.canUndo(),
      canRedo: undo.canRedo(),
    });
  }
  setSharedHistory({
    undo: () => {
      undo.undo();
      historyState();
    },
    redo: () => {
      undo.redo();
      historyState();
    },
  });
  root.observe(() => {
    const parsed = snapshotSchema.safeParse(readShared(root));
    if (!parsed.success) return;
    const previous = shared;
    shared = parsed.data;
    if (!applying) applySnapshot(shared, previous);
    historyState();
  });
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    const snapshot = Y.encodeStateAsUpdate(doc);
    cacheWrite = cacheWrite
      .then(async () => {
        await db.rooms.put({ id: credentials.id, update: snapshot });
      })
      .catch(fail);
    if (origin !== "remote" && peers.size)
      void updates.send(update).catch(fail);
  });
  function receiveUpdate(update: Uint8Array) {
    if (closed) return;
    try {
      // Validate the resulting document before it can replace local work.
      const candidate = new Y.Doc();
      try {
        Y.applyUpdate(candidate, Y.encodeStateAsUpdate(doc));
        Y.applyUpdate(candidate, update);
        snapshotSchema.parse(readShared(candidate.getMap("workspace-v1")));
      } finally {
        candidate.destroy();
      }
      Y.applyUpdate(doc, update, "remote");
      useCollaborationStore.setState({ error: null });
    } catch {
      fail(
        new Error(
          "Received an incompatible room update. Refresh to reconnect.",
        ),
      );
    }
  }
  updates.onMessage = receiveUpdate;
  sync.onMessage = (vector, { peerId }) => {
    if (closed) return;
    void updates
      .send(Y.encodeStateAsUpdate(doc, vector), { target: peerId })
      .catch(fail);
  };
  presence.onMessage = (message, { peerId }) => {
    if (closed) return;
    const parsed = presenceSchema.safeParse(
      (() => {
        try {
          return JSON.parse(message);
        } catch {
          return null;
        }
      })(),
    );
    if (!parsed.success) return;
    lastSeen.set(peerId, Date.now());
    useCollaborationStore.setState((state) => ({
      peers: { ...state.peers, [peerId]: parsed.data },
    }));
  };
  assetRequests.onMessage = async (message, { peerId }) => {
    const parsed = z
      .array(z.string())
      .max(500)
      .safeParse(
        (() => {
          try {
            return JSON.parse(message);
          } catch {
            return null;
          }
        })(),
      );
    if (!parsed.success) return;
    try {
      for (const id of parsed.data) {
        if (!shared?.project.customAssets.some((asset) => asset.id === id))
          continue;
        const asset = await db.assets.get(id);
        if (asset && !closed)
          await assets.send(new Uint8Array(await asset.blob.arrayBuffer()), {
            target: peerId,
            metadata: { id, name: asset.name, type: asset.blob.type },
          });
      }
    } catch (error) {
      fail(error);
    }
  };
  assets.onReceive = ({ byteLength }) => byteLength <= 10 * 1024 * 1024;
  assets.onMessage = async (bytes, { metadata }) => {
    const parsed = z
      .object({
        id: z.string(),
        name: z.string().max(255),
        type: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
      })
      .safeParse(metadata);
    if (
      !parsed.success ||
      !shared?.project.customAssets.some((a) => a.id === parsed.data.id)
    )
      return;
    try {
      await db.assets.put({
        id: parsed.data.id,
        name: parsed.data.name,
        blob: new Blob([new Uint8Array(bytes)], { type: parsed.data.type }),
        createdAt: Date.now(),
      });
      requested.delete(parsed.data.id);
    } catch (error) {
      fail(error);
    }
  };
  room.onPeerJoin = (id) => {
    if (closed) return;
    peers.add(id);
    useCollaborationStore.setState({
      status: "connected",
      error: null,
      connectionHint: null,
    });
    void sync.send(Y.encodeStateVector(doc), { target: id }).catch(fail);
    sendPresence({}, true);
    void requestAssets().catch(fail);
  };
  room.onPeerLeave = (id) => {
    if (closed) return;
    peers.delete(id);
    lastSeen.delete(id);
    useCollaborationStore.setState((state) => ({
      status: peers.size ? "connected" : "waiting",
      peers: Object.fromEntries(
        Object.entries(state.peers).filter(([key]) => key !== id),
      ),
    }));
  };
  function publish(
    previousBoard?: ReturnType<typeof useProjectStore.getState>,
  ) {
    if (applying || !shared || !useProjectStore.getState().project) return;
    const next = capture(shared, previousBoard);
    // Unrelated library operations leave the room rather than replacing everyone's drill.
    if (next.project.id !== credentials.id) {
      void leaveRoom();
      return;
    }
    // Keep the playback timestamp stable for non-playback edits.
    if (
      previousBoard &&
      previousBoard.playbackTime === useProjectStore.getState().playbackTime &&
      previousBoard.playing === useProjectStore.getState().playing
    )
      next.settings.playback = shared.settings.playback;
    else if (!previousBoard) next.settings.playback = shared.settings.playback;
    applying = true;
    try {
      patchShared(root, shared, next, local);
    } finally {
      applying = false;
    }
    historyState();
  }
  const subscriptions = [
    useProjectStore.subscribe((state, previous) => {
      if (
        state.project === previous.project &&
        state.frameIndex === previous.frameIndex &&
        state.drawing === previous.drawing &&
        state.voronoi === previous.voronoi &&
        state.playing === previous.playing &&
        (state.playbackTime === previous.playbackTime ||
          (state.playing &&
            (state.playbackTime ?? 0) >= (previous.playbackTime ?? 0)))
      )
        return;
      publish(previous);
    }),
    usePreferencesStore.subscribe(() => publish()),
    useCollaborationStore.subscribe((state, previous) => {
      if (
        state.onion !== previous.onion ||
        state.activePane !== previous.activePane
      )
        publish();
      if (state.name !== previous.name) sendPresence({}, true);
    }),
  ];
  const assetSubscription = liveQuery(() => db.assets.count()).subscribe(() => {
    requested.clear();
    void requestAssets().catch(fail);
  });
  const started = performance.now();
  const heartbeat = setInterval(() => {
    if (!peers.size && performance.now() - started >= 15000) {
      const reachable = Object.values(discoverySockets()).some(
        (socket) => socket.readyState === WebSocket.OPEN,
      );
      useCollaborationStore.setState({
        connectionHint: reachable
          ? "Still waiting for another coach. Keep the link open in both browsers and accept any app update, then retry the connection."
          : "Peer discovery services could not be reached. Check your internet connection and retry.",
      });
    }
    sendPresence({}, true);
    for (const [id, time] of lastSeen)
      if (Date.now() - time > 15000) {
        useCollaborationStore.setState((state) => ({
          peers: {
            ...state.peers,
            [id]: {
              ...state.peers[id],
              cursor: null,
              tokens: undefined,
              arrow: undefined,
              stroke: undefined,
              erased: undefined,
            },
          },
        }));
      }
    void requestAssets().catch(fail);
    for (const peerId of peers)
      void sync.send(Y.encodeStateVector(doc), { target: peerId }).catch(fail);
  }, 5000);
  session = {
    presence: sendPresence,
    leave: async () => {
      closed = true;
      clearTimeout(presenceTimer);
      clearInterval(heartbeat);
      subscriptions.forEach((unsubscribe) => unsubscribe());
      assetSubscription.unsubscribe();
      try {
        await cacheWrite;
        await room.leave();
      } finally {
        undo.destroy();
        doc.destroy();
      }
    },
  };
  // Cache the seed too, allowing the creator to reload or close and return.
  cacheWrite = cacheWrite
    .then(async () => {
      await db.rooms.put({
        id: credentials.id,
        update: Y.encodeStateAsUpdate(doc),
      });
    })
    .catch(fail);
  await cacheWrite;
  if (!closed)
    useCollaborationStore.setState({
      status: peers.size ? "connected" : "waiting",
    });
}
