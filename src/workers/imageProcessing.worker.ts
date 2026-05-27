import { bilinearMethod } from "../core/image/interpolation/bilinear";
import { nearestNeighborMethod } from "../core/image/interpolation/nearestNeighbor";
import type { InterpolationMethodId } from "../core/image/interpolation";
import {
  applyChannelsToBuffer,
  downscaleBuffer,
  extractChannelBuffer,
} from "../core/image/processing/channelsPixels";
import {
  applyLevelsLUTs,
  applyLevelsToBuffer,
  resolveLevelsLUTs,
  type LevelsStateWire,
} from "../core/image/processing/levelsPixels";
import {
  MAX_LEVELS_PREVIEW_EDGE,
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

function previewScaleFor(width: number, height: number): number {
  const maxEdge = Math.max(width, height);
  if (maxEdge <= MAX_LEVELS_PREVIEW_EDGE) {
    return 1;
  }
  return MAX_LEVELS_PREVIEW_EDGE / maxEdge;
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

function applyLevelsPreview(state: LevelsStateWire): Uint8ClampedArray {
  if (!levelsPreviewSource) {
    throw new Error("Источник уровней не задан");
  }

  const out = new Uint8ClampedArray(levelsPreviewSource);
  applyLevelsLUTs(out, resolveLevelsLUTs(state));
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
  hasAlpha: boolean
) {
  const previewHeight = 80;
  const previewWidth = Math.max(
    1,
    Math.round((width / height) * previewHeight)
  );

  const channels: Array<"red" | "green" | "blue" | "alpha"> = [
    "red",
    "green",
    "blue",
  ];
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
          msg.hasAlpha
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
