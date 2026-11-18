import { useTranslation } from "../../lib/i18n";
import { useState } from "react";
import { Check, Copy, LogOut, Share2, Users } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useCollaborationStore } from "../../store/collaborationStore";
import { createRoom, leaveRoom, retryRoom } from "../../lib/collaboration";

export function Collaboration() {
  const t = useTranslation();
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
        aria-label={
          state.roomId ? t("Live collaboration") : t("Share live room")
        }
      >
        {state.roomId ? <Users size={15} /> : <Share2 size={15} />}
        <span>
          {state.roomId
            ? `${t(state.status === "connected" ? "Live" : "Room")} · ${Object.keys(state.peers).length + 1}`
            : t("Share")}
        </span>
      </button>
      {open && (
        <Modal
          title={state.roomId ? t("Live room") : t("Collaborate live")}
          onClose={() => setOpen(false)}
        >
          <p>
            {t(
              "Work on the same court together. Everyone with the link can edit the drill and shared settings.",
            )}
          </p>
          <label>
            {t("Your name")}
            <input
              aria-label={t("Your collaboration name")}
              maxLength={40}
              value={state.name}
              onChange={(e) =>
                useCollaborationStore.setState({
                  name: e.target.value || t("Coach"),
                })
              }
            />
          </label>
          {(error || state.error) && (
            <p className="dialog-error" role="alert">
              {t(error || state.error || "")}
            </p>
          )}
          {state.roomId ? (
            <>
              <p className="room-connection" aria-live="polite">
                {state.status === "connected"
                  ? t("{v0} coaches connected", {
                      v0: Object.keys(state.peers).length + 1,
                    })
                  : state.synced
                    ? t(
                        "Waiting for other coaches. Share the link to invite them.",
                      )
                    : t("Looking for a coach with this room open…")}
              </p>
              {state.connectionHint && (
                <p className="muted" aria-live="polite">
                  {t(state.connectionHint)}
                </p>
              )}
              {state.status !== "connected" && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void run(retryRoom)}
                >
                  {t("Retry connection")}
                </button>
              )}
              <label>
                {t("Room link")}
                <input
                  aria-label={t("Room link")}
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
                {copied ? t("Copied") : t("Copy room link")}
              </button>
              <div className="room-members">
                {[
                  {
                    name: t("{v0} (you)", { v0: state.name }),
                    color: state.color,
                  },
                  ...Object.values(state.peers),
                ].map((peer, index) => (
                  <span key={index}>
                    <i style={{ background: peer.color }} />
                    {peer.name}
                  </span>
                ))}
              </div>
              <p className="muted">
                {t(
                  "Keep at least one coach online for new people to join. Each connected browser saves a local copy. An empty room has no online storage; reopen the link on a browser that has joined before.",
                )}
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
                <LogOut size={15} /> {t("Leave room and keep local copy")}
              </button>
            </>
          ) : (
            <>
              <p className="muted">
                {t(
                  "Create a shared copy of this drill, then send its link to your team. Live cursors, movements, drawings, steps, settings, and playback are shared.",
                )}
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
                {busy ? t("Creating room…") : t("Create live room")}
              </button>
            </>
          )}
          <p className="muted room-footnote">
            {t(
              "Direct, encrypted peer connections. Public services help browsers find each other; no account needed. Some school or club networks may block connections.",
            )}
          </p>
        </Modal>
      )}
    </>
  );
}
