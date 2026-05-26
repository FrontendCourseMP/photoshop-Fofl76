import type { ImageMeta, SourceFormat } from "./types";

type PngMetadata = {
  bitDepth: number;
  hasAlpha: boolean;
  isGray: boolean;
};

export class ImageAnalyzer {
  static resolveBitDepth(
    format: SourceFormat,
    isGray: boolean,
    hasAlpha: boolean,
    bitDepthFromFile?: number
  ): string {
    // GB7
    if (format === "gb7") {
      return hasAlpha ? "8 бит (7 бит + Alpha Mask)" : "7 бит Grayscale";
    }

    const bitsPerChannel = bitDepthFromFile ?? 8;

    // количество каналов
    const channels = isGray ? (hasAlpha ? 2 : 1) : hasAlpha ? 4 : 3;

    // общая глубина пикселя
    const totalBits = bitsPerChannel * channels;

    // grayscale
    if (isGray) {
      return hasAlpha
        ? `${totalBits} бит (${bitsPerChannel} бит/канал Gray+Alpha)`
        : `${totalBits} бит (${bitsPerChannel} бит Gray)`;
    }

    // RGB / RGBA
    return hasAlpha
      ? `${totalBits} бит (${bitsPerChannel} бит/канал RGBA)`
      : `${totalBits} бит (${bitsPerChannel} бит/канал RGB)`;
  }

  static async analyze(
    imageData: ImageData,
    format: SourceFormat,
    file?: File
  ): Promise<ImageMeta> {
    const { width, height } = imageData;

    let hasAlpha = false;

    let isGray = false;

    let actualBitDepth: number | undefined;

    // GB7
    if (format === "gb7") {
      actualBitDepth = 7;

      isGray = true;
    }

    // PNG
    else if (format === "png" && file) {
      const pngMeta = await this.getPngMetadataFromFile(file);

      actualBitDepth = pngMeta.bitDepth;

      hasAlpha = pngMeta.hasAlpha;

      isGray = pngMeta.isGray;
    }

    // JPG
    else if (format === "jpg") {
      actualBitDepth = 8;

      hasAlpha = false;

      isGray = false;
    }

    const bitDepth = this.resolveBitDepth(
      format,
      isGray,
      hasAlpha,
      actualBitDepth
    );

    return {
      width,
      height,
      bitDepth,
      colorType: isGray ? "Grayscale" : "RGB",
      hasAlpha,
      format,
    };
  }

  private static async getPngMetadataFromFile(
    file: File
  ): Promise<PngMetadata> {
    try {
      const buffer = await file.slice(0, 30).arrayBuffer();

      const bytes = new Uint8Array(buffer);

      // PNG signature
      const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

      for (let i = 0; i < 8; i++) {
        if (bytes[i] !== pngSignature[i]) {
          throw new Error("Invalid PNG");
        }
      }

      // IHDR
      // byte 24 = bit depth
      // byte 25 = color type

      const bitDepth = bytes[24];

      const colorType = bytes[25];

      // PNG color types:
      // 0 = grayscale
      // 2 = RGB
      // 3 = indexed
      // 4 = grayscale + alpha
      // 6 = RGBA

      const isGray = colorType === 0 || colorType === 4;

      const hasAlpha = colorType === 4 || colorType === 6;

      return {
        bitDepth,
        hasAlpha,
        isGray,
      };
    } catch (error) {
      console.warn("Failed to detect PNG metadata:", error);

      return {
        bitDepth: 8,
        hasAlpha: false,
        isGray: false,
      };
    }
  }

  static analyzeSync(imageData: ImageData, format: SourceFormat): ImageMeta {
    const { width, height } = imageData;

    let bitDepth = 8;

    let isGray = false;

    let hasAlpha = false;

    if (format === "gb7") {
      bitDepth = 7;

      isGray = true;
    }

    if (format === "jpg") {
      bitDepth = 8;

      isGray = false;

      hasAlpha = false;
    }

    const bitDepthStr = this.resolveBitDepth(
      format,
      isGray,
      hasAlpha,
      bitDepth
    );

    return {
      width,
      height,
      bitDepth: bitDepthStr,
      colorType: isGray ? "Grayscale" : "RGB",
      hasAlpha,
      format,
    };
  }
}
