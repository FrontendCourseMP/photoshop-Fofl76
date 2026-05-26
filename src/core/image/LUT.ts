/** Таблица подстановки 256→256 для быстрой градационной коррекции. */
export type LUT = Uint8Array;

export function createIdentityLUT(): LUT {
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = i;
  }
  return lut;
}

/**
 * Строит LUT для входных уровней: чёрная/белая точка и гамма (полутона).
 * @param inputBlack — значение, которое станет 0
 * @param inputWhite — значение, которое станет 255
 * @param gamma — 0.1–9.9, 1.0 = линейно
 */
export function buildLevelsLUT(
  inputBlack: number,
  inputWhite: number,
  gamma: number
): LUT {
  const lut = new Uint8Array(256);
  const black = Math.max(0, Math.min(255, Math.round(inputBlack)));
  const white = Math.max(0, Math.min(255, Math.round(inputWhite)));
  const g = Math.max(0.1, Math.min(9.9, gamma));

  if (white <= black) {
    return createIdentityLUT();
  }

  const range = white - black;
  const invGamma = 1 / g;

  for (let i = 0; i < 256; i++) {
    if (i <= black) {
      lut[i] = 0;
    } else if (i >= white) {
      lut[i] = 255;
    } else {
      const normalized = (i - black) / range;
      lut[i] = Math.round(
        255 * Math.pow(normalized, invGamma)
      );
    }
  }

  return lut;
}
