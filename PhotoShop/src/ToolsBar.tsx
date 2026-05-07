import "./ToolsBar.css";
import toast from "react-hot-toast";

export type ToolType = "move" | "eyedropper";

type PixelInfo = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  l: number;
  a: number;
  bb: number;
};

type ToolsBarProps = {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  pixelInfo: PixelInfo | null;
};

// Встроенная функция конвертации RGB в CIELAB
function rgbToLab(
  r: number,
  g: number,
  b: number
): { L: number; a: number; b: number } {
  // Нормализация RGB в диапазон 0..1
  let rLinear = r / 255;
  let gLinear = g / 255;
  let bLinear = b / 255;

  // Гамма-коррекция (sRGB → линейный RGB)
  const transform = (c: number) => {
    if (c <= 0.04045) {
      return c / 12.92;
    }
    return Math.pow((c + 0.055) / 1.055, 2.4);
  };

  rLinear = transform(rLinear);
  gLinear = transform(gLinear);
  bLinear = transform(bLinear);

  // Матрица преобразования RGB → XYZ (D65)
  const x = rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375;
  const y = rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.072175;
  const z = rLinear * 0.0193339 + gLinear * 0.119192 + bLinear * 0.9503041;

  // Референсный белый D65
  const refX = 95.047;
  const refY = 100.0;
  const refZ = 108.883;

  // Нормализация XYZ
  let xNorm = x / refX;
  let yNorm = y / refY;
  let zNorm = z / refZ;

  // Преобразование в CIELAB
  const f = (t: number) => {
    if (t > 0.008856) {
      return Math.pow(t, 1 / 3);
    }
    return 7.787 * t + 16 / 116;
  };

  const fx = f(xNorm);
  const fy = f(yNorm);
  const fz = f(zNorm);

  const L = 116 * fy - 16;
  const aLab = 500 * (fx - fy);
  const bLab = 200 * (fy - fz);

  // Округляем до целых чисел
  return {
    L: Math.round(L),
    a: Math.round(aLab),
    b: Math.round(bLab),
  };
}

// Функция для преобразования RGB в HEX
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = n.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Функция для копирования текста в буфер обмена
async function copyToClipboard(
  text: string,
  onSuccess?: () => void,
  onError?: () => void
) {
  try {
    await navigator.clipboard.writeText(text);
    onSuccess?.();
  } catch (err) {
    console.error("Ошибка копирования:", err);
    onError?.();
  }
}

export function ToolsBar({
  activeTool,
  onToolChange,
  pixelInfo,
}: ToolsBarProps) {
  // Преобразуем RGB в LAB для отображения (если есть pixelInfo)
  let labInfo = null;
  let hexColor = null;

  if (pixelInfo) {
    labInfo = rgbToLab(pixelInfo.r, pixelInfo.g, pixelInfo.b);
    hexColor = rgbToHex(pixelInfo.r, pixelInfo.g, pixelInfo.b);
  }

  const handleCopyHex = async () => {
    if (hexColor) {
      await copyToClipboard(
        hexColor,
        () => toast.success(`Цвет ${hexColor} скопирован!`),
        () => toast.error("Не удалось скопировать цвет")
      );
    }
  };

  const handleCopyRgb = async () => {
    if (pixelInfo) {
      const rgbString = `rgb(${pixelInfo.r}, ${pixelInfo.g}, ${pixelInfo.b})`;
      await copyToClipboard(
        rgbString,
        () => toast.success(`Цвет ${rgbString} скопирован!`),
        () => toast.error("Не удалось скопировать цвет")
      );
    }
  };

  return (
    <aside className="tools-bar">
      <h3 className="tools-bar__title">Инструменты</h3>

      <div className="tools-bar__buttons">
        <button
          type="button"
          className={`tools-bar__btn ${
            activeTool === "move" ? "is-active" : ""
          }`}
          onClick={() => onToolChange("move")}
        >
          Курсор (перемещение)
        </button>

        <button
          type="button"
          className={`tools-bar__btn ${
            activeTool === "eyedropper" ? "is-active" : ""
          }`}
          onClick={() => onToolChange("eyedropper")}
        >
          Пипетка
        </button>
      </div>

      <div className="tools-bar__info">
        <h4>Информация о пикселе</h4>
        {pixelInfo ? (
          <>
            <div className="tools-bar__color-preview">
              {/* Квадрат с цветом */}
              <div
                className="color-square"
                style={{ backgroundColor: hexColor || "#000000" }}
                title={hexColor || ""}
              />

              {/* HEX код с возможностью копирования */}
              <div className="color-info">
                <div
                  className="color-hex copyable"
                  onClick={handleCopyHex}
                  title="Нажмите для копирования HEX"
                >
                  <span className="color-label">HEX:</span>
                  <span className="color-value">{hexColor}</span>
                  <span className="copy-icon">📋</span>
                </div>

                <div
                  className="color-rgb copyable"
                  onClick={handleCopyRgb}
                  title="Нажмите для копирования RGB"
                >
                  <span className="color-label">RGB:</span>
                  <span className="color-value">
                    {pixelInfo.r}, {pixelInfo.g}, {pixelInfo.b}
                  </span>
                  <span className="copy-icon">📋</span>
                </div>
              </div>
            </div>

            <p>
              <strong>X:</strong> {pixelInfo.x} <strong>Y:</strong>{" "}
              {pixelInfo.y}
            </p>
            <p>
              <strong>R:</strong> {pixelInfo.r} <strong>G:</strong>{" "}
              {pixelInfo.g} <strong>B:</strong> {pixelInfo.b}
            </p>
            <p>
              <strong>L:</strong> {labInfo?.L} <strong>a:</strong> {labInfo?.a}{" "}
              <strong>b:</strong> {labInfo?.b}
            </p>
          </>
        ) : (
          <p>Выберите пипетку и кликните по изображению.</p>
        )}
      </div>
    </aside>
  );
}
