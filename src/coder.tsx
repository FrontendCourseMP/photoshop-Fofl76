export interface RGBAPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ImageDataInterface {
  readonly width: number;
  readonly height: number;
  getPixel(x: number, y: number): RGBAPixel;
  setPixel(x: number, y: number, pixel: RGBAPixel): void;
  toImageData(): ImageData;
  clone(): ImageDataInterface;
}

// ============ RGBImage класс ============
export class RGBImage implements ImageDataInterface {
  private pixels: RGBAPixel[];
  public readonly width: number;
  public readonly height: number;
  
  constructor(width: number, height: number);
  constructor(imageData: ImageData);
  constructor(arg: ImageData | number, height?: number) {
    if (typeof arg === 'number') {
      this.width = arg;
      this.height = height!;
      this.pixels = new Array(this.width * this.height);
      for (let i = 0; i < this.pixels.length; i++) {
        this.pixels[i] = { r: 0, g: 0, b: 0, a: 255 };
      }
    } else {
      this.width = arg.width;
      this.height = arg.height;
      this.pixels = new Array(this.width * this.height);
      for (let i = 0; i < this.pixels.length; i++) {
        const offset = i * 4;
        this.pixels[i] = {
          r: arg.data[offset],
          g: arg.data[offset + 1],
          b: arg.data[offset + 2],
          a: arg.data[offset + 3]
        };
      }
    }
  }
  
  getPixel(x: number, y: number): RGBAPixel {
    return { ...this.pixels[y * this.width + x] };
  }
  
  setPixel(x: number, y: number, pixel: RGBAPixel): void {
    this.pixels[y * this.width + x] = { ...pixel };
  }
  
  toImageData(): ImageData {
    const data = new Uint8ClampedArray(this.width * this.height * 4);
    for (let i = 0; i < this.pixels.length; i++) {
      const pixel = this.pixels[i];
      const offset = i * 4;
      data[offset] = pixel.r;
      data[offset + 1] = pixel.g;
      data[offset + 2] = pixel.b;
      data[offset + 3] = pixel.a;
    }
    return new ImageData(data, this.width, this.height);
  }
  
  clone(): ImageDataInterface {
    const cloned = new RGBImage(this.width, this.height);
    cloned.pixels = this.pixels.map(p => ({ ...p }));
    return cloned;
  }
}

// ============ GB7 Константы ============
const GB7_SIGNATURE = [0x47, 0x42, 0x37, 0x1d] as const;
const GB7_VERSION = 0x01;

// ============ GB7 Кодек ============
export class GB7Codec {
  static getSignature(): number[] {
    return [...GB7_SIGNATURE];
  }
  
  static getVersion(): number {
    return GB7_VERSION;
  }
  
  static encode(image: ImageDataInterface, includeMask: boolean = false): Uint8Array {
    const { width, height } = image;
    const pixelCount = width * height;
    const buffer = new ArrayBuffer(12 + pixelCount);
    const output = new Uint8Array(buffer);
    const view = new DataView(buffer);
    
    // Сигнатура
    GB7_SIGNATURE.forEach((value, index) => {
      output[index] = value;
    });
    
    // Версия и флаги
    output[4] = GB7_VERSION;
    output[5] = includeMask ? 0b00000001 : 0;
    
    // Размеры
    view.setUint16(6, width, false);
    view.setUint16(8, height, false);
    view.setUint16(10, 0, false);
    
    // Кодирование пикселей
    for (let i = 0; i < pixelCount; i++) {
      const x = i % width;
      const y = Math.floor(i / width);
      const pixel = image.getPixel(x, y);
      
      // Преобразование в grayscale
      const gray8 = Math.round(0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b);
      const gray7 = Math.round((gray8 / 255) * 127) & 0x7f;
      
      // Маска (альфа-канал)
      const maskBit = includeMask ? (pixel.a > 0 ? 0x80 : 0x00) : 0x00;
      
      output[12 + i] = gray7 | maskBit;
    }
    
    return output;
  }
  
  static decode(buffer: ArrayBuffer): { image: ImageDataInterface; hasMask: boolean } {
    const view = new DataView(buffer);
    
    if (view.byteLength < 12) {
      throw new Error('GB7: недостаточно данных (файл слишком мал)');
    }
    
    // Проверка сигнатуры
    for (let i = 0; i < GB7_SIGNATURE.length; i++) {
      if (view.getUint8(i) !== GB7_SIGNATURE[i]) {
        throw new Error('GB7: неверная сигнатура файла');
      }
    }
    
    // Проверка версии
    const version = view.getUint8(4);
    if (version !== GB7_VERSION) {
      throw new Error(`GB7: неподдерживаемая версия ${version}`);
    }
    
    // Проверка флагов
    const flags = view.getUint8(5);
    if ((flags & 0b11111110) !== 0) {
      throw new Error('GB7: зарезервированные биты флагов должны быть равны 0');
    }
    
    const hasMask = (flags & 0b00000001) === 1;
    const width = view.getUint16(6, false);
    const height = view.getUint16(8, false);
    const reserved = view.getUint16(10, false);
    
    if (reserved !== 0) {
      throw new Error('GB7: зарезервированное поле должно быть 0x0000');
    }
    
    if (width === 0 || height === 0) {
      throw new Error('GB7: ширина и высота не могут быть нулевыми');
    }
    
    const pixelCount = width * height;
    const expectedLength = 12 + pixelCount;
    
    if (view.byteLength !== expectedLength) {
      throw new Error('GB7: размер файла не соответствует ожидаемому');
    }
    
    // Создаём изображение
    const image = new RGBImage(width, height);
    
    // Декодирование пикселей
    for (let i = 0; i < pixelCount; i++) {
      const x = i % width;
      const y = Math.floor(i / width);
      const byte = view.getUint8(12 + i);
      const gray7 = byte & 0x7f;
      const maskBit = (byte & 0x80) !== 0;
      const gray8 = Math.round((gray7 / 127) * 255);
      
      image.setPixel(x, y, {
        r: gray8,
        g: gray8,
        b: gray8,
        a: hasMask ? (maskBit ? 255 : 0) : 255
      });
    }
    
    return { image, hasMask };
  }
}

// ============ Утилиты для работы с изображениями ============
export class ImageUtils {
  // Конвертация ImageData в RGBImage
  static fromImageData(imageData: ImageData): RGBImage {
    return new RGBImage(imageData);
  }
  
  // Конвертация HTMLImageElement в RGBImage
  static async fromImageElement(img: HTMLImageElement): Promise<RGBImage> {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get canvas context');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    return new RGBImage(imageData);
  }
  
  // Создание пустого изображения
  static createEmpty(width: number, height: number): RGBImage {
    return new RGBImage(width, height);
  }
}

// ============ Совместимость со старым кодом ============
// Эти функции оставлены для обратной совместимости с вашим старым кодом

export function encodeGb7(imageData: ImageData, includeMask: boolean): Uint8Array {
  const image = new RGBImage(imageData);
  return GB7Codec.encode(image, includeMask);
}

export function decodeGb7(buffer: ArrayBuffer): { imageData: ImageData; hasMask: boolean } {
  const { image, hasMask } = GB7Codec.decode(buffer);
  return { imageData: image.toImageData(), hasMask };
}