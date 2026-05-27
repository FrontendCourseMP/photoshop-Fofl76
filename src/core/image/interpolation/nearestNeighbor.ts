import type { InterpolationMethod, ResizeParams } from "./types";

function sampleNearest(
  source: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  x: number,
  y: number
): [number, number, number, number] {
  const sx = Math.min(srcWidth - 1, Math.max(0, Math.floor(x)));
  const sy = Math.min(srcHeight - 1, Math.max(0, Math.floor(y)));
  const idx = (sy * srcWidth + sx) * 4;
  return [
    source[idx],
    source[idx + 1],
    source[idx + 2],
    source[idx + 3],
  ];
}

export const nearestNeighborMethod: InterpolationMethod = {
  id: "nearest",
  label: "Ближайший сосед",
  description:
    "Берёт цвет ближайшего пикселя исходного изображения. Быстрый метод без сглаживания; при увеличении видны «ступеньки», при уменьшении возможны артефакты муара.",
  resize({ source, srcWidth, srcHeight, dstWidth, dstHeight }: ResizeParams) {
    const output = new Uint8ClampedArray(dstWidth * dstHeight * 4);

    for (let y = 0; y < dstHeight; y++) {
      const srcY = ((y + 0.5) * srcHeight) / dstHeight - 0.5;

      for (let x = 0; x < dstWidth; x++) {
        const srcX = ((x + 0.5) * srcWidth) / dstWidth - 0.5;
        const [r, g, b, a] = sampleNearest(
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
