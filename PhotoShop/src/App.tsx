import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import './App.css';
import { encodeGb7 } from './coder';
import { decodeGb7 } from './decoder';
import { Toaster, toast } from 'react-hot-toast';
import { ToolsBar, type ToolType } from './ToolsBar';

const MENU_FILE_TYPES = '.png,.jpg,.jpeg,.gb7';

type SourceFormat = 'png' | 'jpg' | 'gb7';

type SourceMeta = {
  width: number;
  height: number;
  depth: string;
  format: SourceFormat;
  hasMask?: boolean;
};

type PixelInfo = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
};

function detectFormat(fileName: string): SourceFormat | null {
  const f = fileName.toLowerCase();
  if (f.endsWith('.png')) return 'png';
  if (f.endsWith('.jpg') || f.endsWith('.jpeg')) return 'jpg';
  if (f.endsWith('.gb7')) return 'gb7';
  return null;
}

function App() {
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [sourceMeta, setSourceMeta] = useState<SourceMeta | null>(null);
  const [statusMessage, setStatusMessage] = useState('Готов к работе');
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolType>('move');
  const [pixelInfo, setPixelInfo] = useState<PixelInfo | null>(null);
  
  // Zoom and pan states
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [image, setImage] = useState<HTMLImageElement | ImageData | null>(null);
  const [originalImageData, setOriginalImageData] = useState<ImageData | null>(null);

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

  // Redraw canvas when scale/pan changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to container size
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // If no image, just return
    if (!image) return;
    
    // Save context state
    ctx.save();
    
    // Apply transformations
    ctx.translate(canvas.width / 2 + panX, canvas.height / 2 + panY);
    ctx.scale(scale, scale);
    
    // Draw image centered at origin
    if (image instanceof ImageData) {
      // For ImageData
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = image.width;
      tempCanvas.height = image.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.putImageData(image, 0, 0);
        ctx.drawImage(tempCanvas, -image.width / 2, -image.height / 2);
      }
    } else if (image instanceof HTMLImageElement) {
      // For HTMLImageElement
      ctx.drawImage(image, -image.width / 2, -image.height / 2);
    }
    
    ctx.restore();
  }, [scale, panX, panY, image]);

  const updateImageOnCanvas = (imgData: HTMLImageElement | ImageData) => {
    setImage(imgData);
    // Reset zoom and pan when new image is loaded
    setScale(1);
    setPanX(0);
    setPanY(0);
  };

  const handleZoomChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newScale = parseFloat(e.target.value);
    setScale(newScale);
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
        
        // Store ImageData for zoom/pan
        updateImageOnCanvas(imageData);
        
        setSourceMeta({
          width: imageData.width,
          height: imageData.height,
          depth: 'GB7',
          format,
        });

        toastMsg('GB7 файл загружен', 'success');
        setStatusMessage(`Загружен ${file.name}`);
        return;
      }

      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        // Store HTMLImageElement for zoom/pan
        updateImageOnCanvas(img);
        
        setSourceMeta({
          width: img.width,
          height: img.height,
          depth: format === 'png' ? 'RGBA' : 'RGB',
          format,
        });

        toastMsg(`Загружен ${format.toUpperCase()}`, 'success');
        setStatusMessage(`Загружен ${file.name}`);

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

    // Create temporary canvas for export without transformations
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
    // Check if canvas is already empty
    if (!image && !sourceMeta) {
      toast.error('холст пуст');
      setStatusMessage('Холст пуст');
      setIsFileMenuOpen(false);
      return;
    }
  
    // Clear all states
    setSourceMeta(null);
    setPixelInfo(null);
    setImage(null);
    setOriginalImageData(null);
    setScale(1);
    setPanX(0);
    setPanY(0);
    
    // Clear the canvas element
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  
    toast.success('Холст очищен');
    setStatusMessage('Холст очищен');
    setIsFileMenuOpen(false);
  };

  // Handle mouse down for panning (only when move tool is active)
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'move' && image && e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
      e.preventDefault();
    }
  };

  // Handle mouse move for panning
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isDragging && activeTool === 'move' && image) {
      setPanX(e.clientX - dragStart.x);
      setPanY(e.clientY - dragStart.y);
    }
  };

  // Handle mouse up to stop panning
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

    // Transform canvas coordinates to image coordinates
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
      // Get pixel color
      let ctx: CanvasRenderingContext2D | null = null;
      if (image instanceof HTMLImageElement) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = imgHeight;
        ctx = tempCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(image, 0, 0);
        }
      } else if (image instanceof ImageData) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = imgHeight;
        ctx = tempCanvas.getContext('2d');
        if (ctx) {
          ctx.putImageData(image, 0, 0);
        }
      }

      if (ctx) {
        const [r, g, b] = ctx.getImageData(imageX, imageY, 1, 1).data;
        setPixelInfo({ x: imageX, y: imageY, r, g, b });
      }
    }
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
              <button onClick={handleImport} className="dropdown-item">Импорт</button>
              <button onClick={() => exportCanvas('png')} className="dropdown-item">PNG</button>
              <button onClick={() => exportCanvas('jpg')} className="dropdown-item">JPG</button>
              <button onClick={exportAsGb7} className="dropdown-item">GB7</button>
              <div className="dropdown-divider" />
              <button onClick={clearCanvas} className="dropdown-item clear-item">Очистить</button>
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
          />

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
            style={{ cursor: activeTool === 'move' && image ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          >
            <canvas ref={canvasRef} className="image-canvas" onClick={handleCanvasClick} />
            {!sourceMeta && <div className="placeholder">Загрузите изображение или перетащите его на холст</div>}
          </section>
        </div>
      </main>

      <footer className="status-bar">
        <div className="status-left">{statusMessage}</div>
        <div className="status-right">
          {sourceMeta ? (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span>{sourceMeta.width}×{sourceMeta.height}</span>
              <span>|</span>
              <span>Зум: {Math.round(scale * 100)}%</span>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.01"
                value={scale}
                onChange={handleZoomChange}
                style={{ width: '120px' }}
                title="Масштаб"
              />
              <button
                onClick={resetZoom}
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  backgroundColor: '#3c3c3c',
                  color: '#e0e0e0',
                  border: '1px solid #555',
                  borderRadius: '4px'
                }}
                title="Сбросить масштаб и позицию"
              >
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