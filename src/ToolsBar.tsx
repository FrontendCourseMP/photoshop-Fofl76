import { useState } from "react";
import "./ToolsBar.css";
import toast from "react-hot-toast";

export type ToolType = "move" | "eyedropper";
export type ChannelMode = 'red' | 'green' | 'blue' | 'alpha';
export type ActiveChannels = {
  red: boolean;
  green: boolean;
  blue: boolean;
  alpha: boolean;
};

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
  mode: string;
  imageData: ImageData;
  previewUrl: string;
};

type ToolsBarProps = {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  pixelInfo: PixelInfo | null;
  activeChannels: ActiveChannels;
  onChannelToggle: (channel: keyof ActiveChannels) => void;
  channelPreviews: ChannelPreview[];
  hasImage: boolean;
  hasAlphaChannel: boolean;
};

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

const getChannelButtonClass = (channel: string, isActive: boolean) => {
  const baseClass = 'channels-bar__btn';
  const activeClass = isActive ? 'channels-bar__btn--active' : '';
  
  switch (channel) {
    case 'red': return `${baseClass} channels-bar__btn--red ${activeClass}`;
    case 'green': return `${baseClass} channels-bar__btn--green ${activeClass}`;
    case 'blue': return `${baseClass} channels-bar__btn--blue ${activeClass}`;
    case 'alpha': return `${baseClass} channels-bar__btn--alpha ${activeClass}`;
    default: return baseClass;
  }
};

const getChannelLabel = (channel: string): string => {
  switch (channel) {
    case 'red': return 'Красный';
    case 'green': return 'Зеленый';
    case 'blue': return 'Синий';
    case 'alpha': return 'Alpha';
    default: return channel;
  }
};

export function ToolsBar({
  activeTool,
  onToolChange,
  pixelInfo,
  activeChannels,
  onChannelToggle,
  channelPreviews,
  hasImage,
  hasAlphaChannel,
}: ToolsBarProps) {
  const [isChannelsCollapsed, setIsChannelsCollapsed] = useState(false);
  const [isInfoCollapsed, setIsInfoCollapsed] = useState(false);

  let hexColor = null;

  if (pixelInfo) {
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

  const getChannelPreview = (channel: string) => {
    const preview = channelPreviews.find(p => p.mode === channel);
    return preview?.previewUrl;
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
                {isChannelsCollapsed ? '▼' : '▲'}
              </button>
            </div>
            
            {!isChannelsCollapsed && (
              <div className="channels-bar__buttons">
                {/* Красный канал */}
                <button
                  onClick={() => onChannelToggle('red')}
                  className={getChannelButtonClass('red', activeChannels.red)}
                  title="Красный канал"
                >
                  <div className="channels-bar__btn-content">
                    {getChannelPreview('red') && (
                      <img 
                        src={getChannelPreview('red')} 
                        alt="Red channel preview" 
                        className="channel-preview"
                      />
                    )}
                    <span className="channel-label">
                      {getChannelLabel('red')}
                      {activeChannels.red && <span className="channel-status">✓</span>}
                    </span>
                  </div>
                </button>

                {/* Зеленый канал */}
                <button
                  onClick={() => onChannelToggle('green')}
                  className={getChannelButtonClass('green', activeChannels.green)}
                  title="Зеленый канал"
                >
                  <div className="channels-bar__btn-content">
                    {getChannelPreview('green') && (
                      <img 
                        src={getChannelPreview('green')} 
                        alt="Green channel preview" 
                        className="channel-preview"
                      />
                    )}
                    <span className="channel-label">
                      {getChannelLabel('green')}
                      {activeChannels.green && <span className="channel-status">✓</span>}
                    </span>
                  </div>
                </button>

                {/* Синий канал */}
                <button
                  onClick={() => onChannelToggle('blue')}
                  className={getChannelButtonClass('blue', activeChannels.blue)}
                  title="Синий канал"
                >
                  <div className="channels-bar__btn-content">
                    {getChannelPreview('blue') && (
                      <img 
                        src={getChannelPreview('blue')} 
                        alt="Blue channel preview" 
                        className="channel-preview"
                      />
                    )}
                    <span className="channel-label">
                      {getChannelLabel('blue')}
                      {activeChannels.blue && <span className="channel-status">✓</span>}
                    </span>
                  </div>
                </button>

                {/* Альфа канал (только если есть) */}
                {hasAlphaChannel && (
                  <button
                    onClick={() => onChannelToggle('alpha')}
                    className={getChannelButtonClass('alpha', activeChannels.alpha)}
                    title="Альфа-канал (прозрачность)"
                  >
                    <div className="channels-bar__btn-content">
                      <div className="alpha-preview">
                        <div className="alpha-preview__checkerboard"></div>
                        <div className="alpha-preview__overlay" style={{ opacity: activeChannels.alpha ? 0 : 0.5 }}></div>
                      </div>
                      <span className="channel-label">
                        {getChannelLabel('alpha')}
                        {activeChannels.alpha && <span className="channel-status">✓</span>}
                      </span>
                    </div>
                  </button>
                )}
              </div>
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
            {isInfoCollapsed ? '▼' : '▲'}
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