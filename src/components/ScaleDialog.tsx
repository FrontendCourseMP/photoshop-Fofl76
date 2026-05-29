import { useMemo, useState } from "react";
import type { ImageModel } from "../core/image/ImageModel";
import { formatMegapixels } from "../core/image/ImageScaler";
import {
  getInterpolationMethod,
  INTERPOLATION_METHODS,
  type InterpolationMethodId,
} from "../core/image/interpolation";
import { DialogApplyOverlay } from "./DialogApplyOverlay";
import { Modal } from "./Modal";
import "./ScaleDialog.css";

export type ScaleUnit = "percent" | "pixels";

export type ScaleDialogResult = {
  width: number;
  height: number;
  methodId: InterpolationMethodId;
};

type ScaleDialogProps = {
  open: boolean;
  sourceImage: ImageModel;
  onApply: (result: ScaleDialogResult) => void | Promise<void>;
  onCancel: () => void;
};

const MIN_PIXEL = 1;
const MAX_PIXEL = 16_384;
const MIN_PERCENT = 12;
const MAX_PERCENT = 300;
const MAX_INPUT_LENGTH = 5;

function limitScaleInput(value: string): string {
  return value.slice(0, MAX_INPUT_LENGTH);
}

function roundDimension(value: number): number {
  return Math.max(MIN_PIXEL, Math.round(value));
}

function pixelBoundsForSource(sourceSize: number): {
  min: number;
  max: number;
} {
  return {
    min: Math.max(
      MIN_PIXEL,
      Math.round((sourceSize * MIN_PERCENT) / 100)
    ),
    max: Math.min(
      MAX_PIXEL,
      Math.round((sourceSize * MAX_PERCENT) / 100)
    ),
  };
}

function collectScaleErrors(
  widthValue: string,
  heightValue: string,
  unit: ScaleUnit,
  sourceWidth: number,
  sourceHeight: number
): string[] {
  const errors: string[] = [];
  const widthNum = Number(widthValue);
  const heightNum = Number(heightValue);

  if (widthValue.trim() === "") {
    errors.push("Укажите ширину.");
  } else if (!Number.isFinite(widthNum)) {
    errors.push("Ширина должна быть числом.");
  } else if (unit === "pixels") {
    const { min, max } = pixelBoundsForSource(sourceWidth);
    if (widthNum < min || widthNum > max) {
      errors.push(`Ширина: от ${min} до ${max} пикселей (12–300% от исходного).`);
    }
  } else if (widthNum < MIN_PERCENT || widthNum > MAX_PERCENT) {
    errors.push(
      `Ширина: от ${MIN_PERCENT}% до ${MAX_PERCENT}% от исходного размера.`
    );
  }

  if (heightValue.trim() === "") {
    errors.push("Укажите высоту.");
  } else if (!Number.isFinite(heightNum)) {
    errors.push("Высота должна быть числом.");
  } else if (unit === "pixels") {
    const { min, max } = pixelBoundsForSource(sourceHeight);
    if (heightNum < min || heightNum > max) {
      errors.push(`Высота: от ${min} до ${max} пикселей (12–300% от исходного).`);
    }
  } else if (heightNum < MIN_PERCENT || heightNum > MAX_PERCENT) {
    errors.push(
      `Высота: от ${MIN_PERCENT}% до ${MAX_PERCENT}% от исходного размера.`
    );
  }

  return errors;
}

function buildScaleResult(
  widthValue: string,
  heightValue: string,
  unit: ScaleUnit,
  sourceWidth: number,
  sourceHeight: number,
  methodId: InterpolationMethodId
): ScaleDialogResult | null {
  const errors = collectScaleErrors(
    widthValue,
    heightValue,
    unit,
    sourceWidth,
    sourceHeight
  );

  if (errors.length > 0) {
    return null;
  }

  const widthNum = Number(widthValue);
  const heightNum = Number(heightValue);

  if (unit === "pixels") {
    return {
      width: roundDimension(widthNum),
      height: roundDimension(heightNum),
      methodId,
    };
  }

  return {
    width: roundDimension((sourceWidth * widthNum) / 100),
    height: roundDimension((sourceHeight * heightNum) / 100),
    methodId,
  };
}

export function ScaleDialog({
  open,
  sourceImage,
  onApply,
  onCancel,
}: ScaleDialogProps) {
  const [unit, setUnit] = useState<ScaleUnit>("percent");
  const [widthValue, setWidthValue] = useState("100");
  const [heightValue, setHeightValue] = useState("100");
  const [lockAspect, setLockAspect] = useState(true);
  const [methodId, setMethodId] =
    useState<InterpolationMethodId>("bilinear");
  const [isApplying, setIsApplying] = useState(false);

  const aspectRatio = sourceImage.width / sourceImage.height;

  const widthPixelBounds = useMemo(
    () => pixelBoundsForSource(sourceImage.width),
    [sourceImage.width]
  );
  const heightPixelBounds = useMemo(
    () => pixelBoundsForSource(sourceImage.height),
    [sourceImage.height]
  );

  const errors = useMemo(
    () =>
      collectScaleErrors(
        widthValue,
        heightValue,
        unit,
        sourceImage.width,
        sourceImage.height
      ),
    [widthValue, heightValue, unit, sourceImage.width, sourceImage.height]
  );

  const targetDimensions = useMemo(() => {
    const widthNum = Number(widthValue);
    const heightNum = Number(heightValue);

    if (!Number.isFinite(widthNum) || !Number.isFinite(heightNum)) {
      return null;
    }

    if (errors.length > 0) {
      return null;
    }

    if (unit === "pixels") {
      return {
        width: roundDimension(widthNum),
        height: roundDimension(heightNum),
      };
    }

    return {
      width: roundDimension((sourceImage.width * widthNum) / 100),
      height: roundDimension((sourceImage.height * heightNum) / 100),
    };
  }, [
    widthValue,
    heightValue,
    unit,
    sourceImage.width,
    sourceImage.height,
    errors,
  ]);

  const applyResult = useMemo(
    () =>
      buildScaleResult(
        widthValue,
        heightValue,
        unit,
        sourceImage.width,
        sourceImage.height,
        methodId
      ),
    [
      widthValue,
      heightValue,
      unit,
      sourceImage.width,
      sourceImage.height,
      methodId,
    ]
  );

  const method = getInterpolationMethod(methodId);

  const handleWidthChange = (value: string) => {
    const limited = limitScaleInput(value);
    setWidthValue(limited);
    if (!lockAspect) {
      return;
    }

    const num = Number(limited);
    if (!Number.isFinite(num) || num <= 0) {
      return;
    }

    if (unit === "pixels") {
      setHeightValue(
        limitScaleInput(String(Math.round(num / aspectRatio)))
      );
    } else {
      setHeightValue(limited);
    }
  };

  const handleHeightChange = (value: string) => {
    const limited = limitScaleInput(value);
    setHeightValue(limited);
    if (!lockAspect) {
      return;
    }

    const num = Number(limited);
    if (!Number.isFinite(num) || num <= 0) {
      return;
    }

    if (unit === "pixels") {
      setWidthValue(
        limitScaleInput(String(Math.round(num * aspectRatio)))
      );
    } else {
      setWidthValue(limited);
    }
  };

  const handleUnitChange = (nextUnit: ScaleUnit) => {
    if (!targetDimensions) {
      setUnit(nextUnit);
      return;
    }

    if (nextUnit === "pixels") {
      setWidthValue(limitScaleInput(String(targetDimensions.width)));
      setHeightValue(limitScaleInput(String(targetDimensions.height)));
    } else {
      const wPercent = (targetDimensions.width / sourceImage.width) * 100;
      const hPercent = (targetDimensions.height / sourceImage.height) * 100;
      setWidthValue(limitScaleInput(String(Math.round(wPercent))));
      setHeightValue(limitScaleInput(String(Math.round(hPercent))));
    }

    setUnit(nextUnit);
  };

  const handleApply = async () => {
    if (!applyResult || isApplying) {
      return;
    }

    setIsApplying(true);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    try {
      await onApply(applyResult);
    } finally {
      setIsApplying(false);
    }
  };

  const sourceMp = formatMegapixels(sourceImage.width, sourceImage.height);
  const targetMp = targetDimensions
    ? formatMegapixels(targetDimensions.width, targetDimensions.height)
    : "—";

  const widthInputMin =
    unit === "pixels" ? widthPixelBounds.min : MIN_PERCENT;
  const widthInputMax =
    unit === "pixels" ? widthPixelBounds.max : MAX_PERCENT;
  const heightInputMin =
    unit === "pixels" ? heightPixelBounds.min : MIN_PERCENT;
  const heightInputMax =
    unit === "pixels" ? heightPixelBounds.max : MAX_PERCENT;

  return (
    <Modal
      open={open}
      title="Изменение размера изображения"
      onClose={isApplying ? () => undefined : onCancel}
      className="scale-dialog"
      draggable
    >
      <div
        className={`scale-dialog__content ${isApplying ? "scale-dialog__content--busy" : ""}`}
      >
        {isApplying && (
          <DialogApplyOverlay message="Изменение размера…" />
        )}
        <p className="scale-dialog__pixels">
          Пикселей: <strong>{sourceMp}</strong> → <strong>{targetMp}</strong>
          {targetDimensions && (
            <span className="scale-dialog__dims">
              {" "}
              ({targetDimensions.width}×{targetDimensions.height})
            </span>
          )}
        </p>

        <label className="scale-dialog__field">
          Единицы:
          <select
            value={unit}
            disabled={isApplying}
            onChange={(e) =>
              handleUnitChange(e.target.value as ScaleUnit)
            }
          >
            <option value="percent">Проценты (%)</option>
            <option value="pixels">Пиксели (px)</option>
          </select>
        </label>

        <div className="scale-dialog__size-row">
          <label className="scale-dialog__field">
            Ширина:
            <input
              type="number"
              min={widthInputMin}
              max={widthInputMax}
              maxLength={MAX_INPUT_LENGTH}
              value={widthValue}
              disabled={isApplying}
              onChange={(e) => handleWidthChange(e.target.value)}
            />
            <span className="scale-dialog__unit">
              {unit === "pixels" ? "px" : "%"}
            </span>
          </label>

          <label className="scale-dialog__field">
            Высота:
            <input
              type="number"
              min={heightInputMin}
              max={heightInputMax}
              maxLength={MAX_INPUT_LENGTH}
              value={heightValue}
              disabled={isApplying}
              onChange={(e) => handleHeightChange(e.target.value)}
            />
            <span className="scale-dialog__unit">
              {unit === "pixels" ? "px" : "%"}
            </span>
          </label>
        </div>

        {errors.length > 0 && (
          <ul className="scale-dialog__errors" role="alert">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        )}

        <label className="scale-dialog__checkbox">
          <input
            type="checkbox"
            checked={lockAspect}
            disabled={isApplying}
            onChange={(e) => setLockAspect(e.target.checked)}
          />
          Сохранять пропорции (
          {sourceImage.width}×{sourceImage.height})
        </label>

        <label className="scale-dialog__field">
          Интерполяция:
          <select
            value={methodId}
            disabled={isApplying}
            onChange={(e) =>
              setMethodId(e.target.value as InterpolationMethodId)
            }
          >
            {INTERPOLATION_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <p className="scale-dialog__tooltip" title={method.description}>
          {method.description}
        </p>

        <div className="scale-dialog__actions">
          <button
            type="button"
            className="scale-dialog__btn scale-dialog__btn--secondary"
            onClick={onCancel}
            disabled={isApplying}
          >
            Отмена
          </button>
          <button
            type="button"
            className="scale-dialog__btn scale-dialog__btn--primary"
            onClick={() => void handleApply()}
            disabled={isApplying || !applyResult}
          >
            {isApplying ? "Применение…" : "Применить"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
