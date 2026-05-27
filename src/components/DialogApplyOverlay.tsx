import "./DialogApplyOverlay.css";

type DialogApplyOverlayProps = {
  message?: string;
};

export function DialogApplyOverlay({
  message = "Применение…",
}: DialogApplyOverlayProps) {
  return (
    <div
      className="dialog-apply-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="dialog-apply-overlay__spinner" />
      <span>{message}</span>
    </div>
  );
}
