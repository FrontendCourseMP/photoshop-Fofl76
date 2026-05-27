import type { ChannelPreview } from "./ImageChannels";
import { ImageModel } from "./ImageModel";
import type { ActiveChannels, ImageMeta } from "./types";
import type { InterpolationMethodId } from "./interpolation";
import { bilinearMethod } from "./interpolation/bilinear";
import { nearestNeighborMethod } from "./interpolation/nearestNeighbor";
import {
  applyLevelsToBuffer,
  type LevelsStateWire,
} from "./processing/levelsPixels";
import {
  applyChannelsToBuffer,
  downscaleBuffer,
  extractChannelBuffer,
} from "./processing/channelsPixels";
import type { LevelsState } from "./Levels";
import type { WorkerRequest, WorkerResponse } from "../../workers/imageWorkerProtocol";

const interpolationMethods = {
  nearest: nearestNeighborMethod,
  bilinear: bilinearMethod,
};

function previewPixelsToDataUrl(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(pixels), width, height),
    0,
    0
  );
  return canvas.toDataURL();
}

export function levelsStateToWire(state: LevelsState): LevelsStateWire {
  return {
    red: state.red,
    green: state.green,
    blue: state.blue,
    alpha: state.alpha,
  };
}

class ImageWorkerClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve: (value: WorkerResponse) => void;
      reject: (reason: unknown) => void;
    }
  >();
  private workerFailed = false;
  private levelsSourceFallback: {
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
  } | null = null;

  private getWorker(): Worker | null {
    if (this.workerFailed) {
      return null;
    }

    if (!this.worker) {
      try {
        this.worker = new Worker(
          new URL(
            "../../workers/imageProcessing.worker.ts",
            import.meta.url
          ),
          { type: "module" }
        );
        this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const msg = event.data;
          const pending = this.pending.get(msg.id);
          if (!pending) {
            return;
          }
          this.pending.delete(msg.id);
          if (msg.type === "error") {
            pending.reject(new Error(msg.message));
          } else {
            pending.resolve(msg);
          }
        };
        this.worker.onerror = () => {
          this.workerFailed = true;
          this.worker?.terminate();
          this.worker = null;
        };
      } catch {
        this.workerFailed = true;
        return null;
      }
    }

    return this.worker;
  }

  private post(
    request: WorkerRequest,
    transfer?: Transferable[]
  ): Promise<WorkerResponse> {
    const worker = this.getWorker();
    if (!worker) {
      return Promise.reject(new Error("Worker недоступен"));
    }

    return new Promise((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject });
      worker.postMessage(request, transfer ?? []);
    });
  }

  private allocId(): number {
    return this.nextId++;
  }

  async setLevelsSource(
    pixels: Uint8ClampedArray,
    width: number,
    height: number
  ): Promise<void> {
    this.levelsSourceFallback = {
      pixels: new Uint8ClampedArray(pixels),
      width,
      height,
    };

    const copy = new Uint8ClampedArray(pixels);
    try {
      await this.post(
        {
          id: this.allocId(),
          type: "setLevelsSource",
          pixels: copy,
          width,
          height,
        },
        [copy.buffer]
      );
    } catch {
      /* fallback хранится локально */
    }
  }

  async clearLevelsSource(): Promise<void> {
    this.levelsSourceFallback = null;
    try {
      await this.post({ id: this.allocId(), type: "clearLevelsSource" });
    } catch {
      /* ignore */
    }
  }

  private applyLevelsPreviewFallback(
    state: LevelsStateWire
  ): { pixels: Uint8ClampedArray; width: number; height: number } {
    const source = this.levelsSourceFallback;
    if (!source) {
      throw new Error("Источник уровней не задан");
    }

    const scale = Math.min(
      1,
      2048 / Math.max(source.width, source.height)
    );
    let pixels = source.pixels;
    let width = source.width;
    let height = source.height;

    if (scale < 1) {
      width = Math.max(1, Math.round(source.width * scale));
      height = Math.max(1, Math.round(source.height * scale));
      pixels = downscaleBuffer(
        source.pixels,
        source.width,
        source.height,
        width,
        height
      );
    }

    return {
      pixels: applyLevelsToBuffer(pixels, state),
      width,
      height,
    };
  }

  async applyLevelsPreview(
    state: LevelsStateWire
  ): Promise<{ pixels: Uint8ClampedArray; width: number; height: number }> {
    try {
      const response = await this.post({
        id: this.allocId(),
        type: "applyLevelsPreview",
        state,
      });
      if (response.type !== "pixels") {
        throw new Error("Неверный ответ worker");
      }
      return {
        pixels: response.pixels,
        width: response.width,
        height: response.height,
      };
    } catch {
      return this.applyLevelsPreviewFallback(state);
    }
  }

  async applyLevels(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    state: LevelsStateWire
  ): Promise<Uint8ClampedArray> {
    const copy = new Uint8ClampedArray(pixels);
    try {
      const response = await this.post(
        {
          id: this.allocId(),
          type: "applyLevels",
          pixels: copy,
          width,
          height,
          state,
        },
        [copy.buffer]
      );
      if (response.type !== "pixels") {
        throw new Error("Неверный ответ worker");
      }
      return response.pixels;
    } catch {
      return applyLevelsToBuffer(pixels, state);
    }
  }

  async applyChannels(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    channels: ActiveChannels
  ): Promise<Uint8ClampedArray> {
    const copy = new Uint8ClampedArray(pixels);
    try {
      const response = await this.post(
        {
          id: this.allocId(),
          type: "applyChannels",
          pixels: copy,
          width,
          height,
          channels,
        },
        [copy.buffer]
      );
      if (response.type !== "pixels") {
        throw new Error("Неверный ответ worker");
      }
      return response.pixels;
    } catch {
      return applyChannelsToBuffer(pixels, channels);
    }
  }

  async resize(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    dstWidth: number,
    dstHeight: number,
    methodId: InterpolationMethodId
  ): Promise<Uint8ClampedArray> {
    const copy = new Uint8ClampedArray(pixels);
    try {
      const response = await this.post(
        {
          id: this.allocId(),
          type: "resize",
          pixels: copy,
          width,
          height,
          dstWidth,
          dstHeight,
          methodId,
        },
        [copy.buffer]
      );
      if (response.type !== "pixels") {
        throw new Error("Неверный ответ worker");
      }
      return response.pixels;
    } catch {
      return interpolationMethods[methodId].resize({
        source: pixels,
        srcWidth: width,
        srcHeight: height,
        dstWidth,
        dstHeight,
      });
    }
  }

  async generatePreviews(model: ImageModel): Promise<ChannelPreview[]> {
    const pixels = model.getRawData();
    const copy = new Uint8ClampedArray(pixels);

    try {
      const response = await this.post(
        {
          id: this.allocId(),
          type: "generatePreviews",
          pixels: copy,
          width: model.width,
          height: model.height,
          hasAlpha: model.hasAlphaChannel(),
        },
        [copy.buffer]
      );

      if (response.type !== "previews") {
        throw new Error("Неверный ответ worker");
      }

      return response.items.map((item) => ({
        mode: item.mode,
        previewUrl: previewPixelsToDataUrl(
          item.pixels,
          item.width,
          item.height
        ),
      }));
    } catch {
      return this.generatePreviewsMainThread(model);
    }
  }

  private generatePreviewsMainThread(
    model: ImageModel
  ): ChannelPreview[] {
    const previewHeight = 80;
    const previewWidth = Math.max(
      1,
      Math.round((model.width / model.height) * previewHeight)
    );
    const channels: Array<"red" | "green" | "blue" | "alpha"> = [
      "red",
      "green",
      "blue",
    ];
    if (model.hasAlphaChannel()) {
      channels.push("alpha");
    }

    return channels.map((mode) => {
      const extracted = extractChannelBuffer(model.getRawData(), mode);
      const scaled = downscaleBuffer(
        extracted,
        model.width,
        model.height,
        previewWidth,
        previewHeight
      );
      return {
        mode,
        previewUrl: previewPixelsToDataUrl(
          scaled,
          previewWidth,
          previewHeight
        ),
      };
    });
  }
}

export const imageWorkerClient = new ImageWorkerClient();

export function pixelsToImageModel(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  meta: ImageMeta
): ImageModel {
  return new ImageModel(width, height, { ...meta, width, height }, pixels);
}
