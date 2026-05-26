/** sRGB (0–255) → CIELAB (D65). */
export type CIELAB = {
  L: number;
  a: number;
  b: number;
};

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045
    ? c / 12.92
    : Math.pow((c + 0.055) / 1.055, 2.4);
}

function labF(t: number): number {
  const delta = 6 / 29;
  return t > delta ** 3
    ? Math.cbrt(t)
    : t / (3 * delta ** 2) + 4 / 29;
}

export function rgbToCIELAB(
  r: number,
  g: number,
  b: number
): CIELAB {
  const R = srgbChannelToLinear(r);
  const G = srgbChannelToLinear(g);
  const B = srgbChannelToLinear(b);

  let x =
    R * 0.4124564 +
    G * 0.3575761 +
    B * 0.1804375;
  let y =
    R * 0.2126729 +
    G * 0.7151522 +
    B * 0.072175;
  let z =
    R * 0.0193339 +
    G * 0.119192 +
    B * 0.9503041;

  x /= 0.95047;
  y /= 1.0;
  z /= 1.08883;

  const fy = labF(y);
  const L = 116 * fy - 16;
  const a = 500 * (labF(x) - fy);
  const bVal = 200 * (fy - labF(z));

  const round2 = (n: number) =>
    Math.round(n * 100) / 100;

  return {
    L: round2(L),
    a: round2(a),
    b: round2(bVal),
  };
}

export function formatCIELAB(lab: CIELAB): string {
  return `L*${lab.L} a*${lab.a} b*${lab.b}`;
}
