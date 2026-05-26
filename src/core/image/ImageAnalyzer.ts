import type { ImageMeta, SourceFormat } from './types';

export class ImageAnalyzer {
  /** Подпись глубины для статус-бара по формату и типу изображения. */
  static resolveBitDepth(
    format: SourceFormat,
    isGray: boolean,
    hasAlpha: boolean
  ): string {
    if (format === 'gb7') {
      return hasAlpha
        ? '7 бит + маска'
        : '7 бит';
    }

    if (isGray) {
      return hasAlpha
        ? '8 бит/канал, оттенки серого + Alpha'
        : '8 бит/канал, оттенки серого';
    }

    return hasAlpha
      ? '8 бит/канал, RGBA'
      : '8 бит/канал, RGB';
  }

  static analyze(imageData: ImageData, format: SourceFormat): ImageMeta {
    const { data, width, height } = imageData;

    let hasAlpha = false;
    let isGray = true;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (r !== g || g !== b) {
        isGray = false;
      }

      if (a < 255) {
        hasAlpha = true;
      }
    }

    const bitDepth = ImageAnalyzer.resolveBitDepth(
      format,
      isGray,
      hasAlpha
    );

    return {
      width,
      height,
      bitDepth,
      colorType: isGray ? 'Grayscale' : 'RGB',
      hasAlpha,
      format,
    };
  }
}