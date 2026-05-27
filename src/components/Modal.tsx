import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import "./Modal.css";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Затемнять фон (showModal). По умолчанию — нет. */
  dimBackdrop?: boolean;
  /** Перетаскивание за заголовок */
  draggable?: boolean;
};

type Position = { x: number; y: number };

export function Modal({
  open,
  title,
  onClose,
  children,
  className = "",
  dimBackdrop = false,
  draggable = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [position, setPosition] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setPosition(null);
    }
  }

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (!open) {
      if (dialog.open) {
        dialog.close();
      }
      return;
    }

    if (!dialog.open) {
      if (dimBackdrop) {
        dialog.showModal();
      } else {
        dialog.show();
      }
    }
  }, [open, dimBackdrop]);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const onMove = (e: globalThis.MouseEvent) => {
      const panel = panelRef.current;
      if (!panel) {
        return;
      }

      const rect = panel.getBoundingClientRect();
      const maxX = Math.max(8, window.innerWidth - rect.width - 8);
      const maxY = Math.max(8, window.innerHeight - rect.height - 8);

      setPosition({
        x: Math.min(maxX, Math.max(8, e.clientX - dragOffsetRef.current.x)),
        y: Math.min(maxY, Math.max(8, e.clientY - dragOffsetRef.current.y)),
      });
    };

    const onUp = () => setIsDragging(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  const handleHeaderMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      if (!draggable || e.button !== 0) {
        return;
      }

      const panel = panelRef.current;
      if (!panel) {
        return;
      }

      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      const anchorX = position?.x ?? rect.left;
      const anchorY = position?.y ?? rect.top;

      if (position === null) {
        setPosition({ x: anchorX, y: anchorY });
      }

      dragOffsetRef.current = {
        x: e.clientX - anchorX,
        y: e.clientY - anchorY,
      };
      setIsDragging(true);
    },
    [draggable, position]
  );

  const panelClassName = [
    "app-modal__panel",
    draggable && (position === null ? "app-modal__panel--centered" : "app-modal__panel--placed"),
  ]
    .filter(Boolean)
    .join(" ");

  const panelStyle =
    draggable && position !== null
      ? { left: position.x, top: position.y }
      : undefined;

  return (
    <dialog
      ref={dialogRef}
      className={`app-modal ${dimBackdrop ? "app-modal--dimmed" : "app-modal--floating"} ${className}`.trim()}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (dimBackdrop && e.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className={panelClassName}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className={`app-modal__header ${draggable ? "app-modal__header--draggable" : ""} ${isDragging ? "app-modal__header--dragging" : ""}`}
          onMouseDown={handleHeaderMouseDown}
        >
          <h2>{title}</h2>
        </header>
        <div className="app-modal__body">{children}</div>
      </div>
    </dialog>
  );
}
