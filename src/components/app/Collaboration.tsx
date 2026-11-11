import { useState } from "react";
import { Check, Copy, LogOut, Share2, Users } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useCollaborationStore } from "../../store/collaborationStore";
import { createRoom, leaveRoom } from "../../lib/collaboration";

export function Collaboration() {
  const state = useCollaborationStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className={`button secondary collaboration-button ${state.roomId ? "is-live" : ""}`}
        onClick={() => setOpen(true)}
        aria-label={state.roomId ? "Live collaboration" : "Share live room"}
      >
        {state.roomId ? <Users size={15} /> : <Share2 size={15} />}
        <span>
          {state.roomId
            ? `Live · ${Object.keys(state.peers).length + 1}`
            : "Share"}
        </span>
      </button>
      {open && (
        <Modal
          title={state.roomId ? "Live room" : "Collaborate live"}
          onClose={() => setOpen(false)}
        >
          <p>
            Work on the same court together. Everyone with the link can edit the
            drill and shared settings.
          </p>
          <label>
            Your name
            <input
              aria-label="Your collaboration name"
              maxLength={40}
              value={state.name}
              onChange={(e) =>
                useCollaborationStore.setState({
                  name: e.target.value || "Coach",
                })
              }
            />
          </label>
          {(error || state.error) && (
            <p className="dialog-error" role="alert">
              {error || state.error}
            </p>
          )}
          {state.roomId ? (
            <>
              <p className="room-connection" aria-live="polite">
                {state.status === "connected"
                  ? `${Object.keys(state.peers).length + 1} coaches connected`
                  : state.synced
                    ? "Waiting for other coaches. Share the link to invite them."
                    : "Looking for a coach with this room open…"}
              </p>
              <label>
                Room link
                <input
                  aria-label="Room link"
                  readOnly
                  value={state.link}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <button
                className="button primary"
                onClick={() =>
                  void run(async () => {
                    await navigator.clipboard.writeText(state.link);
                    setCopied(true);
                  })
                }
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Copied" : "Copy room link"}
              </button>
              <div className="room-members">
                {[
                  { name: `${state.name} (you)`, color: state.color },
                  ...Object.values(state.peers),
                ].map((peer, index) => (
                  <span key={index}>
                    <i style={{ background: peer.color }} />
                    {peer.name}
                  </span>
                ))}
              </div>
              <p className="muted">
                Keep at least one coach online for new people to join. Each
                connected browser saves a local copy. An empty room has no
                online storage; reopen the link on a browser that has joined
                before.
              </p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await leaveRoom();
                    setOpen(false);
                  })
                }
              >
                <LogOut size={15} /> Leave room and keep local copy
              </button>
            </>
          ) : (
            <>
              <p className="muted">
                Create a shared copy of this drill, then send its link to your
                team. Live cursors, movements, drawings, steps, settings, and
                playback are shared.
              </p>
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    setCopied(false);
                    await createRoom();
                  })
                }
              >
                <Share2 size={15} />
                {busy ? "Creating room…" : "Create live room"}
              </button>
            </>
          )}
          <p className="muted room-footnote">
            Direct, encrypted peer connections. Public services help browsers
            find each other; no account needed. Some school or club networks may
            block connections.
          </p>
        </Modal>
      )}
    </>
  );
}
