import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, MouseEvent, WheelEvent } from "react";

import "./App.css";

import { encodeGb7 } from "./coder";

import { ToolsBar, type ToolType } from "./ToolsBar";

import { Toaster, toast } from "react-hot-toast";

// Правильные пути для вашей структуры (src/core/image/)
import { ImageFactory } from "./core/image/ImageFactory";
import { ImageModel } from "./core/image/ImageModel";

import { ImageChannels, type ChannelPreview } from "./core/image/ImageChannels";

import type { ActiveChannels } from "./core/image/types";

import { DialogApplyOverlay } from "./components/DialogApplyOverlay";
import { LevelsDialog } from "./components/LevelsDialog";
import { KernelsDialog } from "./components/KernelsDialog";
import {
  ScaleDialog,
  type ScaleDialogResult,
} from "./components/ScaleDialog";
import {
  cloneLevelsState,
  createDefaultLevelsState,
  levelsStateToWire,
  type LevelsState,
} from "./core/image/Levels";
import {
  imageWorkerClient,
  pixelsToImageModel,
} from "./core/image/ImageWorkerClient";
import type { KernelFilterStateWire } from "./core/image/processing/kernelsPixels";
import {
  clampViewZoom,
  computeFitViewZoom,
  VIEW_ZOOM_MAX,
  VIEW_ZOOM_MIN,
  VIEW_ZOOM_PRESETS,
} from "./core/image/viewZoom";

import { rgbToCIELAB } from "./core/color/CIELAB";

const MENU_FILE_TYPES = ".png,.jpg,.jpeg,.gb7";

type PixelInfo = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  labL: number;
  labA: number;
  labB: number;
};

function App() {
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);

  const [statusMessage, setStatusMessage] = useState("Готов к работе");

  const [isDragOver, setIsDragOver] = useState(false);

  const [isImageLoading, setIsImageLoading] = useState(false);

  const [activeTool, setActiveTool] = useState<ToolType>("move");

  const [pixelInfo, setPixelInfo] = useState<PixelInfo | null>(null);

  const [imageModel, setImageModel] = useState<ImageModel | null>(null);

  const [channelPreviews, setChannelPreviews] = useState<ChannelPreview[]>([]);

  const [activeChannels, setActiveChannels] = useState<ActiveChannels>({
    red: true,
    green: true,
    blue: true,
    alpha: true,
  });

  const [scale, setScale] = useState(1);

  const [panX, setPanX] = useState(0);

  const [panY, setPanY] = useState(0);

  const [isLevelsOpen, setIsLevelsOpen] = useState(false);
  const [isKernelsOpen, setIsKernelsOpen] = useState(false);

  const [isScaleOpen, setIsScaleOpen] = useState(false);

  const [scaleDialogKey, setScaleDialogKey] = useState(0);

  const [zoomPresetKey, setZoomPresetKey] = useState(0);

  const [levelsSnapshot, setLevelsSnapshot] = useState<ImageModel | null>(null);

  const [levelsPreviewState, setLevelsPreviewState] =
    useState<LevelsState | null>(null);

  const [levelsPreviewEnabled, setLevelsPreviewEnabled] = useState(true);

  const [kernelsSnapshot, setKernelsSnapshot] = useState<ImageModel | null>(
    null
  );
  const [kernelsPreviewState, setKernelsPreviewState] =
    useState<KernelFilterStateWire | null>(null);
  const [kernelsPreviewEnabled, setKernelsPreviewEnabled] = useState(true);

  const [isDragging, setIsDragging] = useState(false);

  const [dragStart, setDragStart] = useState({
    x: 0,
    y: 0,
  });

  const menuRef = useRef<HTMLDivElement>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const [canvasImage, setCanvasImage] = useState<ImageData | null>(null);

  const renderJobRef = useRef(0);

  const toastMsg = useCallback((message: string, type: "success" | "error") => {
    if (type === "success") {
      toast.success(message);
    } else {
      toast.error(message);
    }
  }, []);

  useEffect(() => {
    if (!isLevelsOpen || !levelsSnapshot) {
      void imageWorkerClient.clearLevelsSource();
      return;
    }

    void imageWorkerClient.setLevelsSource(
      levelsSnapshot.getRawData(),
      levelsSnapshot.width,
      levelsSnapshot.height
    );

    return () => {
      void imageWorkerClient.clearLevelsSource();
    };
  }, [isLevelsOpen, levelsSnapshot]);

  useEffect(() => {
    if (!isKernelsOpen || !kernelsSnapshot) {
      void imageWorkerClient.clearKernelSource();
      return;
    }

    void imageWorkerClient.setKernelSource(
      kernelsSnapshot.getRawData(),
      kernelsSnapshot.width,
      kernelsSnapshot.height
    );

    return () => {
      void imageWorkerClient.clearKernelSource();
    };
  }, [isKernelsOpen, kernelsSnapshot]);

  useEffect(() => {
    if (!imageModel) {
      return;
    }

    const jobId = ++renderJobRef.current;
    let cancelled = false;

    const run = async () => {
      try {
        let pixels: Uint8ClampedArray;
        let width: number;
        let height: number;
        const meta = imageModel.meta;

        if (isLevelsOpen && levelsSnapshot) {
          if (!levelsPreviewEnabled) {
            pixels = new Uint8ClampedArray(levelsSnapshot.getRawData());
            width = levelsSnapshot.width;
            height = levelsSnapshot.height;
          } else if (levelsPreviewState) {
            const preview = await imageWorkerClient.applyLevelsPreview(
              levelsStateToWire(levelsPreviewState)
            );
            if (cancelled || jobId !== renderJobRef.current) {
              return;
            }
            pixels = preview.pixels;
            width = preview.width;
            height = preview.height;
          } else {
            pixels = new Uint8ClampedArray(levelsSnapshot.getRawData());
            width = levelsSnapshot.width;
            height = levelsSnapshot.height;
          }
        } else if (isKernelsOpen && kernelsSnapshot) {
          if (!kernelsPreviewEnabled) {
            pixels = new Uint8ClampedArray(kernelsSnapshot.getRawData());
            width = kernelsSnapshot.width;
            height = kernelsSnapshot.height;
          } else if (kernelsPreviewState) {
            const preview = await imageWorkerClient.applyKernelPreview(
              kernelsPreviewState
            );
            if (cancelled || jobId !== renderJobRef.current) {
              return;
            }
            pixels = preview.pixels;
            width = preview.width;
            height = preview.height;
          } else {
            pixels = new Uint8ClampedArray(kernelsSnapshot.getRawData());
            width = kernelsSnapshot.width;
            height = kernelsSnapshot.height;
          }
        } else {
          pixels = imageModel.getRawData();
          width = imageModel.width;
          height = imageModel.height;
        }

        const channelPixels = await imageWorkerClient.applyChannels(
          pixels,
          width,
          height,
          activeChannels
        );

        if (cancelled || jobId !== renderJobRef.current) {
          return;
        }

        const useCheckerboard =
          !isLevelsOpen &&
          width * height <= 512 * 512 &&
          imageModel.hasAlphaChannel() &&
          activeChannels.alpha;

        let imageData: ImageData;

        if (useCheckerboard) {
          const tempModel = new ImageModel(
            width,
            height,
            meta,
            channelPixels
          );
          imageData = ImageChannels.applyWithCheckerboard(
            tempModel,
            activeChannels
          );
        } else {
          imageData = new ImageData(
            new Uint8ClampedArray(channelPixels),
            width,
            height
          );
        }

        if (!cancelled && jobId === renderJobRef.current) {
          setCanvasImage(imageData);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled && jobId === renderJobRef.current) {
          toastMsg("Ошибка отрисовки изображения", "error");
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    imageModel,
    isLevelsOpen,
    levelsSnapshot,
    levelsPreviewState,
    levelsPreviewEnabled,
    isKernelsOpen,
    kernelsSnapshot,
    kernelsPreviewState,
    kernelsPreviewEnabled,
    activeChannels,
    toastMsg,
  ]);

  const applyFitViewZoom = useCallback((model: ImageModel) => {
    const container = containerRef.current;
    if (!container) {
      setScale(1);
      setPanX(0);
      setPanY(0);
      return;
    }

    const fitScale = computeFitViewZoom(
      model.width,
      model.height,
      container.clientWidth,
      container.clientHeight
    );

    setScale(fitScale);
    setPanX(0);
    setPanY(0);
  }, []);

  useEffect(() => {
    const close = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsFileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", close);

    return () => {
      document.removeEventListener("mousedown", close);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    const container = containerRef.current;

    if (!canvas || !container) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!canvasImage) {
      return;
    }

    ctx.save();

    ctx.translate(canvas.width / 2 + panX, canvas.height / 2 + panY);

    ctx.scale(scale, scale);

    const tempCanvas = document.createElement("canvas");

    tempCanvas.width = canvasImage.width;

    tempCanvas.height = canvasImage.height;

    const tempCtx = tempCanvas.getContext("2d");

    if (!tempCtx) {
      return;
    }

    tempCtx.putImageData(canvasImage, 0, 0);

    ctx.drawImage(
      tempCanvas,
      -canvasImage.width / 2,
      -canvasImage.height / 2
    );

    ctx.restore();
  }, [canvasImage, scale, panX, panY]);

  const handleImport = () => {
    if (isImageLoading) {
      return;
    }

    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }

    setIsFileMenuOpen(false);
  };

  const processFile = async (file: File) => {
    if (isImageLoading) {
      return;
    }

    setIsImageLoading(true);
    setCanvasImage(null);
    setStatusMessage(`Загрузка: ${file.name}`);

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    try {
      const model = await ImageFactory.load(file);

      setImageModel(model);
      setChannelPreviews([]);

      setStatusMessage(file.name);

      requestAnimationFrame(() => {
        applyFitViewZoom(model);
      });

      const previews = await imageWorkerClient.generatePreviews(model);
      setChannelPreviews(previews);

      toastMsg(`Загружен ${file.name}`, "success");
    } catch (error) {
      console.error(error);

      setStatusMessage("Готов к работе");
      toastMsg("Ошибка загрузки файла", "error");
    } finally {
      setIsImageLoading(false);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    await processFile(file);

    e.target.value = "";
  };

  const handleChannelToggle = (
    channel: keyof ActiveChannels | "grayscale"
  ) => {
    if (channel === "grayscale") {
      setActiveChannels((prev) => {
        const next = !(prev.red && prev.green && prev.blue);
        return {
          ...prev,
          red: next,
          green: next,
          blue: next,
        };
      });
      return;
    }

    setActiveChannels((prev) => ({
      ...prev,
      [channel]: !prev[channel],
    }));
  };

  const handleZoomChange = (e: ChangeEvent<HTMLInputElement>) => {
    setScale(clampViewZoom(parseFloat(e.target.value)));
  };

  const handleZoomPresetChange = (
    e: ChangeEvent<HTMLSelectElement>
  ) => {
    const value = parseFloat(e.target.value);
    if (!Number.isNaN(value)) {
      setScale(clampViewZoom(value));
      setZoomPresetKey((k) => k + 1);
    }
  };

  const handleWheelZoom = (e: WheelEvent<HTMLDivElement>) => {
    if (!canvasImage) {
      return;
    }

    e.preventDefault();

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;

    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? -0.1 : 0.1;

    let newScale = scale + delta;

    newScale = clampViewZoom(newScale);

    if (newScale === scale) {
      return;
    }

    const centerX = canvas.width / 2;

    const centerY = canvas.height / 2;

    const worldX = (mouseX - centerX - panX) / scale;

    const worldY = (mouseY - centerY - panY) / scale;

    const newPanX = mouseX - centerX - worldX * newScale;

    const newPanY = mouseY - centerY - worldY * newScale;

    setScale(newScale);
    setPanX(newPanX);
    setPanY(newPanY);
  };

  const resetZoom = () => {
    if (imageModel) {
      applyFitViewZoom(imageModel);
      toastMsg("Масштаб подогнан под холст", "success");
    } else {
      setScale(1);
      setPanX(0);
      setPanY(0);
    }
  };

  const openScaleDialog = () => {
    if (!imageModel) {
      toastMsg("Сначала загрузите изображение", "error");
      return;
    }

    setScaleDialogKey((k) => k + 1);
    setIsScaleOpen(true);
  };

  const closeScaleDialog = () => {
    setIsScaleOpen(false);
  };

  const handleScaleApply = async (result: ScaleDialogResult) => {
    if (!imageModel) {
      closeScaleDialog();
      return;
    }

    try {
      const pixels = await imageWorkerClient.resize(
        imageModel.getRawData(),
        imageModel.width,
        imageModel.height,
        result.width,
        result.height,
        result.methodId
      );

      const scaled = pixelsToImageModel(
        pixels,
        result.width,
        result.height,
        imageModel.meta
      );

      setImageModel(scaled);
      setChannelPreviews(
        await imageWorkerClient.generatePreviews(scaled)
      );
      closeScaleDialog();

      toastMsg(
        `Размер изменён: ${scaled.width}×${scaled.height}`,
        "success"
      );
    } catch (error) {
      console.error(error);
      toastMsg("Не удалось изменить размер", "error");
      throw error;
    }
  };

  const exportCanvas = (type: "png" | "jpg") => {
    if (!imageModel) {
      toastMsg("Нет изображения", "error");

      return;
    }

    const exportImage = ImageChannels.applyRaw(imageModel, activeChannels);

    const canvas = document.createElement("canvas");

    canvas.width = exportImage.width;

    canvas.height = exportImage.height;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.putImageData(exportImage, 0, 0);

    const link = document.createElement("a");

    link.href =
      type === "png"
        ? canvas.toDataURL("image/png")
        : canvas.toDataURL("image/jpeg", 0.92);

    link.download = `image.${type}`;

    link.click();

    toastMsg(`Сохранено как ${type.toUpperCase()}`, "success");
  };

  const exportAsGb7 = () => {
    if (!canvasImage) {
      toastMsg("Нет изображения", "error");

      return;
    }

    const gb7 = encodeGb7(canvasImage, false);

    const blob = new Blob([new Uint8Array(gb7)]);

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = "image.gb7";

    link.click();

    URL.revokeObjectURL(url);

    toastMsg("Сохранено как GB7", "success");
  };

  const openLevelsDialog = () => {
    if (!imageModel) {
      toastMsg("Сначала загрузите изображение", "error");
      return;
    }

    const snapshot = imageModel.clone();
    setLevelsSnapshot(snapshot);
    setLevelsPreviewState(createDefaultLevelsState());
    setLevelsPreviewEnabled(true);
    setIsLevelsOpen(true);
  };

  const openKernelsDialog = () => {
    if (!imageModel) {
      toastMsg("Сначала загрузите изображение", "error");
      return;
    }
    const snapshot = imageModel.clone();
    setKernelsSnapshot(snapshot);
    setKernelsPreviewState({
      filterType: "kernel",
      kernel3x3: [0, 0, 0, 0, 1, 0, 0, 0, 0],
      channels: {
        red: true,
        green: true,
        blue: true,
        alpha: imageModel.hasAlphaChannel(),
      },
      edgeHandling: "copy",
    });
    setKernelsPreviewEnabled(true);
    setIsKernelsOpen(true);
  };

  const closeLevelsDialog = () => {
    setIsLevelsOpen(false);
    setLevelsSnapshot(null);
    setLevelsPreviewState(null);
    setLevelsPreviewEnabled(true);
  };

  const closeKernelsDialog = () => {
    setIsKernelsOpen(false);
    setKernelsSnapshot(null);
    setKernelsPreviewState(null);
    setKernelsPreviewEnabled(true);
  };

  const handleLevelsPreviewChange = useCallback(
    (state: LevelsState, previewOn: boolean) => {
      setLevelsPreviewState(cloneLevelsState(state));
      setLevelsPreviewEnabled(previewOn);
    },
    []
  );

  const handleKernelsPreviewChange = useCallback(
    (state: KernelFilterStateWire, previewOn: boolean) => {
      setKernelsPreviewState({ ...state, channels: { ...state.channels } });
      setKernelsPreviewEnabled(previewOn);
    },
    []
  );

  const handleLevelsApply = async (state: LevelsState) => {
    if (!levelsSnapshot) {
      closeLevelsDialog();
      return;
    }

    try {
      const pixels = await imageWorkerClient.applyLevels(
        levelsSnapshot.getRawData(),
        levelsSnapshot.width,
        levelsSnapshot.height,
        levelsStateToWire(state)
      );

      const adjusted = pixelsToImageModel(
        pixels,
        levelsSnapshot.width,
        levelsSnapshot.height,
        levelsSnapshot.meta
      );

      setImageModel(adjusted);

      setChannelPreviews(
        await imageWorkerClient.generatePreviews(adjusted)
      );

      closeLevelsDialog();

      toastMsg("Уровни применены", "success");
    } catch (error) {
      console.error(error);
      toastMsg("Не удалось применить уровни", "error");
      throw error;
    }
  };

  const handleLevelsCancel = () => {
    closeLevelsDialog();
  };

  const handleKernelsApply = async (state: KernelFilterStateWire) => {
    if (!kernelsSnapshot) {
      closeKernelsDialog();
      return;
    }
    try {
      const pixels = await imageWorkerClient.applyKernel(
        kernelsSnapshot.getRawData(),
        kernelsSnapshot.width,
        kernelsSnapshot.height,
        state
      );
      const filtered = pixelsToImageModel(
        pixels,
        kernelsSnapshot.width,
        kernelsSnapshot.height,
        kernelsSnapshot.meta
      );
      setImageModel(filtered);
      setChannelPreviews(await imageWorkerClient.generatePreviews(filtered));
      closeKernelsDialog();
      toastMsg("Фильтр применён", "success");
    } catch (error) {
      console.error(error);
      toastMsg("Не удалось применить фильтр", "error");
      throw error;
    }
  };

  const handleKernelsCancel = () => {
    closeKernelsDialog();
  };

  const clearCanvas = () => {
    closeLevelsDialog();
    closeKernelsDialog();

    setImageModel(null);

    setCanvasImage(null);

    setPixelInfo(null);

    setScale(1);

    setPanX(0);

    setPanY(0);

    setChannelPreviews([]);

    setActiveChannels({
      red: true,
      green: true,
      blue: true,
      alpha: true,
    });

    toast.success("Холст очищен");

    setStatusMessage("Готов к работе");
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (activeTool === "move" && canvasImage && e.button === 0) {
      setIsDragging(true);

      setDragStart({
        x: e.clientX - panX,
        y: e.clientY - panY,
      });

      e.preventDefault();
    }
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isDragging && activeTool === "move") {
      setPanX(e.clientX - dragStart.x);

      setPanY(e.clientY - dragStart.y);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== "eyedropper") {
      return;
    }

    const model =
      isLevelsOpen && levelsSnapshot ? levelsSnapshot : imageModel;

    if (!model || !canvasImage) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;

    const scaleY = canvas.height / rect.height;

    const canvasX = (e.clientX - rect.left) * scaleX;

    const canvasY = (e.clientY - rect.top) * scaleY;

    const transformedX = (canvasX - canvas.width / 2 - panX) / scale;

    const transformedY = (canvasY - canvas.height / 2 - panY) / scale;

    const coordScaleX = model.width / canvasImage.width;
    const coordScaleY = model.height / canvasImage.height;

    const imageX = Math.floor(
      transformedX * coordScaleX + model.width / 2
    );

    const imageY = Math.floor(
      transformedY * coordScaleY + model.height / 2
    );

    if (
      imageX < 0 ||
      imageY < 0 ||
      imageX >= model.width ||
      imageY >= model.height
    ) {
      return;
    }

    const pixel = model.getPixel(imageX, imageY);
    const lab = rgbToCIELAB(pixel.r, pixel.g, pixel.b);

    setPixelInfo({
      x: imageX,
      y: imageY,
      r: pixel.r,
      g: pixel.g,
      b: pixel.b,
      labL: lab.L,
      labA: lab.a,
      labB: lab.b,
    });
  };

  return (
    <div className="app">
      <nav className="top-navbar">
        <div className="menu-container" ref={menuRef}>
          <button
            className="menu-button"
            onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
          >
            Файл
          </button>

          {isFileMenuOpen && (
            <div className="dropdown-menu">
              <button onClick={handleImport} className="dropdown-item">
                Импорт
              </button>

              <button
                onClick={() => exportCanvas("png")}
                className="dropdown-item"
              >
                Экспорт PNG
              </button>

              <button
                onClick={() => exportCanvas("jpg")}
                className="dropdown-item"
              >
                Экспорт JPG
              </button>

              <button onClick={exportAsGb7} className="dropdown-item">
                Экспорт GB7
              </button>

              <div className="dropdown-divider" />

              <button
                onClick={clearCanvas}
                className="dropdown-item clear-item"
              >
                Очистить холст
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="workspace">
        <input
          ref={inputRef}
          type="file"
          accept={MENU_FILE_TYPES}
          onChange={handleFileChange}
          className="visually-hidden"
        />

        <div className="workspace__container">
          <ToolsBar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            pixelInfo={pixelInfo}
            activeChannels={activeChannels}
            onChannelToggle={handleChannelToggle}
            channelPreviews={channelPreviews}
            hasImage={!!imageModel}
            hasAlphaChannel={imageModel?.hasAlphaChannel() ?? false}
            isGb7Image={imageModel?.meta.format === "gb7"}
            onLevelsClick={openLevelsDialog}
            onKernelsClick={openKernelsDialog}
            onScaleClick={openScaleDialog}
          />

          <div className="workspace__content">
            <section
              ref={containerRef}
              className={`canvas-area ${
                isDragOver ? "canvas-area--drag-over" : ""
              } ${isImageLoading ? "canvas-area--loading" : ""}`}
              onDragOver={(e) => {
                if (isImageLoading) {
                  return;
                }
                e.preventDefault();

                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();

                setIsDragOver(false);

                if (isImageLoading) {
                  return;
                }

                const file = e.dataTransfer.files?.[0];

                if (file) {
                  void processFile(file);
                }
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheelZoom}
              style={{
                cursor:
                  activeTool === "move" && canvasImage
                    ? isDragging
                      ? "grabbing"
                      : "grab"
                    : "default",
              }}
            >
              <canvas
                ref={canvasRef}
                className="image-canvas"
                onClick={handleCanvasClick}
              />

              {!imageModel && !isImageLoading && (
                <div className="placeholder">Загрузите изображение</div>
              )}

              {isImageLoading && (
                <DialogApplyOverlay message="Загрузка изображения…" />
              )}
            </section>
          </div>
        </div>
      </main>

      {/* ПОЛНЫЙ ФУТЕР С ПРАВИЛЬНЫМ ОТОБРАЖЕНИЕМ ГЛУБИНЫ ЦВЕТА */}
      <footer className="status-bar">
        <div className="status-left">{statusMessage}</div>

        <div className="status-right">
          {imageModel ? (
            <div className="status-controls">
              <span className="status-dimensions">
                {imageModel.width}×{imageModel.height}
              </span>

              <span className="separator">|</span>

              <span className="status-depth">{imageModel.meta.bitDepth}</span>

              <span className="separator">|</span>

              <span className="status-channel">
                Каналы:{" "}
                {ImageChannels.getActiveChannelNames(
                  activeChannels,
                  imageModel.hasAlphaChannel(),
                  imageModel.meta.format === "gb7"
                )}
              </span>

              <span className="separator">|</span>

              <span className="status-zoom">
                Масштаб: {Math.round(scale * 100)}%
              </span>

              <select
                key={zoomPresetKey}
                className="zoom-preset-select"
                defaultValue=""
                onChange={handleZoomPresetChange}
                title="Быстрый выбор масштаба"
              >
                <option value="" disabled>
                  Пресет
                </option>
                {VIEW_ZOOM_PRESETS.map((preset) => (
                  <option key={preset.label} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>

              <input
                type="range"
                min={VIEW_ZOOM_MIN}
                max={VIEW_ZOOM_MAX}
                step="0.01"
                value={scale}
                onChange={handleZoomChange}
                className="zoom-slider"
              />

              <button onClick={resetZoom} className="reset-btn">
                Вписать
              </button>
            </div>
          ) : (
            "Нет изображения"
          )}
        </div>
      </footer>

      {imageModel && levelsSnapshot && (
        <LevelsDialog
          open={isLevelsOpen}
          sourceImage={levelsSnapshot}
          hasAlpha={imageModel.hasAlphaChannel()}
          onApply={handleLevelsApply}
          onCancel={handleLevelsCancel}
          onPreviewChange={handleLevelsPreviewChange}
        />
      )}

      {imageModel && kernelsSnapshot && (
        <KernelsDialog
          open={isKernelsOpen}
          hasAlpha={imageModel.hasAlphaChannel()}
          onApply={handleKernelsApply}
          onCancel={handleKernelsCancel}
          onPreviewChange={handleKernelsPreviewChange}
        />
      )}

      {imageModel && (
        <ScaleDialog
          key={scaleDialogKey}
          open={isScaleOpen}
          sourceImage={imageModel}
          onApply={handleScaleApply}
          onCancel={closeScaleDialog}
        />
      )}

      <Toaster position="bottom-left" />
    </div>
  );
}

export default App;
