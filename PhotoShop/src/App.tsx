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
  const normalized = fileName.toLowerCase();
  if (normalized.endsWith('.png')) return 'png';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'jpg';
  if (normalized.endsWith('.gb7')) return 'gb7';
  return null;
}

function drawImageOnCanvas(canvas: HTMLCanvasElement, imageData: ImageData): void {
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.putImageData(imageData, 0, 0);
}

function App() {
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [sourceMeta, setSourceMeta] = useState<SourceMeta | null>(null);
  const [statusMessage, setStatusMessage] = useState('Готов к работе. Откройте файл через меню "Файл".');
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolType>('move');
  const [pixelInfo, setPixelInfo] = useState<PixelInfo | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    if (type === 'success') {
      toast.success(message, { duration: 2000 });
      return;
    }
    toast.error(message, { duration: 2000 });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsFileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Обработчик клика по canvas для пипетки
  const handleCanvasClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'eyedropper') return;
    if (!canvasRef.current || !sourceMeta) {
      const message = 'Нет загруженного изображения.';
      setStatusMessage(message);
      showToast(message, 'error');
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Координаты клика относительно canvas (с учётом масштаба отображения)
    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;

    // Проверяем границы изображения
    if (mouseX < 0 || mouseX >= canvas.width || mouseY < 0 || mouseY >= canvas.height) {
      const message = 'Клик вне области изображения.';
      setStatusMessage(message);
      showToast(message, 'error');
      return;
    }

    const x = Math.floor(mouseX);
    const y = Math.floor(mouseY);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Считываем пиксель
    const imageData = ctx.getImageData(x, y, 1, 1);
    const [r, g, b] = imageData.data;

    setPixelInfo({ x, y, r, g, b });

    const message = `Пипетка: RGB(${r},${g},${b})`;
    setStatusMessage(message);
    showToast(message, 'success');
  };

  const handleImport = () => {
    inputRef.current?.click();
    setIsFileMenuOpen(false);
  };

  const exportAsPng = () => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceMeta) {
      const message = 'Нет изображения для экспорта.';
      setStatusMessage(message);
      showToast(message, 'error');
      setIsFileMenuOpen(false);
      return;
    }

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'image.png';
    link.click();
    const message = 'Изображение сохранено в формате PNG.';
    setStatusMessage(message);
    showToast(message, 'success');
    setIsFileMenuOpen(false);
  };

  const exportAsJpg = () => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceMeta) {
      const message = 'Нет изображения для экспорта.';
      setStatusMessage(message);
      showToast(message, 'error');
      setIsFileMenuOpen(false);
      return;
    }

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.download = 'image.jpg';
    link.click();
    const message = 'Изображение сохранено в формате JPG.';
    setStatusMessage(message);
    showToast(message, 'success');
    setIsFileMenuOpen(false);
  };

  const exportAsGb7 = () => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceMeta) {
      const message = 'Нет изображения для экспорта.';
      setStatusMessage(message);
      showToast(message, 'error');
      setIsFileMenuOpen(false);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const message = 'Не удалось получить контекст canvas.';
      setStatusMessage(message);
      showToast(message, 'error');
      setIsFileMenuOpen(false);
      return;
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let includeMask = false;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] < 255) {
        includeMask = true;
        break;
      }
    }

    const gb7 = encodeGb7(imageData, includeMask);
    const blob = new Blob([gb7], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'image.gb7';
    link.click();

    URL.revokeObjectURL(url);
    const message = 'Изображение сохранено в формате GB7.';
    setStatusMessage(message);
    showToast(message, 'success');
    setIsFileMenuOpen(false);
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    }

    setSourceMeta(null);
    setPixelInfo(null);
    const message = 'Холст очищен.';
    setStatusMessage(message);
    showToast(message, 'success');
    setIsFileMenuOpen(false);
  };

  const processFile = async (file: File) => {
    const format = detectFormat(file.name);
    if (!format) {
      const message = 'Неподдерживаемый формат. Используйте PNG, JPG/JPEG или GB7.';
      setStatusMessage(message);
      showToast(message, 'error');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      if (format === 'gb7') {
        const buffer = await file.arrayBuffer();
        const { imageData, hasMask } = decodeGb7(buffer);
        drawImageOnCanvas(canvas, imageData);

        setSourceMeta({
          width: imageData.width,
          height: imageData.height,
          depth: hasMask ? '7 бит + маска' : '7 бит (серый)',
          format,
          hasMask,
        });
        const message = `Загружен GB7: ${file.name}`;
        setStatusMessage(message);
        showToast(message, 'success');
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);
        URL.revokeObjectURL(objectUrl);

        setSourceMeta({
          width: image.width,
          height: image.height,
          depth: format === 'png' ? '32 бита (RGBA)' : '24 бита (RGB)',
          format,
        });
        const message = `Загружен ${format.toUpperCase()}: ${file.name}`;
        setStatusMessage(message);
        showToast(message, 'success');
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        const message = 'Не удалось загрузить изображение.';
        setStatusMessage(message);
        showToast(message, 'error');
      };

      image.src = objectUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка при загрузке.';
      setStatusMessage(message);
      showToast(message, 'error');
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await processFile(file);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
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
              <button onClick={handleImport} className="dropdown-item">
                Импорт
              </button>
              <button onClick={exportAsPng} className="dropdown-item">
                Экспорт PNG
              </button>
              <button onClick={exportAsJpg} className="dropdown-item">
                Экспорт JPG
              </button>
              <button onClick={exportAsGb7} className="dropdown-item">
                Экспорт GB7
              </button>
              <div className="dropdown-divider" />
              <button onClick={handleClearCanvas} className="dropdown-item clear-item">
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
          />

          <section
            className={`canvas-area ${isDragOver ? 'canvas-area--drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <canvas
              ref={canvasRef}
              className="image-canvas"
              onClick={handleCanvasClick}
            />
            {!sourceMeta && <div className="placeholder">Изображение не загружено</div>}
          </section>
        </div>
      </main>

      <footer className="status-bar">
        <span className="status-left">{statusMessage}</span>
        <span className="status-right">
          {sourceMeta
            ? `Ш: ${sourceMeta.width}px | В: ${sourceMeta.height}px | Глубина: ${sourceMeta.depth}`
            : 'Ш: - | В: - | Глубина: -'}
        </span>
      </footer>
      <Toaster
        position="bottom-left"
        toastOptions={{
          duration: 2000,
        }}
      />
    </div>
  );
}

export default App;