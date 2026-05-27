import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  onApply: (state: LevelsState) => void;
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
  const sliderTrackRef =
    useRef<HTMLDivElement>(null);
  const previewRafRef = useRef<number | null>(null);

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

  const activeParams =
    levelsState[activeTarget];

  useEffect(() => {
    if (!open) {
      return;
    }
    setLevelsState(createDefaultLevelsState());
    setActiveTarget("master");
    setLogScale(false);
    setPreview(true);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (previewRafRef.current !== null) {
      cancelAnimationFrame(previewRafRef.current);
    }

    previewRafRef.current = requestAnimationFrame(() => {
      previewRafRef.current = null;
      onPreviewChange(levelsState, preview);
    });

    return () => {
      if (previewRafRef.current !== null) {
        cancelAnimationFrame(previewRafRef.current);
      }
    };
  }, [open, levelsState, preview, onPreviewChange]);

  useEffect(() => {
    return () => {
      if (previewRafRef.current !== null) {
        cancelAnimationFrame(previewRafRef.current);
      }
    };
  }, []);

  const histogram = useMemo(() => {
    return computeHistogram(
      sourceImage,
      targetToHistogramChannel(activeTarget)
    );
  }, [sourceImage, activeTarget]);

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
            activeTarget === "red"
              ? "rgba(255, 80, 80, 0.75)"
              : activeTarget === "green"
                ? "rgba(80, 220, 120, 0.75)"
                : activeTarget === "blue"
                  ? "rgba(80, 140, 255, 0.75)"
                  : activeTarget === "alpha"
                    ? "rgba(200, 200, 200, 0.75)"
                    : "rgba(180, 180, 180, 0.75)",
          borderWidth: 0,
          barPercentage: 1,
          categoryPercentage: 1,
        },
      ],
    };
  }, [histogram.bins, activeTarget]);

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

  const updateParams = useCallback(
    (
      patch: Partial<LevelsChannelParams>,
      changed: HandleKind
    ) => {
      setLevelsState((prev) => {
        const current = {
          ...prev[activeTarget],
          ...patch,
        };
        const clamped = clampChannelParams(
          current,
          changed === "midtone"
            ? "midtone"
            : changed
        );

        let next: LevelsState = {
          ...prev,
          [activeTarget]: clamped,
        };

        if (activeTarget === "master") {
          next = {
            ...next,
            master: clamped,
            red: { ...clamped },
            green: { ...clamped },
            blue: { ...clamped },
          };
        }

        return next;
      });
    },
    [activeTarget]
  );

  const handlePreviewToggle = (
    checked: boolean
  ) => {
    setPreview(checked);
  };

  const handleReset = () => {
    setLevelsState(createDefaultLevelsState());
  };

  const handleApply = () => {
    onApply(levelsState);
  };

  const handleCancel = () => {
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

    const onMove = (e: MouseEvent) => {
      const value = valueFromClientX(e.clientX);
      if (dragging === "black") {
        updateParams(
          { inputBlack: value },
          "black"
        );
      } else if (dragging === "white") {
        updateParams(
          { inputWhite: value },
          "white"
        );
      } else {
        updateParams({ midtone: value }, "midtone");
      }
    };

    const onUp = () => setDragging(null);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, updateParams]);

  const handlePos = (value: number) =>
    `${(value / 255) * 100}%`;

  const gamma = midtoneToGamma(
    activeParams.inputBlack,
    activeParams.inputWhite,
    activeParams.midtone
  );

  const channelOptions = CHANNEL_OPTIONS.filter(
    (o) => o.value !== "alpha" || hasAlpha
  );

  return (
    <Modal
      open={open}
      title="Уровни"
      onClose={handleCancel}
      draggable
      className="levels-dialog"
    >
      <div className="levels-dialog__controls-row">
        <label className="levels-dialog__field">
          Канал:
          <select
            value={activeTarget}
            onChange={(e) =>
              setActiveTarget(
                e.target.value as LevelsTarget
              )
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
            setDragging("black");
          }}
          title="Точка чёрного"
        />
        <div
          className="levels-dialog__handle levels-dialog__handle--midtone"
          style={{ left: handlePos(activeParams.midtone) }}
          onMouseDown={(e) => {
            e.preventDefault();
            setDragging("midtone");
          }}
          title={`Полутона (γ=${gamma.toFixed(2)})`}
        />
        <div
          className="levels-dialog__handle levels-dialog__handle--white"
          style={{ left: handlePos(activeParams.inputWhite) }}
          onMouseDown={(e) => {
            e.preventDefault();
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
        >
          Сброс
        </button>
        <div className="levels-dialog__actions-right">
          <button
            type="button"
            className="levels-dialog__btn levels-dialog__btn--secondary"
            onClick={handleCancel}
          >
            Отмена
          </button>
          <button
            type="button"
            className="levels-dialog__btn levels-dialog__btn--primary"
            onClick={handleApply}
          >
            Применить
          </button>
        </div>
      </div>
    </Modal>
  );
}
