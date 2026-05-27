import { bilinearMethod } from "../core/image/interpolation/bilinear";
import { nearestNeighborMethod } from "../core/image/interpolation/nearestNeighbor";
import type { InterpolationMethodId } from "../core/image/interpolation";
import {
  applyChannelsToBuffer,
  downscaleBuffer,
  extractChannelBuffer,
} from "../core/image/processing/channelsPixels";
import { applyKernelFilterToBuffer } from "../core/image/processing/kernelsPixels";
import type { KernelFilterStateWire } from "../core/image/processing/kernelsPixels";
import {
  applyLevelsLUTs,
  applyLevelsToBuffer,
  resolveLevelsLUTs,
  type LevelsStateWire,
} from "../core/image/processing/levelsPixels";
import {
  MAX_LEVELS_PREVIEW_EDGE,
  MAX_KERNEL_PREVIEW_EDGE,
  type WorkerRequest,
  type WorkerResponse,
} from "./imageWorkerProtocol";

const interpolationMethods = {
  nearest: nearestNeighborMethod,
  bilinear: bilinearMethod,
};

let levelsPreviewSource: Uint8ClampedArray | null = null;
let levelsPreviewWidth = 0;
let levelsPreviewHeight = 0;

let kernelPreviewSource: Uint8ClampedArray | null = null;
let kernelPreviewWidth = 0;
let kernelPreviewHeight = 0;

function previewScaleFor(width: number, height: number): number {
  const maxEdge = Math.max(width, height);
  if (maxEdge <= MAX_LEVELS_PREVIEW_EDGE) {
    return 1;
  }
  return MAX_LEVELS_PREVIEW_EDGE / maxEdge;
}

function kernelPreviewScaleFor(width: number, height: number): number {
  const maxEdge = Math.max(width, height);
  if (maxEdge <= MAX_KERNEL_PREVIEW_EDGE) {
    return 1;
  }
  return MAX_KERNEL_PREVIEW_EDGE / maxEdge;
}

function setLevelsSource(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const scale = previewScaleFor(width, height);

  if (scale < 1) {
    levelsPreviewWidth = Math.max(1, Math.round(width * scale));
    levelsPreviewHeight = Math.max(1, Math.round(height * scale));
    levelsPreviewSource = downscaleBuffer(
      pixels,
      width,
      height,
      levelsPreviewWidth,
      levelsPreviewHeight
    );
  } else {
    levelsPreviewWidth = width;
    levelsPreviewHeight = height;
    levelsPreviewSource = pixels;
  }
}

function clearLevelsSource(): void {
  levelsPreviewSource = null;
}

function setKernelSource(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const scale = kernelPreviewScaleFor(width, height);
  if (scale < 1) {
    kernelPreviewWidth = Math.max(1, Math.round(width * scale));
    kernelPreviewHeight = Math.max(1, Math.round(height * scale));
    kernelPreviewSource = downscaleBuffer(
      pixels,
      width,
      height,
      kernelPreviewWidth,
      kernelPreviewHeight
    );
  } else {
    kernelPreviewWidth = width;
    kernelPreviewHeight = height;
    kernelPreviewSource = pixels;
  }
}

function clearKernelSource(): void {
  kernelPreviewSource = null;
}

function applyLevelsPreview(state: LevelsStateWire): Uint8ClampedArray {
  if (!levelsPreviewSource) {
    throw new Error("Источник уровней не задан");
  }

  const out = new Uint8ClampedArray(levelsPreviewSource);
  applyLevelsLUTs(out, resolveLevelsLUTs(state));
  return out;
}

function applyKernelPreview(
  state: KernelFilterStateWire
): Uint8ClampedArray {
  if (!kernelPreviewSource) {
    throw new Error("Источник фильтра не задан");
  }
  const out = applyKernelFilterToBuffer(
    kernelPreviewSource,
    kernelPreviewWidth,
    kernelPreviewHeight,
    state
  );
  return out;
}

function resizePixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  dstWidth: number,
  dstHeight: number,
  methodId: InterpolationMethodId
): Uint8ClampedArray {
  return interpolationMethods[methodId].resize({
    source: pixels,
    srcWidth: width,
    srcHeight: height,
    dstWidth,
    dstHeight,
  });
}

function generatePreviews(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  hasAlpha: boolean,
  isGb7Image: boolean
) {
  const previewHeight = 80;
  const previewWidth = Math.max(
    1,
    Math.round((width / height) * previewHeight)
  );

  const channels: Array<"red" | "green" | "blue" | "alpha" | "gray"> =
    isGb7Image ? ["gray"] : ["red", "green", "blue"];
  if (hasAlpha) {
    channels.push("alpha");
  }

  return channels.map((mode) => {
    const extracted = extractChannelBuffer(pixels, mode);
    const scaled = downscaleBuffer(
      extracted,
      width,
      height,
      previewWidth,
      previewHeight
    );
    return { mode, pixels: scaled, width: previewWidth, height: previewHeight };
  });
}

function reply(response: WorkerResponse, transfer?: Transferable[]) {
  if (transfer && transfer.length > 0) {
    self.postMessage(response, { transfer });
  } else {
    self.postMessage(response);
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case "setLevelsSource": {
        setLevelsSource(msg.pixels, msg.width, msg.height);
        reply({ id: msg.id, type: "ok" });
        break;
      }

      case "clearLevelsSource": {
        clearLevelsSource();
        reply({ id: msg.id, type: "ok" });
        break;
      }

      case "setKernelSource": {
        setKernelSource(msg.pixels, msg.width, msg.height);
        reply({ id: msg.id, type: "ok" });
        break;
      }

      case "clearKernelSource": {
        clearKernelSource();
        reply({ id: msg.id, type: "ok" });
        break;
      }

      case "applyLevelsPreview": {
        const pixels = applyLevelsPreview(msg.state);
        reply(
          {
            id: msg.id,
            type: "pixels",
            pixels,
            width: levelsPreviewWidth,
            height: levelsPreviewHeight,
          },
          [pixels.buffer]
        );
        break;
      }

      case "applyKernelPreview": {
        const pixels = applyKernelPreview(msg.state);
        reply(
          {
            id: msg.id,
            type: "pixels",
            pixels,
            width: kernelPreviewWidth,
            height: kernelPreviewHeight,
          },
          [pixels.buffer]
        );
        break;
      }

      case "applyLevels": {
        const pixels = applyLevelsToBuffer(msg.pixels, msg.state);
        reply(
          {
            id: msg.id,
            type: "pixels",
            pixels,
            width: msg.width,
            height: msg.height,
          },
          [pixels.buffer]
        );
        break;
      }

      case "applyKernel": {
        const pixels = applyKernelFilterToBuffer(
          msg.pixels,
          msg.width,
          msg.height,
          msg.state
        );
        reply(
          {
            id: msg.id,
            type: "pixels",
            pixels,
            width: msg.width,
            height: msg.height,
          },
          [pixels.buffer]
        );
        break;
      }

      case "applyChannels": {
        const pixels = applyChannelsToBuffer(msg.pixels, msg.channels);
        reply(
          {
            id: msg.id,
            type: "pixels",
            pixels,
            width: msg.width,
            height: msg.height,
          },
          [pixels.buffer]
        );
        break;
      }

      case "resize": {
        const pixels = resizePixels(
          msg.pixels,
          msg.width,
          msg.height,
          msg.dstWidth,
          msg.dstHeight,
          msg.methodId
        );
        reply(
          {
            id: msg.id,
            type: "pixels",
            pixels,
            width: msg.dstWidth,
            height: msg.dstHeight,
          },
          [pixels.buffer]
        );
        break;
      }

      case "generatePreviews": {
        const items = generatePreviews(
          msg.pixels,
          msg.width,
          msg.height,
          msg.hasAlpha,
          msg.isGb7Image
        );
        reply(
          { id: msg.id, type: "previews", items },
          items.map((item) => item.pixels.buffer)
        );
        break;
      }

      default: {
        const unknown = msg as { id: number };
        reply({
          id: unknown.id,
          type: "error",
          message: "Неизвестная команда",
        });
        break;
      }
    }
  } catch (error) {
    reply({
      id: msg.id,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
