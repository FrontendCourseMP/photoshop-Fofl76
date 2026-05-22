import { ImageModel } from "./ImageModel";
import type { ActiveChannels } from "./types";

export type ChannelName =
  | "red"
  | "green"
  | "blue"
  | "alpha";

export type ChannelPreview = {
  mode: ChannelName;
  previewUrl: string;
};

export class ImageChannels {
  static apply(
    image: ImageModel,
    channels: ActiveChannels
  ): ImageModel {
    return image.applyChannels(channels);
  }

  static extract(
    image: ImageModel,
    channel: ChannelName
  ): ImageModel {
    return image.extractChannel(channel);
  }

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
      const extracted = image.extractChannel(channel);

      const previewUrl =
        this.createPreview(extracted);

      return {
        mode: channel,
        previewUrl,
      };
    });
  }

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

    tempCtx.putImageData(imageData, 0, 0);

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

  static revokePreviews(
    previews: ChannelPreview[]
  ): void {
    for (const preview of previews) {
      if (preview.previewUrl) {
        URL.revokeObjectURL(preview.previewUrl);
      }
    }
  }

  static getActiveChannelNames(
    channels: ActiveChannels,
    hasAlpha: boolean
  ): string {
    const result: string[] = [];

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