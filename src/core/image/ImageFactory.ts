import { decodeGb7 } from "../../coder";

import { ImageAnalyzer } from "./ImageAnalyzer";

import { ImageModel } from "./ImageModel";

import type { SourceFormat, ImageMeta } from "./types";

export class ImageFactory {
  static detectFormat(fileName: string): SourceFormat | null {
    const lower = fileName.toLowerCase();

    if (lower.endsWith(".png")) {
      return "png";
    }

    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
      return "jpg";
    }

    if (lower.endsWith(".gb7")) {
      return "gb7";
    }

    return null;
  }

  static async load(file: File): Promise<ImageModel> {
    const format = this.detectFormat(file.name);

    if (!format) {
      throw new Error("Неподдерживаемый формат");
    }

    let imageData: ImageData;

    let customMeta: Partial<ImageMeta> = {};

    if (format === "gb7") {
      const buffer = await file.arrayBuffer();

      const decoded = decodeGb7(buffer);

      imageData = decoded.imageData;

      customMeta = {
        format: "gb7",

        bitDepth: decoded.hasMask
          ? "8 бит (7 бит + Alpha Mask)"
          : "7 бит Grayscale",

        hasAlpha: decoded.hasMask,

        colorType: "Grayscale",
      };
    } else {
      imageData = await this.loadBrowserImage(file);
    }

    const analyzedMeta = await ImageAnalyzer.analyze(imageData, format, file);

    const finalMeta: ImageMeta =
      format === "gb7"
        ? ({
            ...analyzedMeta,
            ...customMeta,
          } as ImageMeta)
        : analyzedMeta;

    return ImageModel.fromImageData(imageData, finalMeta);
  }

  private static loadBrowserImage(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);

      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");

        canvas.width = img.width;

        canvas.height = img.height;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Canvas context error"));

          return;
        }

        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, img.width, img.height);

        URL.revokeObjectURL(url);

        resolve(imageData);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);

        reject(new Error("Failed to load image"));
      };

      img.src = url;
    });
  }
}
