import type { ActiveChannels, ImageMeta, PixelData } from "./types";

export class ImageModel {
  public readonly width: number;
  public readonly height: number;
  public readonly meta: ImageMeta;

  private readonly pixels: Uint8ClampedArray;

  constructor(
    width: number,
    height: number,
    meta: ImageMeta,
    pixels: Uint8ClampedArray
  ) {
    this.width = width;
    this.height = height;
    this.meta = meta;
    this.pixels = pixels;
  }

  static fromImageData(
    imageData: ImageData,
    meta: ImageMeta
  ): ImageModel {
    return new ImageModel(
      imageData.width,
      imageData.height,
      meta,
      new Uint8ClampedArray(imageData.data)
    );
  }

  getPixel(x: number, y: number): PixelData {
    const index = (y * this.width + x) * 4;

    return {
      r: this.pixels[index],
      g: this.pixels[index + 1],
      b: this.pixels[index + 2],
      a: this.pixels[index + 3],
    };
  }

  setPixel(x: number, y: number, pixel: PixelData): void {
    const index = (y * this.width + x) * 4;

    this.pixels[index] = pixel.r;
    this.pixels[index + 1] = pixel.g;
    this.pixels[index + 2] = pixel.b;
    this.pixels[index + 3] = pixel.a;
  }

  getRawData(): Uint8ClampedArray {
    return this.pixels;
  }

  clone(): ImageModel {
    return new ImageModel(
      this.width,
      this.height,
      this.meta,
      new Uint8ClampedArray(this.pixels)
    );
  }

  toImageData(): ImageData {
    return new ImageData(
      new Uint8ClampedArray(this.pixels),
      this.width,
      this.height
    );
  }

  applyChannels(channels: ActiveChannels): ImageModel {
    const cloned = this.clone();
    const data = cloned.getRawData();

    for (let i = 0; i < data.length; i += 4) {
      if (!channels.red) {
        data[i] = 0;
      }

      if (!channels.green) {
        data[i + 1] = 0;
      }

      if (!channels.blue) {
        data[i + 2] = 0;
      }

      if (!channels.alpha) {
        data[i + 3] = 255;
      }
    }

    return cloned;
  }

  extractChannel(
    channel: "red" | "green" | "blue" | "alpha"
  ): ImageModel {
    const cloned = this.clone();
    const data = cloned.getRawData();

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      switch (channel) {
        case "red":
          data[i] = r;
          data[i + 1] = 0;
          data[i + 2] = 0;
          break;

        case "green":
          data[i] = 0;
          data[i + 1] = g;
          data[i + 2] = 0;
          break;

        case "blue":
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = b;
          break;

        case "alpha":
          data[i] = a;
          data[i + 1] = a;
          data[i + 2] = a;
          data[i + 3] = 255;
          break;
      }
    }

    return cloned;
  }

  hasAlphaChannel(): boolean {
    for (let i = 3; i < this.pixels.length; i += 4) {
      if (this.pixels[i] < 255) {
        return true;
      }
    }

    return false;
  }
}