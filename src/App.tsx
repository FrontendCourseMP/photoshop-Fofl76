import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent, WheelEvent } from 'react';
import './App.css';
import { decodeGb7, encodeGb7 } from './coder';
import { Toaster, toast } from 'react-hot-toast';
import { ToolsBar, type ToolType, type ActiveChannels } from './ToolsBar';

const MENU_FILE_TYPES = '.png,.jpg,.jpeg,.gb7';

type SourceFormat = 'png' | 'jpg' | 'gb7';

type SourceMeta = {
  width: number;
  height: number;
  depth: string;
  format: SourceFormat;
  bitDepth?: string;
  colorType?: string;
  hasMask?: boolean;
};

type PixelInfo = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
};

type ChannelPreview = {
  mode: string;
  imageData: ImageData;
  previewUrl: string;
};

function detectFormat(fileName: string): SourceFormat | null {
  const f = fileName.toLowerCase();
  if (f.endsWith('.png')) return 'png';
  if (f.endsWith('.jpg') || f.endsWith('.jpeg')) return 'jpg';
  if (f.endsWith('.gb7')) return 'gb7';
  return null;
}

function analyzeImageDepth(imageData: ImageData): { bitDepth: string; colorType: string } {
  const { data } = imageData;
  let isGrayscale = true;
  let hasAlpha = false;
  let maxChannelValue = 0;
  let minChannelValue = 255;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    if (r !== g || g !== b) {
      isGrayscale = false;
    }
    
    if (a < 255) {
      hasAlpha = true;
    }
    
    maxChannelValue = Math.max(maxChannelValue, r, g, b);
    minChannelValue = Math.min(minChannelValue, r, g, b);
  }
  
  let bitDepth = '8-bit';
  let colorType = isGrayscale ? 'Grayscale' : 'RGB';
  
  if (maxChannelValue <= 1) {
    bitDepth = '1-bit';
  } else if (maxChannelValue <= 3) {
    bitDepth = '2-bit';
  } else if (maxChannelValue <= 7) {
    bitDepth = '3-bit';
  } else if (maxChannelValue <= 15) {
    bitDepth = '4-bit';
  } else if (maxChannelValue <= 31) {
    bitDepth = '5-bit';
  } else if (maxChannelValue <= 63) {
    bitDepth = '6-bit';
  } else if (maxChannelValue <= 127) {
    bitDepth = '7-bit';
  }
  
  if (minChannelValue === 0 && maxChannelValue === 127 && !hasAlpha) {
    bitDepth = '7-bit grayscale';
    colorType = 'Grayscale';
  } else if (minChannelValue === 0 && maxChannelValue === 127 && hasAlpha) {
    bitDepth = '7-bit gray + mask';
    colorType = 'Grayscale with Mask';
  } else if (hasAlpha) {
    colorType += ' + Alpha';
  }
  
  return { bitDepth, colorType };
}

function App() {
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [sourceMeta, setSourceMeta] = useState<SourceMeta | null>(null);
  const [statusMessage, setStatusMessage] = useState('Готов к работе');
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolType>('move');
  const [pixelInfo, setPixelInfo] = useState<PixelInfo | null>(null);
  
  // Активные каналы
  const [activeChannels, setActiveChannels] = useState<ActiveChannels>({
    red: true,
    green: true,
    blue: true,
    alpha: true,
  });
  
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [image, setImage] = useState<HTMLImageElement | ImageData | null>(null);
  const [originalImageData, setOriginalImageData] = useState<ImageData | null>(null);
  const [rawImageData, setRawImageData] = useState<ImageData | null>(null);
  const [channelPreviews, setChannelPreviews] = useState<ChannelPreview[]>([]);
  const [hasAlphaChannel, setHasAlphaChannel] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toastMsg = (m: string, t: 'success' | 'error') =>
    t === 'success' ? toast.success(m) : toast.error(m);

  useEffect(() => {
    const close = (e: any) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsFileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Функция для применения активных каналов к изображению
  const applyActiveChannels = (imageData: ImageData, channels: ActiveChannels): ImageData => {
    const { data, width, height } = imageData;
    const newImageData = new ImageData(width, height);
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      // Применяем каждый канал в зависимости от того, включен ли он
      let finalR = channels.red ? r : 0;
      let finalG = channels.green ? g : 0;
      let finalB = channels.blue ? b : 0;
      let finalA = channels.alpha ? a : 255;
      
      // Если все RGB каналы выключены, показываем черный цвет
      if (!channels.red && !channels.green && !channels.blue) {
        finalR = finalG = finalB = 0;
      }
      
      newImageData.data[i] = finalR;
      newImageData.data[i + 1] = finalG;
      newImageData.data[i + 2] = finalB;
      newImageData.data[i + 3] = finalA;
    }
    
    return newImageData;
  };

  const getImageDataFromImage = (img: HTMLImageElement | ImageData): ImageData | null => {
    if (img instanceof ImageData) {
      return img;
    } else if (img instanceof HTMLImageElement) {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height);
      }
    }
    return null;
  };

  const generateChannelPreviews = (imageData: ImageData) => {
    const channels = ['red', 'green', 'blue', 'alpha'];
    const previews: ChannelPreview[] = [];
    
    const previewHeight = 80;
    const previewWidth = Math.round((imageData.width / imageData.height) * previewHeight);
    
    channels.forEach(channel => {
      let processedFull: ImageData;
      
      if (channel === 'alpha') {
        // Для альфа-канала создаем превью на основе прозрачности
        const { data, width, height } = imageData;
        processedFull = new ImageData(width, height);
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          processedFull.data[i] = alpha;
          processedFull.data[i + 1] = alpha;
          processedFull.data[i + 2] = alpha;
          processedFull.data[i + 3] = 255;
        }
      } else {
        const tempChannels: ActiveChannels = {
          red: channel === 'red',
          green: channel === 'green',
          blue: channel === 'blue',
          alpha: true
        };
        processedFull = applyActiveChannels(imageData, tempChannels);
      }
      
      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = previewWidth;
      previewCanvas.height = previewHeight;
      const previewCtx = previewCanvas.getContext('2d');
      
      if (previewCtx) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.putImageData(processedFull, 0, 0);
          previewCtx.drawImage(tempCanvas, 0, 0, imageData.width, imageData.height, 0, 0, previewWidth, previewHeight);
          
          const previewUrl = previewCanvas.toDataURL();
          previews.push({ mode: channel, imageData: processedFull, previewUrl });
        }
      }
    });
    
    channelPreviews.forEach(preview => {
      if (preview.previewUrl) {
        URL.revokeObjectURL(preview.previewUrl);
      }
    });
    
    setChannelPreviews(previews);
  };

  const updateDisplayImage = () => {
    if (!originalImageData) return;
    
    const processedData = applyActiveChannels(originalImageData, activeChannels);
    setImage(processedData);
  };

  const handleChannelToggle = (channel: keyof ActiveChannels) => {
    setActiveChannels(prev => ({
      ...prev,
      [channel]: !prev[channel]
    }));
  };

  // Обновляем отображение при изменении активных каналов
  useEffect(() => {
    if (originalImageData) {
      updateDisplayImage();
    }
  }, [activeChannels, originalImageData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!image) return;
    
    ctx.save();
    
    ctx.translate(canvas.width / 2 + panX, canvas.height / 2 + panY);
    ctx.scale(scale, scale);
    
    if (image instanceof ImageData) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = image.width;
      tempCanvas.height = image.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.putImageData(image, 0, 0);
        ctx.drawImage(tempCanvas, -image.width / 2, -image.height / 2);
      }
    } else if (image instanceof HTMLImageElement) {
      ctx.drawImage(image, -image.width / 2, -image.height / 2);
    }
    
    ctx.restore();
  }, [scale, panX, panY, image]);

  const updateImageOnCanvas = (imgData: HTMLImageElement | ImageData) => {
    const original = getImageDataFromImage(imgData);
    if (original) {
      // Сохраняем копию оригинальных данных
      const rawCopy = new ImageData(
        new Uint8ClampedArray(original.data),
        original.width,
        original.height
      );
      setRawImageData(rawCopy);
      
      let hasAlpha = false;
      for (let i = 3; i < original.data.length; i += 4) {
        if (original.data[i] < 255) {
          hasAlpha = true;
          break;
        }
      }
      setHasAlphaChannel(hasAlpha);
      
      // Если нет альфа-канала, отключаем его в активных каналах
      if (!hasAlpha && activeChannels.alpha) {
        setActiveChannels(prev => ({ ...prev, alpha: false }));
      }
      
      const { bitDepth, colorType } = analyzeImageDepth(original);
      
      setOriginalImageData(original);
      generateChannelPreviews(original);
      
      // Применяем активные каналы
      const processedData = applyActiveChannels(original, activeChannels);
      setImage(processedData);
      
      setSourceMeta({
        width: original.width,
        height: original.height,
        depth: 'RGB',
        format: 'png',
        bitDepth,
        colorType
      });
    } else {
      setImage(imgData);
      setOriginalImageData(null);
      setRawImageData(null);
      setHasAlphaChannel(false);
    }
    setScale(1);
    setPanX(0);
    setPanY(0);
  };

  const handleZoomChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newScale = parseFloat(e.target.value);
    setScale(newScale);
  };

  const handleWheelZoom = (e: WheelEvent<HTMLDivElement>) => {
    if (!image) return;

    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    let newScale = scale + delta;

    newScale = Math.min(Math.max(newScale, 0.1), 5);
    
    if (newScale === scale) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const mouseXInCanvas = mouseX;
    const mouseYInCanvas = mouseY;
    
    const worldX = (mouseXInCanvas - centerX - panX) / scale;
    const worldY = (mouseYInCanvas - centerY - panY) / scale;
    
    const newPanX = mouseXInCanvas - centerX - worldX * newScale;
    const newPanY = mouseYInCanvas - centerY - worldY * newScale;
    
    setScale(newScale);
    setPanX(newPanX);
    setPanY(newPanY);
  };

  const resetZoom = () => {
    setScale(1);
    setPanX(0);
    setPanY(0);
    toastMsg('Масштаб и позиция сброшены', 'success');
  };

  const handleImport = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
    setIsFileMenuOpen(false);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await processFile(file);
    e.target.value = '';
  };

  const processFile = async (file: File) => {
    const format = detectFormat(file.name);
    if (!format) {
      toastMsg('Неподдерживаемый формат', 'error');
      return;
    }

    try {
      if (format === 'gb7') {
        const buffer = await file.arrayBuffer();
        const { imageData } = decodeGb7(buffer);
        
        updateImageOnCanvas(imageData);
        
        setStatusMessage(file.name);
        return;
      }

      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        updateImageOnCanvas(img);
        toastMsg(`Загружен ${format.toUpperCase()}`, 'success');
        setStatusMessage(file.name);
        URL.revokeObjectURL(url);
      };

      img.onerror = () => {
        toastMsg('Ошибка загрузки изображения', 'error');
      };

      img.src = url;
    } catch {
      toastMsg('Ошибка загрузки файла', 'error');
    }
  };

  const exportCanvas = (type: 'png' | 'jpg') => {
    if (!image) {
      toastMsg('Нет изображения', 'error');
      return;
    }

    const exportCanvas = document.createElement('canvas');
    if (image instanceof HTMLImageElement) {
      exportCanvas.width = image.width;
      exportCanvas.height = image.height;
      const ctx = exportCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, 0, 0);
      }
    } else if (image instanceof ImageData) {
      exportCanvas.width = image.width;
      exportCanvas.height = image.height;
      const ctx = exportCanvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(image, 0, 0);
      }
    }

    const link = document.createElement('a');
    link.href =
      type === 'png'
        ? exportCanvas.toDataURL('image/png')
        : exportCanvas.toDataURL('image/jpeg', 0.92);

    link.download = `image.${type}`;
    link.click();

    toastMsg(`Сохранено как ${type.toUpperCase()}`, 'success');
    setStatusMessage(`Экспорт: ${type.toUpperCase()}`);
    setIsFileMenuOpen(false);
  };

  const exportAsGb7 = () => {
    if (!image) {
      toastMsg('Нет изображения', 'error');
      return;
    }

    let imageData: ImageData;
    
    if (image instanceof HTMLImageElement) {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        toastMsg('Ошибка canvas', 'error');
        return;
      }
      ctx.drawImage(image, 0, 0);
      imageData = ctx.getImageData(0, 0, image.width, image.height);
    } else if (image instanceof ImageData) {
      imageData = image;
    } else {
      toastMsg('Нет изображения', 'error');
      return;
    }

    const gb7 = encodeGb7(imageData, false);

    const blob = new Blob([gb7]);
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'image.gb7';
    a.click();

    URL.revokeObjectURL(url);

    toastMsg('Сохранено как GB7', 'success');
    setStatusMessage('Экспорт GB7');
    setIsFileMenuOpen(false);
  };

  const clearCanvas = () => {
    if (!image && !sourceMeta) {
      toast.error('холст пуст');
      setIsFileMenuOpen(false);
      return;
    }
  
    setSourceMeta(null);
    setPixelInfo(null);
    setImage(null);
    setOriginalImageData(null);
    setRawImageData(null);
    setActiveChannels({ red: true, green: true, blue: true, alpha: true });
    setScale(1);
    setPanX(0);
    setPanY(0);
    setChannelPreviews([]);
    setHasAlphaChannel(false);
    
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  
    toast.success('Холст очищен');
    setStatusMessage('Готов к работе');
    setIsFileMenuOpen(false);
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'move' && image && e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isDragging && activeTool === 'move' && image) {
      setPanX(e.clientX - dragStart.x);
      setPanY(e.clientY - dragStart.y);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'eyedropper') return;

    if (!image) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    const transformedX = (canvasX - canvas.width / 2 - panX) / scale;
    const transformedY = (canvasY - canvas.height / 2 - panY) / scale;

    let imgWidth: number, imgHeight: number;
    if (image instanceof HTMLImageElement) {
      imgWidth = image.width;
      imgHeight = image.height;
    } else {
      imgWidth = image.width;
      imgHeight = image.height;
    }

    const imageX = Math.floor(transformedX + imgWidth / 2);
    const imageY = Math.floor(transformedY + imgHeight / 2);

    if (imageX >= 0 && imageX < imgWidth && imageY >= 0 && imageY < imgHeight) {
      // Всегда используем оригинальные данные изображения
      let sourceImageData: ImageData | null = rawImageData || originalImageData;
      
      if (sourceImageData) {
        const idx = (imageY * imgWidth + imageX) * 4;
        const r = sourceImageData.data[idx];
        const g = sourceImageData.data[idx + 1];
        const b = sourceImageData.data[idx + 2];
        setPixelInfo({ x: imageX, y: imageY, r, g, b });
      }
    }
  };

  const getActiveChannelNames = () => {
    const names = [];
    if (activeChannels.red) names.push('R');
    if (activeChannels.green) names.push('G');
    if (activeChannels.blue) names.push('B');
    if (activeChannels.alpha && hasAlphaChannel) names.push('A');
    return names.join('');
  };

  return (
    <div className="app">
      <nav className="top-navbar">
        <div className="menu-container" ref={menuRef}>
          <button className="menu-button" onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}>
            Файл
          </button>

          {isFileMenuOpen && (
            <div className="dropdown-menu">
              <button onClick={handleImport} className="dropdown-item">Импорт изображение</button>
              <button onClick={() => exportCanvas('png')} className="dropdown-item">Экспорт PNG</button>
              <button onClick={() => exportCanvas('jpg')} className="dropdown-item">Экспорт JPG</button>
              <button onClick={exportAsGb7} className="dropdown-item">Экспорт GB7</button>
              <div className="dropdown-divider" />
              <button onClick={clearCanvas} className="dropdown-item clear-item">Очистить холст</button>
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
            pixelInfo={pixelInfo as any}
            activeChannels={activeChannels}
            onChannelToggle={handleChannelToggle}
            channelPreviews={channelPreviews}
            hasImage={!!sourceMeta}
            hasAlphaChannel={hasAlphaChannel}
          />

          <div className="workspace__content">
            <section
              ref={containerRef}
              className={`canvas-area ${isDragOver ? 'canvas-area--drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) {
                  processFile(f);
                }
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheelZoom}
              style={{ cursor: activeTool === 'move' && image ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            >
              <canvas ref={canvasRef} className="image-canvas" onClick={handleCanvasClick} />
              {!sourceMeta && <div className="placeholder">Загрузите изображение или перетащите его на холст</div>}
            </section>
          </div>
        </div>
      </main>

      <footer className="status-bar">
        <div className="status-left">{statusMessage}</div>
        <div className="status-right">
          {sourceMeta ? (
            <div className="status-controls">
              <span className="status-dimensions">{sourceMeta.width}×{sourceMeta.height}</span>
              <span className="separator">|</span>
              <span className="status-depth" title="Глубина цвета">
                {sourceMeta.bitDepth || sourceMeta.depth}
                {sourceMeta.colorType && !sourceMeta.colorType.includes('Mask') && ` • ${sourceMeta.colorType}`}
                {sourceMeta.colorType && sourceMeta.colorType.includes('Mask') && ` • ${sourceMeta.colorType}`}
              </span>
              <span className="separator">|</span>
              <span className="status-channel">Каналы: {getActiveChannelNames() || 'none'}</span>
              <span className="separator">|</span>
              <span className="status-zoom">Зум: {Math.round(scale * 100)}%</span>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.01"
                value={scale}
                onChange={handleZoomChange}
                className="zoom-slider"
                title="Масштаб"
              />
              <button onClick={resetZoom} className="reset-btn" title="Сбросить масштаб и позицию">
                Сброс
              </button>
            </div>
          ) : 'Нет изображения'}
        </div>
      </footer>

      <Toaster position="bottom-left" />
    </div>
  );
}

export default App;