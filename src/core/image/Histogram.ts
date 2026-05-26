import type { ImageModel } from "./ImageModel";

export type HistogramChannel =
  | "master"
  | "red"
  | "green"
  | "blue"
  | "alpha";

export type HistogramData = {
  bins: number[];
  maxCount: number;
};

const BIN_COUNT = 256;

/** Светлотность по ITU-R BT.601 (как в задании для композитной гистограммы). */
export function compositeLuminance(
  r: number,
  g: number,
  b: number
): number {
  return Math.round(
    0.299 * r + 0.587 * g + 0.114 * b
  );
}

export function computeHistogram(
  image: ImageModel,
  channel: HistogramChannel
): HistogramData {
  const bins = new Array<number>(BIN_COUNT).fill(0);
  const data = image.getRawData();
  let maxCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    let value: number;

    switch (channel) {
      case "master":
        value = compositeLuminance(
          data[i],
          data[i + 1],
          data[i + 2]
        );
        break;
      case "red":
        value = data[i];
        break;
      case "green":
        value = data[i + 1];
        break;
      case "blue":
        value = data[i + 2];
        break;
      case "alpha":
        value = data[i + 3];
        break;
    }

    value = Math.max(0, Math.min(255, value));
    bins[value]++;
    if (bins[value] > maxCount) {
      maxCount = bins[value];
    }
  }

  return { bins, maxCount };
}
