import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useThrottledCallback } from "../hooks/useThrottledCallback";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import type { ImageModel } from "../core/image/ImageModel";
import {
  computeHistogram,
  type HistogramChannel,
} from "../core/image/Histogram";
import {
  clampChannelParams,
  createDefaultLevelsState,
  midtoneToGamma,
  type LevelsChannelParams,
  type LevelsState,
  type LevelsTarget,
} from "../core/image/Levels";
import { DialogApplyOverlay } from "./DialogApplyOverlay";
import { Modal } from "./Modal";
import "./LevelsDialog.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  BarElement,
  Tooltip
);

type LevelsDialogProps = {
  open: boolean;
  sourceImage: ImageModel;
  hasAlpha: boolean;
  onApply: (state: LevelsState) => void | Promise<void>;
  onCancel: () => void;
  onPreviewChange: (
    state: LevelsState,
    preview: boolean
  ) => void;
};

type HandleKind = "black" | "white" | "midtone";

const CHANNEL_OPTIONS: {
  value: LevelsTarget;
  label: string;
}[] = [
  { value: "master", label: "RGB (Master)" },
  { value: "red", label: "Красный" },
  { value: "green", label: "Зелёный" },
  { value: "blue", label: "Синий" },
  { value: "alpha", label: "Alpha" },
];

function targetToHistogramChannel(
  target: LevelsTarget
): HistogramChannel {
  return target === "master" ? "master" : target;
}

export function LevelsDialog({
  open,
  sourceImage,
  hasAlpha,
  onApply,
  onCancel,
  onPreviewChange,
}: LevelsDialogProps) {
  const isGb7Image = sourceImage.meta.format === "gb7";
  const sliderTrackRef =
    useRef<HTMLDivElement>(null);
  const levelsStateRef = useRef<LevelsState>(
    createDefaultLevelsState()
  );
  const previewEnabledRef = useRef(true);
  const dragTargetRef = useRef<LevelsTarget | null>(null);

  const [levelsState, setLevelsState] =
    useState<LevelsState>(createDefaultLevelsState);
  const [activeTarget, setActiveTarget] =
    useState<LevelsTarget>("master");
  const [logScale, setLogScale] =
    useState(false);
  const [preview, setPreview] =
    useState(true);
  const [dragging, setDragging] =
    useState<HandleKind | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const channelOptions = useMemo(() => {
    if (isGb7Image) {
      const options: { value: LevelsTarget; label: string }[] = [
        { value: "master", label: "Grayscale" },
      ];
      if (hasAlpha) {
        options.push({ value: "alpha", label: "Mask" });
      }
      return options;
    }

    return CHANNEL_OPTIONS.filter(
      (o) => o.value !== "alpha" || hasAlpha
    );
  }, [hasAlpha, isGb7Image]);

  const effectiveTarget = channelOptions.some(
    (option) => option.value === activeTarget
  )
    ? activeTarget
    : (channelOptions[0]?.value ?? "master");

  const activeParams =
    levelsState[effectiveTarget];

  useEffect(() => {
    levelsStateRef.current = levelsState;
    previewEnabledRef.current = preview;
  }, [levelsState, preview]);

  const { throttled: schedulePreview, flush: flushPreview } =
    useThrottledCallback(
      (state: LevelsState, previewOn: boolean) => {
        onPreviewChange(state, previewOn);
      },
      120
    );

  const emitPreviewNow = useCallback(() => {
    onPreviewChange(
      levelsStateRef.current,
      previewEnabledRef.current
    );
  }, [onPreviewChange]);

  useEffect(() => {
    if (!open) {
      return;
    }
    emitPreviewNow();
  }, [open, emitPreviewNow]);

  useEffect(() => {
    if (!open || dragging !== null) {
      return;
    }
    schedulePreview(levelsState, preview);
  }, [
    open,
    levelsState,
    preview,
    dragging,
    schedulePreview,
  ]);

  const histogram = useMemo(() => {
    return computeHistogram(
      sourceImage,
      targetToHistogramChannel(effectiveTarget)
    );
  }, [sourceImage, effectiveTarget]);

  const chartData = useMemo(() => {
    const labels = Array.from(
      { length: 256 },
      (_, i) => String(i)
    );
    return {
      labels,
      datasets: [
        {
          label: "Пиксели",
          data: histogram.bins,
          backgroundColor:
            effectiveTarget === "red"
              ? "rgba(255, 80, 80, 0.75)"
              : effectiveTarget === "green"
                ? "rgba(80, 220, 120, 0.75)"
                : effectiveTarget === "blue"
                  ? "rgba(80, 140, 255, 0.75)"
                  : effectiveTarget === "alpha"
                    ? "rgba(200, 200, 200, 0.75)"
                    : "rgba(180, 180, 180, 0.75)",
          borderWidth: 0,
          barPercentage: 1,
          categoryPercentage: 1,
        },
      ],
    };
  }, [histogram.bins, effectiveTarget]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          display: false,
          min: 0,
          max: 255,
        },
        y: {
          type: (logScale
            ? "logarithmic"
            : "linear") as "logarithmic" | "linear",
          min: logScale ? 1 : 0,
          display: false,
          grid: { display: false },
        },
      },
    }),
    [logScale]
  );

  const updateChannelParams = useCallback(
    (
      target: LevelsTarget,
      patch: Partial<LevelsChannelParams>,
      changed: HandleKind
    ) => {
      setLevelsState((prev) => {
        const current = {
          ...prev[target],
          ...patch,
        };
        const clamped = clampChannelParams(
          current,
          changed === "midtone"
            ? "midtone"
            : changed
        );

        return {
          ...prev,
          [target]: clamped,
        };
      });
    },
    []
  );

  const handlePreviewToggle = (
    checked: boolean
  ) => {
    setPreview(checked);
    flushPreview();
    onPreviewChange(levelsStateRef.current, checked);
  };

  const handleReset = () => {
    const next = createDefaultLevelsState();
    setLevelsState(next);
    levelsStateRef.current = next;
    flushPreview();
    onPreviewChange(next, previewEnabledRef.current);
  };

  const handleApply = async () => {
    if (isApplying) {
      return;
    }

    setIsApplying(true);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    try {
      await onApply(levelsState);
    } finally {
      setIsApplying(false);
    }
  };

  const handleCancel = () => {
    if (isApplying) {
      return;
    }
    onCancel();
  };

  const valueFromClientX = (
    clientX: number
  ): number => {
    const track = sliderTrackRef.current;
    if (!track) {
      return 0;
    }
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (clientX - rect.left) / rect.width)
    );
    return Math.round(ratio * 255);
  };

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const target = dragTargetRef.current ?? effectiveTarget;

    const onMove = (e: MouseEvent) => {
      const value = valueFromClientX(e.clientX);
      if (dragging === "black") {
        updateChannelParams(
          target,
          { inputBlack: value },
          "black"
        );
      } else if (dragging === "white") {
        updateChannelParams(
          target,
          { inputWhite: value },
          "white"
        );
      } else {
        updateChannelParams(target, { midtone: value }, "midtone");
      }
    };

    const onUp = () => {
      dragTargetRef.current = null;
      setDragging(null);
      flushPreview();
      onPreviewChange(
        levelsStateRef.current,
        previewEnabledRef.current
      );
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, effectiveTarget, updateChannelParams, flushPreview, onPreviewChange]);

  const handlePos = (value: number) =>
    `${(value / 255) * 100}%`;

  const gamma = midtoneToGamma(
    activeParams.inputBlack,
    activeParams.inputWhite,
    activeParams.midtone
  );

  return (
    <Modal
      open={open}
      title="Уровни"
      onClose={isApplying ? () => undefined : handleCancel}
      draggable
      className="levels-dialog"
    >
      <div
        className={`levels-dialog__panel ${isApplying ? "levels-dialog__panel--busy" : ""}`}
      >
        {isApplying && <DialogApplyOverlay message="Применение уровней…" />}

      <div className="levels-dialog__controls-row">
        <label className="levels-dialog__field">
          Канал:
          <select
            value={effectiveTarget}
            disabled={isApplying}
            onChange={(e) =>
              setActiveTarget(e.target.value as LevelsTarget)
            }
          >
            {channelOptions.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
              >
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="levels-dialog__checkbox">
          <input
            type="checkbox"
            checked={logScale}
            disabled={isApplying}
            onChange={(e) =>
              setLogScale(e.target.checked)
            }
          />
          Логарифмическая шкала
        </label>

        <label className="levels-dialog__checkbox">
          <input
            type="checkbox"
            checked={preview}
            disabled={isApplying}
            onChange={(e) =>
              handlePreviewToggle(e.target.checked)
            }
          />
          Предпросмотр
        </label>
      </div>

      <div className="levels-dialog__histogram">
        <Bar
          data={chartData}
          options={chartOptions}
        />
      </div>

      <div
        className="levels-dialog__slider-track"
        ref={sliderTrackRef}
      >
        <div
          className="levels-dialog__handle levels-dialog__handle--black"
          style={{ left: handlePos(activeParams.inputBlack) }}
          onMouseDown={(e) => {
            e.preventDefault();
            dragTargetRef.current = effectiveTarget;
            setDragging("black");
          }}
          title="Точка чёрного"
        />
        <div
          className="levels-dialog__handle levels-dialog__handle--midtone"
          style={{ left: handlePos(activeParams.midtone) }}
          onMouseDown={(e) => {
            e.preventDefault();
            dragTargetRef.current = effectiveTarget;
            setDragging("midtone");
          }}
          title={`Полутона (γ=${gamma.toFixed(2)})`}
        />
        <div
          className="levels-dialog__handle levels-dialog__handle--white"
          style={{ left: handlePos(activeParams.inputWhite) }}
          onMouseDown={(e) => {
            e.preventDefault();
            dragTargetRef.current = effectiveTarget;
            setDragging("white");
          }}
          title="Точка белого"
        />
      </div>

      <div className="levels-dialog__values">
        <span>
          Вход: {activeParams.inputBlack} ·{" "}
          {activeParams.midtone} ·{" "}
          {activeParams.inputWhite}
        </span>
        <span>γ = {gamma.toFixed(2)}</span>
      </div>

      <div className="levels-dialog__actions">
        <button
          type="button"
          className="levels-dialog__btn levels-dialog__btn--secondary"
          onClick={handleReset}
          disabled={isApplying}
        >
          Сброс
        </button>
        <div className="levels-dialog__actions-right">
          <button
            type="button"
            className="levels-dialog__btn levels-dialog__btn--secondary"
            onClick={handleCancel}
            disabled={isApplying}
          >
            Отмена
          </button>
          <button
            type="button"
            className="levels-dialog__btn levels-dialog__btn--primary"
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
