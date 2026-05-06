import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, MouseEvent } from 'react';
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

function drawImageOnCanvas(canvas: HTMLCanvasElement, imageData: ImageData) {
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.putImageData(imageData, 0, 0);
}

function App() {
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [sourceMeta, setSourceMeta] = useState<SourceMeta | null>(null);
  const [statusMessage, setStatusMessage] = useState('Готов к работе');
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolType>('move');
  const [pixelInfo, setPixelInfo] = useState<PixelInfo | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const canvas = canvasRef.current;
    if (!canvas) {
      toastMsg('Canvas не найден', 'error');
      return;
    }

    try {
      if (format === 'gb7') {
        const buffer = await file.arrayBuffer();
        const { imageData } = decodeGb7(buffer);
        drawImageOnCanvas(canvas, imageData);

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
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          toastMsg('Ошибка canvas', 'error');
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

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
    const canvas = canvasRef.current;
    if (!canvas) {
      toastMsg('Нет изображения', 'error');
      return;
    }

    const link = document.createElement('a');
    link.href =
      type === 'png'
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', 0.92);

    link.download = `image.${type}`;
    link.click();

    toastMsg(`Сохранено как ${type.toUpperCase()}`, 'success');
    setStatusMessage(`Экспорт: ${type.toUpperCase()}`);
    setIsFileMenuOpen(false);
  };

  const exportAsGb7 = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      toastMsg('Нет изображения', 'error');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toastMsg('Ошибка canvas', 'error');
      return;
    }

    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const gb7 = encodeGb7(img, false);

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
    const canvas = canvasRef.current;
  
    if (!canvas || !sourceMeta) {
      toastMsg('Холст пуст', 'error'); // крестик
      return;
    }
  
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  
    canvas.width = 0;
    canvas.height = 0;
  
    setSourceMeta(null);
    setPixelInfo(null);
  
    toastMsg('Холст очищен', 'success');
    setStatusMessage('Холст очищен');
    setIsFileMenuOpen(false);
  };

  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'eyedropper') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
    setPixelInfo({ x, y, r, g, b });

    
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
            className={`canvas-area ${isDragOver ? 'canvas-area--drag-over' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) {
                processFile(f);
              }
            }}
          >
            <canvas ref={canvasRef} className="image-canvas" onClick={handleCanvasClick} />
            {!sourceMeta && <div className="placeholder">Загрузите изображение или перетащите его на холст</div>}
          </section>
        </div>
      </main>

      <footer className="status-bar">
        <span>{statusMessage}</span>
        <span>
          {sourceMeta
            ? `${sourceMeta.width}×${sourceMeta.height}`
            : 'Нет изображения'}
        </span>
      </footer>

      <Toaster position="bottom-left" />
    </div>
  );
}

export default App;