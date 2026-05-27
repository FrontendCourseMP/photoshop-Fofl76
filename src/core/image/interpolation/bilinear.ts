import type { InterpolationMethod, ResizeParams } from "./types";

function sampleBilinear(
  source: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  x: number,
  y: number
): [number, number, number, number] {
  const x0 = Math.max(0, Math.min(srcWidth - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(srcHeight - 1, Math.floor(y)));
  const x1 = Math.min(srcWidth - 1, x0 + 1);
  const y1 = Math.min(srcHeight - 1, y0 + 1);

  const fx = x - x0;
  const fy = y - y0;

  const i00 = (y0 * srcWidth + x0) * 4;
  const i10 = (y0 * srcWidth + x1) * 4;
  const i01 = (y1 * srcWidth + x0) * 4;
  const i11 = (y1 * srcWidth + x1) * 4;

  const channels: [number, number, number, number] = [0, 0, 0, 0];

  for (let c = 0; c < 4; c++) {
    const top =
      source[i00 + c] * (1 - fx) + source[i10 + c] * fx;
    const bottom =
      source[i01 + c] * (1 - fx) + source[i11 + c] * fx;
    channels[c] = Math.round(top * (1 - fy) + bottom * fy);
  }

  return channels;
}

export const bilinearMethod: InterpolationMethod = {
  id: "bilinear",
  label: "Билинейная",
  description:
    "Усредняет цвет четырёх соседних пикселей. Даёт более плавный результат при масштабировании, чем ближайший сосед; немного медленнее, но лучше подходит для фотографий.",
  resize({ source, srcWidth, srcHeight, dstWidth, dstHeight }: ResizeParams) {
    const output = new Uint8ClampedArray(dstWidth * dstHeight * 4);

    for (let y = 0; y < dstHeight; y++) {
      const srcY = ((y + 0.5) * srcHeight) / dstHeight - 0.5;

      for (let x = 0; x < dstWidth; x++) {
        const srcX = ((x + 0.5) * srcWidth) / dstWidth - 0.5;
        const [r, g, b, a] = sampleBilinear(
          source,
          srcWidth,
          srcHeight,
          srcX,
          srcY
        );
        const dstIdx = (y * dstWidth + x) * 4;
        output[dstIdx] = r;
        output[dstIdx + 1] = g;
        output[dstIdx + 2] = b;
        output[dstIdx + 3] = a;
      }
    }

    return output;
  },
};
