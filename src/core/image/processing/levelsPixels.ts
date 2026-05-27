import { buildLevelsLUT, type LUT } from "../LUT";

export type LevelsChannelParamsWire = {
  inputBlack: number;
  inputWhite: number;
  midtone: number;
};

export type LevelsStateWire = {
  red: LevelsChannelParamsWire;
  green: LevelsChannelParamsWire;
  blue: LevelsChannelParamsWire;
  alpha: LevelsChannelParamsWire;
};

const DEFAULT_CHANNEL: LevelsChannelParamsWire = {
  inputBlack: 0,
  inputWhite: 255,
  midtone: 128,
};

function isDefaultParams(p: LevelsChannelParamsWire): boolean {
  return (
    p.inputBlack === DEFAULT_CHANNEL.inputBlack &&
    p.inputWhite === DEFAULT_CHANNEL.inputWhite &&
    p.midtone === DEFAULT_CHANNEL.midtone
  );
}

function midtoneToGamma(
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

function paramsToLUT(params: LevelsChannelParamsWire): LUT {
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

export type LevelsLUTsWire = {
  lutR: LUT | null;
  lutG: LUT | null;
  lutB: LUT | null;
  lutA: LUT | null;
};

export function resolveLevelsLUTs(state: LevelsStateWire): LevelsLUTsWire {
  return {
    lutR: isDefaultParams(state.red) ? null : paramsToLUT(state.red),
    lutG: isDefaultParams(state.green) ? null : paramsToLUT(state.green),
    lutB: isDefaultParams(state.blue) ? null : paramsToLUT(state.blue),
    lutA: isDefaultParams(state.alpha) ? null : paramsToLUT(state.alpha),
  };
}

export function applyLevelsLUTs(
  data: Uint8ClampedArray,
  luts: LevelsLUTsWire
): void {
  const { lutR, lutG, lutB, lutA } = luts;

  if (!lutR && !lutG && !lutB && !lutA) {
    return;
  }

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
}

export function applyLevelsToBuffer(
  source: Uint8ClampedArray,
  state: LevelsStateWire
): Uint8ClampedArray {
  const luts = resolveLevelsLUTs(state);

  if (!luts.lutR && !luts.lutG && !luts.lutB && !luts.lutA) {
    return new Uint8ClampedArray(source);
  }

  const out = new Uint8ClampedArray(source);
  applyLevelsLUTs(out, luts);
  return out;
}
