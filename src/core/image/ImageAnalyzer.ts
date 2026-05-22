import type { ImageMeta, SourceFormat } from './types';

export class ImageAnalyzer {
  static analyze(imageData: ImageData, format: SourceFormat): ImageMeta {
    const { data, width, height } = imageData;

    let hasAlpha = false;
    let isGray = true;
    let max = 0;

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

      max = Math.max(max, r, g, b);
    }

    let bitDepth = '8-bit';

    if (max <= 127) {
      bitDepth = '7-bit';
    }

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