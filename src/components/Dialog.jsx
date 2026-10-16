import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./ui";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Accessible modal dialog: focus trap, Escape to close, focus restored on close. */
export function Dialog({ open, onClose, title, description, children, footer, size, busy }) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const first = panel?.querySelector("[data-autofocus]") || panel?.querySelector(FOCUSABLE);
    first?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busyRef.current) {
        event.stopPropagation();
        onCloseRef.current();
      }
      if (event.key === "Tab" && panel) {
        const items = Array.from(panel.querySelectorAll(FOCUSABLE));
        if (!items.length) return;
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (event.shiftKey && document.activeElement === firstItem) {
          event.preventDefault();
          lastItem.focus();
        } else if (!event.shiftKey && document.activeElement === lastItem) {
          event.preventDefault();
          firstItem.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`dialog ${size === "lg" ? "dialog--lg" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div className="dialog__header">
          <div>
            <h2 className="dialog__title" id={titleId}>
              {title}
            </h2>
            {description && (
              <p className="dialog__description" id={descriptionId}>
                {description}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" iconOnly icon={X} onClick={onClose} disabled={busy}>
            Close
          </Button>
        </div>
        {children && <div className="dialog__body">{children}</div>}
        {footer && <div className="dialog__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Confirmation dialog. `onConfirm` may be async (receives the checkbox value
 * when `checkboxLabel` is given); the dialog stays open and shows progress
 * until it resolves.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "primary",
  checkboxLabel,
  checkboxDefault = true,
  children,
}) {
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(checkboxDefault);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(checked);
      onClose();
    } catch {
      // The caller reports the error (toast); keep the dialog open to retry.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      busy={busy}
      footer={
        <>
          {/* Destructive actions focus Cancel first so Enter can't delete by accident. */}
          <Button onClick={onClose} disabled={busy} data-autofocus={tone === "danger" || undefined}>
            Cancel
          </Button>
          <Button variant={tone} onClick={confirm} loading={busy} data-autofocus={tone !== "danger" || undefined}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {(children || checkboxLabel) && (
        <div className="stack">
          {children}
          {checkboxLabel && (
            <label className="checkbox">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} disabled={busy} />
              <span>{checkboxLabel}</span>
            </label>
          )}
        </div>
      )}
    </Dialog>
  );
}
