import { useEffect, useMemo, useState } from "react";
import type { ImageModel } from "../core/image/ImageModel";
import { formatMegapixels } from "../core/image/ImageScaler";
import {
  getInterpolationMethod,
  INTERPOLATION_METHODS,
  type InterpolationMethodId,
} from "../core/image/interpolation";
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
  onApply: (result: ScaleDialogResult) => void;
  onCancel: () => void;
};

const MIN_PIXEL = 1;
const MAX_PIXEL = 16_384;
const MIN_PERCENT = 1;
const MAX_PERCENT = 300;

function roundDimension(value: number): number {
  return Math.max(MIN_PIXEL, Math.round(value));
}

export function ScaleDialog({
  open,
  sourceImage,
  onApply,
  onCancel,
}: ScaleDialogProps) {
  const [unit, setUnit] = useState<ScaleUnit>("percent");
  const [widthValue, setWidthValue] = useState(String(sourceImage.width));
  const [heightValue, setHeightValue] = useState(String(sourceImage.height));
  const [lockAspect, setLockAspect] = useState(true);
  const [methodId, setMethodId] =
    useState<InterpolationMethodId>("bilinear");
  const [errors, setErrors] = useState<string[]>([]);

  const aspectRatio = sourceImage.width / sourceImage.height;

  useEffect(() => {
    if (!open) {
      return;
    }

    setUnit("percent");
    setWidthValue("100");
    setHeightValue("100");
    setLockAspect(true);
    setMethodId("bilinear");
    setErrors([]);
  }, [open, sourceImage.width, sourceImage.height]);

  const targetDimensions = useMemo(() => {
    const widthNum = Number(widthValue);
    const heightNum = Number(heightValue);

    if (!Number.isFinite(widthNum) || !Number.isFinite(heightNum)) {
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
  ]);

  const method = getInterpolationMethod(methodId);

  const validate = (): ScaleDialogResult | null => {
    const nextErrors: string[] = [];
    const widthNum = Number(widthValue);
    const heightNum = Number(heightValue);

    if (widthValue.trim() === "" || heightValue.trim() === "") {
      nextErrors.push("Укажите ширину и высоту.");
    }

    if (!Number.isFinite(widthNum) || !Number.isFinite(heightNum)) {
      nextErrors.push("Ширина и высота должны быть числами.");
    }

    if (unit === "pixels") {
      if (widthNum < MIN_PIXEL || widthNum > MAX_PIXEL) {
        nextErrors.push(
          `Ширина: от ${MIN_PIXEL} до ${MAX_PIXEL} пикселей.`
        );
      }
      if (heightNum < MIN_PIXEL || heightNum > MAX_PIXEL) {
        nextErrors.push(
          `Высота: от ${MIN_PIXEL} до ${MAX_PIXEL} пикселей.`
        );
      }
    } else {
      if (widthNum < MIN_PERCENT || widthNum > MAX_PERCENT) {
        nextErrors.push(
          `Ширина: от ${MIN_PERCENT}% до ${MAX_PERCENT}% от исходного размера.`
        );
      }
      if (heightNum < MIN_PERCENT || heightNum > MAX_PERCENT) {
        nextErrors.push(
          `Высота: от ${MIN_PERCENT}% до ${MAX_PERCENT}% от исходного размера.`
        );
      }
    }

    if (!targetDimensions) {
      setErrors(nextErrors);
      return null;
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return null;
    }

    setErrors([]);
    return {
      width: targetDimensions.width,
      height: targetDimensions.height,
      methodId,
    };
  };

  const handleWidthChange = (value: string) => {
    setWidthValue(value);
    if (!lockAspect) {
      return;
    }

    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      return;
    }

    if (unit === "pixels") {
      setHeightValue(String(Math.round(num / aspectRatio)));
    } else {
      setHeightValue(value);
    }
  };

  const handleHeightChange = (value: string) => {
    setHeightValue(value);
    if (!lockAspect) {
      return;
    }

    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      return;
    }

    if (unit === "pixels") {
      setWidthValue(String(Math.round(num * aspectRatio)));
    } else {
      setWidthValue(value);
    }
  };

  const handleUnitChange = (nextUnit: ScaleUnit) => {
    if (!targetDimensions) {
      setUnit(nextUnit);
      return;
    }

    if (nextUnit === "pixels") {
      setWidthValue(String(targetDimensions.width));
      setHeightValue(String(targetDimensions.height));
    } else {
      const wPercent = (targetDimensions.width / sourceImage.width) * 100;
      const hPercent = (targetDimensions.height / sourceImage.height) * 100;
      setWidthValue(String(Math.round(wPercent)));
      setHeightValue(String(Math.round(hPercent)));
    }

    setUnit(nextUnit);
    setErrors([]);
  };

  const handleApply = () => {
    const result = validate();
    if (result) {
      onApply(result);
    }
  };

  const sourceMp = formatMegapixels(sourceImage.width, sourceImage.height);
  const targetMp = targetDimensions
    ? formatMegapixels(targetDimensions.width, targetDimensions.height)
    : "—";

  return (
    <Modal
      open={open}
      title="Изменение размера изображения"
      onClose={onCancel}
      className="scale-dialog"
      draggable
    >
      <div className="scale-dialog__content">
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
              min={unit === "pixels" ? MIN_PIXEL : MIN_PERCENT}
              max={unit === "pixels" ? MAX_PIXEL : MAX_PERCENT}
              value={widthValue}
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
              min={unit === "pixels" ? MIN_PIXEL : MIN_PERCENT}
              max={unit === "pixels" ? MAX_PIXEL : MAX_PERCENT}
              value={heightValue}
              onChange={(e) => handleHeightChange(e.target.value)}
            />
            <span className="scale-dialog__unit">
              {unit === "pixels" ? "px" : "%"}
            </span>
          </label>
        </div>

        <label className="scale-dialog__checkbox">
          <input
            type="checkbox"
            checked={lockAspect}
            onChange={(e) => setLockAspect(e.target.checked)}
          />
          Сохранять пропорции (
          {sourceImage.width}×{sourceImage.height})
        </label>

        <label className="scale-dialog__field">
          Интерполяция:
          <select
            value={methodId}
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

        {errors.length > 0 && (
          <ul className="scale-dialog__errors">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        )}

        <div className="scale-dialog__actions">
          <button
            type="button"
            className="scale-dialog__btn scale-dialog__btn--secondary"
            onClick={onCancel}
          >
            Отмена
          </button>
          <button
            type="button"
            className="scale-dialog__btn scale-dialog__btn--primary"
            onClick={handleApply}
          >
            Применить
          </button>
        </div>
      </div>
    </Modal>
  );
}
