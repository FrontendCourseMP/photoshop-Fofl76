import { buildLevelsLUT, type LUT } from "./LUT";
import { ImageModel } from "./ImageModel";

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

function isDefaultParams(
  p: LevelsChannelParams
): boolean {
  return (
    p.inputBlack ===
      DEFAULT_CHANNEL_PARAMS.inputBlack &&
    p.inputWhite ===
      DEFAULT_CHANNEL_PARAMS.inputWhite &&
    p.midtone === DEFAULT_CHANNEL_PARAMS.midtone
  );
}

export function applyLevels(
  image: ImageModel,
  state: LevelsState
): ImageModel {
  const lutR = isDefaultParams(state.red)
    ? null
    : paramsToLUT(state.red);
  const lutG = isDefaultParams(state.green)
    ? null
    : paramsToLUT(state.green);
  const lutB = isDefaultParams(state.blue)
    ? null
    : paramsToLUT(state.blue);
  const lutA = isDefaultParams(state.alpha)
    ? null
    : paramsToLUT(state.alpha);

  if (!lutR && !lutG && !lutB && !lutA) {
    return image.clone();
  }

  const result = image.clone();
  const data = result.getRawData();

  for (let i = 0; i < data.length; i += 4) {
    if (lutR) {
      data[i] = lutR[data[i]];
    }
    if (lutG) {
      data[i + 1] = lutG[data[i + 1]];
    }
    if (lutB) {
      data[i + 2] = lutB[data[i + 2]];
    }
    if (lutA) {
      data[i + 3] = lutA[data[i + 3]];
    }
  }

  return result;
}

export function clampChannelParams(
  params: LevelsChannelParams,
  changed: "black" | "white" | "midtone"
): LevelsChannelParams {
  let { inputBlack, inputWhite, midtone } =
    params;

  inputBlack = Math.round(
    Math.max(0, Math.min(254, inputBlack))
  );
  inputWhite = Math.round(
    Math.max(1, Math.min(255, inputWhite))
  );

  if (changed === "black" && inputBlack >= inputWhite) {
    inputWhite = Math.min(255, inputBlack + 1);
  }
  if (changed === "white" && inputWhite <= inputBlack) {
    inputBlack = Math.max(0, inputWhite - 1);
  }
  if (inputBlack >= inputWhite) {
    inputWhite = inputBlack + 1;
  }

  midtone = Math.round(midtone);
  midtone = Math.max(
    inputBlack + 1,
    Math.min(inputWhite - 1, midtone)
  );

  return { inputBlack, inputWhite, midtone };
}
