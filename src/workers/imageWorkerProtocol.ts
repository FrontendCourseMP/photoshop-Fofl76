import type { ActiveChannels } from "../core/image/types";
import type { InterpolationMethodId } from "../core/image/interpolation";
import type { LevelsStateWire } from "../core/image/processing/levelsPixels";

export const MAX_LEVELS_PREVIEW_EDGE = 2048;

export type WorkerRequest =
  | {
      id: number;
      type: "setLevelsSource";
      pixels: Uint8ClampedArray;
      width: number;
      height: number;
    }
  | { id: number; type: "clearLevelsSource" }
  | {
      id: number;
      type: "applyLevelsPreview";
      state: LevelsStateWire;
    }
  | {
      id: number;
      type: "applyLevels";
      pixels: Uint8ClampedArray;
      width: number;
      height: number;
      state: LevelsStateWire;
    }
  | {
      id: number;
      type: "applyChannels";
      pixels: Uint8ClampedArray;
      width: number;
      height: number;
      channels: ActiveChannels;
    }
  | {
      id: number;
      type: "resize";
      pixels: Uint8ClampedArray;
      width: number;
      height: number;
      dstWidth: number;
      dstHeight: number;
      methodId: InterpolationMethodId;
    }
  | {
      id: number;
      type: "generatePreviews";
      pixels: Uint8ClampedArray;
      width: number;
      height: number;
      hasAlpha: boolean;
    };

export type WorkerResponse =
  | { id: number; type: "ok" }
  | {
      id: number;
      type: "pixels";
      pixels: Uint8ClampedArray;
      width: number;
      height: number;
    }
  | {
      id: number;
      type: "previews";
      items: Array<{
        mode: "red" | "green" | "blue" | "alpha";
        pixels: Uint8ClampedArray;
        width: number;
        height: number;
      }>;
    }
  | { id: number; type: "error"; message: string };
