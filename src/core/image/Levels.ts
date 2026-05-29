import { buildLevelsLUT, type LUT } from "./LUT";
import { ImageModel } from "./ImageModel";
import {
  applyLevelsToBuffer,
  type LevelsStateWire,
} from "./processing/levelsPixels";

export type LevelsTarget =
  | "master"
  | "red"
  | "green"
  | "blue"
  | "alpha";

export type LevelsChannelParams = {
  inputBlack: number;
  inputWhite: number;
  /** Позиция маркера полутонов на шкале 0–255 (между чёрным и белым). */
  midtone: number;
};

export type LevelsState = Record<
  LevelsTarget,
  LevelsChannelParams
>;

export const DEFAULT_CHANNEL_PARAMS: LevelsChannelParams =
  {
    inputBlack: 0,
    inputWhite: 255,
    midtone: 128,
  };

export function createDefaultLevelsState(): LevelsState {
  const params = { ...DEFAULT_CHANNEL_PARAMS };
  return {
    master: { ...params },
    red: { ...params },
    green: { ...params },
    blue: { ...params },
    alpha: { ...params },
  };
}

export function levelsStateToWire(state: LevelsState): LevelsStateWire {
  return {
    red: state.red,
    green: state.green,
    blue: state.blue,
    alpha: state.alpha,
  };
}

export function cloneLevelsState(
  state: LevelsState
): LevelsState {
  return {
    master: { ...state.master },
    red: { ...state.red },
    green: { ...state.green },
    blue: { ...state.blue },
    alpha: { ...state.alpha },
  };
}

/** Гамма из позиции полутонов: в центре (0.5 норм.) γ = 1. */
export function midtoneToGamma(
  inputBlack: number,
  inputWhite: number,
  midtone: number
): number {
  const black = inputBlack;
  const white = inputWhite;

  if (white <= black) {
    return 1;
  }

  const mid = Math.max(
    black + 0.5,
    Math.min(white - 0.5, midtone)
  );
  const m = (mid - black) / (white - black);

  if (m <= 0 || m >= 1) {
    return 1;
  }

  const gamma = Math.log(0.5) / Math.log(m);
  return Math.max(0.1, Math.min(9.9, gamma));
}

export function paramsToLUT(
  params: LevelsChannelParams
): LUT {
  const gamma = midtoneToGamma(
    params.inputBlack,
    params.inputWhite,
    params.midtone
  );
  return buildLevelsLUT(
    params.inputBlack,
    params.inputWhite,
    gamma
  );
}

export function applyLevels(
  image: ImageModel,
  state: LevelsState
): ImageModel {
  const wire = levelsStateToWire(state);
  const pixels = applyLevelsToBuffer(image.getRawData(), wire);
  return new ImageModel(image.width, image.height, image.meta, pixels);
}

export function clampChannelParams(
  params: LevelsChannelParams,
  changed: "black" | "white" | "midtone"
): LevelsChannelParams {
  let { inputBlack, inputWhite, midtone } = params;

  inputBlack = Math.round(inputBlack);
  inputWhite = Math.round(inputWhite);
  midtone = Math.round(midtone);

  inputBlack = Math.max(0, Math.min(254, inputBlack));
  inputWhite = Math.max(1, Math.min(255, inputWhite));

  if (changed === "black") {
    inputBlack = Math.min(inputBlack, inputWhite - 1);
  } else if (changed === "white") {
    inputWhite = Math.max(inputWhite, inputBlack + 1);
  }

  midtone = Math.max(
    inputBlack + 1,
    Math.min(inputWhite - 1, midtone)
  );

  return { inputBlack, inputWhite, midtone };
}
