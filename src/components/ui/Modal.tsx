import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  children,
  onClose,
  headingActions,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  headingActions?: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${className}`.trim()}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <div className="modal-heading-actions">
          {headingActions}
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
      </div>
      {children}
    </dialog>
  );
}
