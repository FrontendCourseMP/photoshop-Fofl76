import { ImageModel } from "./ImageModel";
import type { ActiveChannels } from "./types";

export type ChannelName =
  | "gray"
  | "red"
  | "green"
  | "blue"
  | "alpha";

export type ChannelPreview = {
  mode: ChannelName;
  previewUrl: string;
};

export class ImageChannels {
  /**
   * Применение каналов без шахматного фона
   */
  static apply(
    image: ImageModel,
    channels: ActiveChannels
  ): ImageModel {
    return image.applyChannels(channels);
  }

  /**
   * Чистое изображение БЕЗ шахматки
   * Используется для экспорта PNG/JPG
   */
  static applyRaw(
    image: ImageModel,
    channels: ActiveChannels
  ): ImageData {
    const result =
      image.applyChannels(channels);

    return result.toImageData();
  }

  /** Быстрый путь для предпросмотра (без шахматки). */
  static toImageDataForPreview(
    image: ImageModel,
    channels: ActiveChannels
  ): ImageData {
    const data = image.getRawData();
    const out = new Uint8ClampedArray(data);

    for (let i = 0; i < out.length; i += 4) {
      if (!channels.red) {
        out[i] = 0;
      }
      if (!channels.green) {
        out[i + 1] = 0;
      }
      if (!channels.blue) {
        out[i + 2] = 0;
      }
      if (!channels.alpha) {
        out[i + 3] = 255;
      }
    }

    return new ImageData(out, image.width, image.height);
  }

  /**
   * Изображение С шахматным фоном
   * Используется только для UI canvas
   */
  static applyWithCheckerboard(
    image: ImageModel,
    channels: ActiveChannels
  ): ImageData {
    const result =
      image.applyChannels(channels);

    const imageData = result.toImageData();

    const width = image.width;
    const height = image.height;

    const canvas =
      document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return imageData;
    }

    /**
     * Полупрозрачная шахматка
     */

    const cellSize = 16;

    ctx.fillStyle =
      "rgba(128,128,128,0.45)";

    ctx.fillRect(0, 0, width, height);

    for (
      let y = 0;
      y < height;
      y += cellSize
    ) {
      for (
        let x = 0;
        x < width;
        x += cellSize
      ) {
        if (
          (Math.floor(x / cellSize) +
            Math.floor(y / cellSize)) %
            2 ===
          0
        ) {
          ctx.fillStyle =
            "rgba(192,192,192,0.45)";

          ctx.fillRect(
            x,
            y,
            cellSize,
            cellSize
          );
        }
      }
    }

    /**
     * Если alpha выключен —
     * делаем изображение непрозрачным
     */

    if (!channels.alpha) {
      const data = imageData.data;

      for (
        let i = 0;
        i < data.length;
        i += 4
      ) {
        data[i + 3] = 255;
      }
    }

    /**
     * Рисуем изображение поверх шахматки
     */

    const tempCanvas =
      document.createElement("canvas");

    tempCanvas.width = width;
    tempCanvas.height = height;

    const tempCtx =
      tempCanvas.getContext("2d");

    if (!tempCtx) {
      return imageData;
    }

    tempCtx.putImageData(
      imageData,
      0,
      0
    );

    ctx.drawImage(tempCanvas, 0, 0);

    return ctx.getImageData(
      0,
      0,
      width,
      height
    );
  }

  static extract(
    image: ImageModel,
    channel: ChannelName
  ): ImageModel {
    return image.extractChannel(channel);
  }

  /**
   * Генерация preview каналов
   */

  static generatePreviews(
    image: ImageModel
  ): ChannelPreview[] {
    const channels: ChannelName[] = [
      "red",
      "green",
      "blue",
    ];

    if (image.hasAlphaChannel()) {
      channels.push("alpha");
    }

    return channels.map((channel) => {
      const extracted =
        image.extractChannel(channel);

      return {
        mode: channel,
        previewUrl:
          this.createPreview(extracted),
      };
    });
  }

  /**
   * Создание preview картинки
   */

  private static createPreview(
    image: ImageModel
  ): string {
    const imageData = image.toImageData();

    const canvas =
      document.createElement("canvas");

    const previewHeight = 80;

    const previewWidth = Math.max(
      1,
      Math.round(
        (image.width / image.height) *
          previewHeight
      )
    );

    canvas.width = previewWidth;
    canvas.height = previewHeight;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return "";
    }

    const tempCanvas =
      document.createElement("canvas");

    tempCanvas.width = image.width;
    tempCanvas.height = image.height;

    const tempCtx =
      tempCanvas.getContext("2d");

    if (!tempCtx) {
      return "";
    }

    tempCtx.putImageData(
      imageData,
      0,
      0
    );

    ctx.drawImage(
      tempCanvas,
      0,
      0,
      image.width,
      image.height,
      0,
      0,
      previewWidth,
      previewHeight
    );

    return canvas.toDataURL();
  }

  /**
   * Активные имена каналов
   */

  static getActiveChannelNames(
    channels: ActiveChannels,
    hasAlpha: boolean,
    isGb7Image = false
  ): string {
    const result: string[] = [];

    if (isGb7Image) {
      if (channels.red || channels.green || channels.blue) {
        result.push("Gray");
      }
      if (channels.alpha && hasAlpha) {
        result.push("Mask");
      }
      return result.join("+");
    }

    if (channels.red) {
      result.push("R");
    }

    if (channels.green) {
      result.push("G");
    }

    if (channels.blue) {
      result.push("B");
    }

    if (
      channels.alpha &&
      hasAlpha
    ) {
      result.push("A");
    }

    return result.join("");
  }
}