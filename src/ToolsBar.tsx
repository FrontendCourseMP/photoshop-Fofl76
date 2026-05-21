import { useState } from "react";
import "./ToolsBar.css";
import toast from "react-hot-toast";

export type ToolType = "move" | "eyedropper";
export type ChannelMode = "rgb" | "red" | "green" | "blue" | "grayscale";

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

type ChannelPreview = {
  mode: ChannelMode;
  imageData: ImageData;
  previewUrl: string;
};

type ToolsBarProps = {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  pixelInfo: PixelInfo | null;
  channelMode: ChannelMode;
  onChannelChange: (mode: ChannelMode) => void;
  channelPreviews: ChannelPreview[];
  hasImage: boolean;
  alphaEnabled: boolean;
  onAlphaToggle: () => void;
  hasAlphaChannel: boolean;
};

// Встроенная функция конвертации RGB в CIELAB
function rgbToLab(
  r: number,
  g: number,
  b: number
): { L: number; a: number; b: number } {
  let rLinear = r / 255;
  let gLinear = g / 255;
  let bLinear = b / 255;

  const transform = (c: number) => {
    if (c <= 0.04045) {
      return c / 12.92;
    }
    return Math.pow((c + 0.055) / 1.055, 2.4);
  };

  rLinear = transform(rLinear);
  gLinear = transform(gLinear);
  bLinear = transform(bLinear);

  const x = rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375;
  const y = rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.072175;
  const z = rLinear * 0.0193339 + gLinear * 0.119192 + bLinear * 0.9503041;

  const refX = 95.047;
  const refY = 100.0;
  const refZ = 108.883;

  let xNorm = x / refX;
  let yNorm = y / refY;
  let zNorm = z / refZ;

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

  return {
    L: Math.round(L),
    a: Math.round(aLab),
    b: Math.round(bLab),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = n.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

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

const getChannelButtonClass = (
  mode: ChannelMode,
  activeChannel: ChannelMode
) => {
  const baseClass = "channels-bar__btn";
  const isActive = activeChannel === mode;

  switch (mode) {
    case "rgb":
      return `${baseClass} channels-bar__btn--rgb ${
        isActive ? "channels-bar__btn--active" : ""
      }`;
    case "red":
      return `${baseClass} channels-bar__btn--red ${
        isActive ? "channels-bar__btn--active" : ""
      }`;
    case "green":
      return `${baseClass} channels-bar__btn--green ${
        isActive ? "channels-bar__btn--active" : ""
      }`;
    case "blue":
      return `${baseClass} channels-bar__btn--blue ${
        isActive ? "channels-bar__btn--active" : ""
      }`;
    case "grayscale":
      return `${baseClass} channels-bar__btn--gray ${
        isActive ? "channels-bar__btn--active" : ""
      }`;
    default:
      return baseClass;
  }
};

const getChannelLabel = (mode: ChannelMode): string => {
  switch (mode) {
    case "rgb":
      return "RGB";
    case "red":
      return "Красный";
    case "green":
      return "Зеленый";
    case "blue":
      return "Синий";
    case "grayscale":
      return "Оттенки серого";
  }
};

export function ToolsBar({
  activeTool,
  onToolChange,
  pixelInfo,
  channelMode,
  onChannelChange,
  channelPreviews,
  hasImage,
  alphaEnabled,
  onAlphaToggle,
  hasAlphaChannel,
}: ToolsBarProps) {
  const [isChannelsCollapsed, setIsChannelsCollapsed] = useState(false);
  const [isInfoCollapsed, setIsInfoCollapsed] = useState(false);

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

  const getChannelPreview = (mode: ChannelMode) => {
    return channelPreviews.find((p) => p.mode === mode)?.previewUrl;
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
          title="Курсор (перемещение)"
        >
          <span className="tool-icon">
            <img src="/cursor-svgrepo-com.svg" alt="Курсор" />
          </span>
        </button>

        <button
          type="button"
          className={`tools-bar__btn ${
            activeTool === "eyedropper" ? "is-active" : ""
          }`}
          onClick={() => onToolChange("eyedropper")}
          title="Пипетка"
        >
          <span className="tool-icon">
            <img src="/pipette-svgrepo-com.svg" alt="Пипетка" />
          </span>
        </button>
      </div>

      {hasImage && (
        <>
          <div className="tools-bar__divider" />

          <div className="channels-bar">
            <div
              className="section-header"
              onClick={() => setIsChannelsCollapsed(!isChannelsCollapsed)}
            >
              <h4 className="channels-bar__title">Каналы</h4>
              <button className="collapse-btn">
                {isChannelsCollapsed ? "▼" : "▲"}
              </button>
            </div>

            {!isChannelsCollapsed && (
              <>
                <div className="channels-bar__buttons">
                  {(
                    [
                      "rgb",
                      "red",
                      "green",
                      "blue",
                      "grayscale",
                    ] as ChannelMode[]
                  ).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => onChannelChange(mode)}
                      className={getChannelButtonClass(mode, channelMode)}
                      title={getChannelLabel(mode)}
                    >
                      <div className="channels-bar__btn-content">
                        {getChannelPreview(mode) && (
                          <img
                            src={getChannelPreview(mode)}
                            alt={`${getChannelLabel(mode)} preview`}
                            className="channel-preview"
                          />
                        )}
                        <span className="channel-label">
                          {getChannelLabel(mode)}
                        </span>
                      </div>
                    </button>
                  ))}

                  {/* Кнопка альфа-канала в стиле каналов */}
                  {hasAlphaChannel && (
                    <button
                      onClick={onAlphaToggle}
                      className={`channels-bar__btn channels-bar__btn--alpha ${
                        alphaEnabled ? "channels-bar__btn--active" : ""
                      }`}
                      title={
                        alphaEnabled
                          ? "Отключить альфа-канал"
                          : "Включить альфа-канал"
                      }
                    >
                      <div className="channels-bar__btn-content">
                        <div className="alpha-preview">
                          <div className="alpha-preview__checkerboard"></div>
                          <div
                            className="alpha-preview__overlay"
                            style={{ opacity: alphaEnabled ? 0 : 0.5 }}
                          ></div>
                        </div>
                        <span className="channel-label">
                          Alpha {alphaEnabled ? "✓" : "✗"}
                        </span>
                      </div>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div className="tools-bar__divider" />

      <div className="tools-bar__info">
        <div
          className="section-header"
          onClick={() => setIsInfoCollapsed(!isInfoCollapsed)}
        >
          <h4>Информация о пикселе</h4>
          <button className="collapse-btn">
            {isInfoCollapsed ? "▼" : "▲"}
          </button>
        </div>

        {!isInfoCollapsed && (
          <>
            {pixelInfo ? (
              <div className="tools-bar__color-preview">
                <div
                  className="color-square"
                  style={{ backgroundColor: hexColor || "#000000" }}
                  title={hexColor || ""}
                />

                <div className="color-info">
                  <div className="pixel-coords">
                    <span className="color-label">XY:</span>
                    <span className="color-value">
                      {pixelInfo.x}, {pixelInfo.y}
                    </span>
                  </div>

                  <div className="pixel-lab">
                    <span className="color-label">LAB:</span>
                    <span className="color-value">
                      {labInfo?.L}, {labInfo?.a}, {labInfo?.b}
                    </span>
                  </div>

                  <div
                    className="color-hex"
                    onClick={handleCopyHex}
                    title="Нажмите для копирования HEX"
                  >
                    <span className="color-label">HEX:</span>
                    <span className="color-value">{hexColor}</span>
                  </div>

                  <div
                    className="color-rgb"
                    onClick={handleCopyRgb}
                    title="Нажмите для копирования RGB"
                  >
                    <span className="color-label">RGB:</span>
                    <span className="color-value">
                      {pixelInfo.r}, {pixelInfo.g}, {pixelInfo.b}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p>Выберите пипетку и кликните по изображению</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
