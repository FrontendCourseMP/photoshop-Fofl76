import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThrottledCallback } from "../hooks/useThrottledCallback";
import { DialogApplyOverlay } from "./DialogApplyOverlay";
import { Modal } from "./Modal";
import "./KernelsDialog.css";
import type { ActiveChannels } from "../core/image/types";
import type {
  EdgeHandlingWire,
  KernelFilterStateWire,
  KernelFilterTypeWire,
} from "../core/image/processing/kernelsPixels";

type KernelPresetId =
  | "custom"
  | "identity"
  | "sharpen"
  | "gaussian3"
  | "boxBlur"
  | "prewittX"
  | "prewittY"
  | "median3";

const CUSTOM_PRESET_LABEL = "Пользовательский вариант";

type KernelChannelKey = keyof ActiveChannels | "grayscale";

type KernelsDialogProps = {
  open: boolean;
  hasAlpha: boolean;
  isGb7Image?: boolean;
  onApply: (state: KernelFilterStateWire) => void | Promise<void>;
  onCancel: () => void;
  onPreviewChange: (state: KernelFilterStateWire, preview: boolean) => void;
};

const DEFAULT_KERNEL: KernelFilterStateWire["kernel3x3"] = [
  0, 0, 0,
  0, 1, 0,
  0, 0, 0,
];

const PRESETS: Array<{
  id: KernelPresetId;
  label: string;
  filterType: KernelFilterTypeWire;
  kernel3x3: KernelFilterStateWire["kernel3x3"];
}> = [
  {
    id: "identity",
    label: "Тождественное отображение",
    filterType: "kernel",
    kernel3x3: [
      0, 0, 0,
      0, 1, 0,
      0, 0, 0,
    ],
  },
  {
    id: "sharpen",
    label: "Повышение резкости",
    filterType: "kernel",
    kernel3x3: [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0,
    ],
  },
  {
    id: "gaussian3",
    label: "Фильтр Гаусса (3×3)",
    filterType: "kernel",
    kernel3x3: [
      1, 2, 1,
      2, 4, 2,
      1, 2, 1,
    ],
  },
  {
    id: "boxBlur",
    label: "Прямоугольное размытие",
    filterType: "kernel",
    kernel3x3: [
      1, 1, 1,
      1, 1, 1,
      1, 1, 1,
    ],
  },
  {
    id: "prewittX",
    label: "Оператор Прюитта (X)",
    filterType: "kernel",
    kernel3x3: [
      -1, 0, 1,
      -1, 0, 1,
      -1, 0, 1,
    ],
  },
  {
    id: "prewittY",
    label: "Оператор Прюитта (Y)",
    filterType: "kernel",
    kernel3x3: [
      1, 1, 1,
      0, 0, 0,
      -1, -1, -1,
    ],
  },
  {
    id: "median3",
    label: "Медианный фильтр (3×3)",
    filterType: "median",
    kernel3x3: DEFAULT_KERNEL,
  },
];

function createDefaultState(hasAlpha: boolean): KernelFilterStateWire {
  return {
    filterType: "kernel",
    kernel3x3: DEFAULT_KERNEL,
    channels: {
      red: true,
      green: true,
      blue: true,
      alpha: hasAlpha,
    },
    edgeHandling: "copy",
  };
}

function parseNumberOr(prev: number, raw: string): number {
  const cleaned = raw.replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : prev;
}

function kernelsMatch(
  a: KernelFilterStateWire["kernel3x3"],
  b: KernelFilterStateWire["kernel3x3"]
): boolean {
  return a.every((v, i) => v === b[i]);
}

function findMatchingPresetId(
  filterType: KernelFilterTypeWire,
  kernel3x3: KernelFilterStateWire["kernel3x3"]
): KernelPresetId | "custom" {
  const match = PRESETS.find(
    (p) => p.filterType === filterType && kernelsMatch(p.kernel3x3, kernel3x3)
  );
  return match?.id ?? "custom";
}

export function KernelsDialog({
  open,
  hasAlpha,
  isGb7Image = false,
  onApply,
  onCancel,
  onPreviewChange,
}: KernelsDialogProps) {
  const stateRef = useRef<KernelFilterStateWire>(createDefaultState(hasAlpha));
  const previewEnabledRef = useRef(true);

  const [state, setState] = useState<KernelFilterStateWire>(() =>
    createDefaultState(hasAlpha)
  );
  const [presetId, setPresetId] = useState<KernelPresetId>("identity");
  const [preview, setPreview] = useState(true);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    stateRef.current = state;
    previewEnabledRef.current = preview;
  }, [state, preview]);

  const { throttled: schedulePreview, flush: flushPreview } =
    useThrottledCallback(
      (next: KernelFilterStateWire, previewOn: boolean) => {
        onPreviewChange(next, previewOn);
      },
      140
    );

  const emitPreviewNow = useCallback(() => {
    onPreviewChange(stateRef.current, previewEnabledRef.current);
  }, [onPreviewChange]);

  useEffect(() => {
    if (!open) return;
    emitPreviewNow();
  }, [open, emitPreviewNow]);

  useEffect(() => {
    if (!open) return;
    schedulePreview(state, preview);
  }, [open, state, preview, schedulePreview]);

  const channelOptions = useMemo(() => {
    if (isGb7Image) {
      const items: Array<{ key: KernelChannelKey; label: string }> = [
        { key: "grayscale", label: "Grayscale" },
      ];
      if (hasAlpha) {
        items.push({ key: "alpha", label: "Mask" });
      }
      return items;
    }

    const items: Array<{ key: KernelChannelKey; label: string }> = [
      { key: "red", label: "R" },
      { key: "green", label: "G" },
      { key: "blue", label: "B" },
    ];
    if (hasAlpha) {
      items.push({ key: "alpha", label: "A" });
    }
    return items;
  }, [hasAlpha, isGb7Image]);

  const isChannelChecked = (key: KernelChannelKey): boolean => {
    if (key === "grayscale") {
      return (
        state.channels.red &&
        state.channels.green &&
        state.channels.blue
      );
    }
    return state.channels[key];
  };

  const handlePreviewToggle = (checked: boolean) => {
    setPreview(checked);
    flushPreview();
    onPreviewChange(stateRef.current, checked);
  };

  const applyPreset = (id: KernelPresetId) => {
    if (id === "custom") {
      setPresetId("custom");
      return;
    }
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setState((prev) => ({
      ...prev,
      filterType: preset.filterType,
      kernel3x3: preset.kernel3x3,
    }));
  };

  const handleKernelCellChange = (index: number, raw: string) => {
    const prev = stateRef.current;
    const nextKernel = [...prev.kernel3x3] as KernelFilterStateWire["kernel3x3"];
    nextKernel[index] = parseNumberOr(nextKernel[index], raw);
    const next = { ...prev, kernel3x3: nextKernel };
    stateRef.current = next;
    setPresetId(findMatchingPresetId(prev.filterType, nextKernel));
    setState(next);
  };

  const handleChannelToggle = (ch: KernelChannelKey) => {
    if (ch === "grayscale") {
      setState((prev) => {
        const enabled =
          prev.channels.red &&
          prev.channels.green &&
          prev.channels.blue;
        const next = !enabled;
        return {
          ...prev,
          channels: {
            ...prev.channels,
            red: next,
            green: next,
            blue: next,
          },
        };
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      channels: { ...prev.channels, [ch]: !prev.channels[ch] },
    }));
  };

  const handleReset = () => {
    const next = createDefaultState(hasAlpha);
    setPresetId("identity");
    setState(next);
    stateRef.current = next;
    flushPreview();
    onPreviewChange(next, previewEnabledRef.current);
  };

  const handleApply = async () => {
    if (isApplying) return;
    setIsApplying(true);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    try {
      await onApply(state);
    } finally {
      setIsApplying(false);
    }
  };

  const handleCancel = () => {
    if (isApplying) return;
    onCancel();
  };

  const paddingOptions: Array<{ id: EdgeHandlingWire; label: string }> = [
    { id: "copy", label: "Копирование (replicate)" },
    { id: "black", label: "Чёрный" },
    { id: "white", label: "Белый" },
  ];

  return (
    <Modal
      open={open}
      title="Фильтры (Kernel)"
      onClose={isApplying ? () => undefined : handleCancel}
      draggable
      className="kernels-dialog"
    >
      <div
        className={`kernels-dialog__panel ${
          isApplying ? "kernels-dialog__panel--busy" : ""
        }`}
      >
        {isApplying && <DialogApplyOverlay message="Применение фильтра…" />}

        <div className="kernels-dialog__row">
          <label className="kernels-dialog__field">
            Пресет:
            <select
              value={presetId}
              disabled={isApplying}
              onChange={(e) => applyPreset(e.target.value as KernelPresetId)}
            >
              <option value="custom">{CUSTOM_PRESET_LABEL}</option>
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="kernels-dialog__field">
            Края:
            <select
              value={state.edgeHandling}
              disabled={isApplying}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  edgeHandling: e.target.value as EdgeHandlingWire,
                }))
              }
            >
              {paddingOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="kernels-dialog__checkbox">
            <input
              type="checkbox"
              checked={preview}
              disabled={isApplying}
              onChange={(e) => handlePreviewToggle(e.target.checked)}
            />
            Предпросмотр
          </label>
        </div>

        <div className="kernels-dialog__row">
          <div className="kernels-dialog__channels">
            {channelOptions.map((c) => (
              <label key={c.key} className="kernels-dialog__checkbox">
                <input
                  type="checkbox"
                  checked={isChannelChecked(c.key)}
                  disabled={isApplying}
                  onChange={() => handleChannelToggle(c.key)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="kernels-dialog__matrix" aria-label="Kernel 3x3">
          {state.kernel3x3.map((v, idx) => (
            <input
              key={idx}
              type="text"
              inputMode="decimal"
              disabled={isApplying || state.filterType === "median"}
              value={Number.isFinite(v) ? String(v) : "0"}
              onChange={(e) => handleKernelCellChange(idx, e.target.value)}
            />
          ))}
        </div>

        <div className="kernels-dialog__actions">
          <button
            type="button"
            className="kernels-dialog__btn kernels-dialog__btn--secondary"
            onClick={handleReset}
            disabled={isApplying}
          >
            Сброс
          </button>

          <div className="kernels-dialog__actions-right">
            <button
              type="button"
              className="kernels-dialog__btn kernels-dialog__btn--secondary"
              onClick={handleCancel}
              disabled={isApplying}
            >
              Закрыть
            </button>
            <button
              type="button"
              className="kernels-dialog__btn kernels-dialog__btn--primary"
              onClick={() => void handleApply()}
              disabled={isApplying}
            >
              {isApplying ? "Применение…" : "Применить"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

