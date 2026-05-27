import type { ActiveChannels } from "../types";

export type EdgeHandlingWire = "black" | "white" | "copy";
export type KernelFilterTypeWire = "kernel" | "median";

export type KernelFilterStateWire = {
  filterType: KernelFilterTypeWire;
  kernel3x3: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  channels: ActiveChannels;
  edgeHandling: EdgeHandlingWire;
};

function clampByte(v: number): number {
  if (v <= 0) return 0;
  if (v >= 255) return 255;
  return v | 0;
}

function sampleChannel(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  channelOffset: number,
  edge: EdgeHandlingWire
): number {
  if (x >= 0 && y >= 0 && x < width && y < height) {
    return source[(y * width + x) * 4 + channelOffset];
  }

  if (edge === "copy") {
    const cx = Math.min(width - 1, Math.max(0, x));
    const cy = Math.min(height - 1, Math.max(0, y));
    return source[(cy * width + cx) * 4 + channelOffset];
  }

  return edge === "white" ? 255 : 0;
}

function applyKernelAt(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  channelOffset: number,
  kernel: KernelFilterStateWire["kernel3x3"],
  edge: EdgeHandlingWire
): number {
  let acc = 0;
  let k = 0;
  for (let ky = -1; ky <= 1; ky++) {
    for (let kx = -1; kx <= 1; kx++) {
      const v = sampleChannel(
        source,
        width,
        height,
        x + kx,
        y + ky,
        channelOffset,
        edge
      );
      acc += v * kernel[k++];
    }
  }
  return clampByte(Math.round(acc));
}

function applyMedianAt(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  channelOffset: number,
  edge: EdgeHandlingWire
): number {
  const values = new Array<number>(9);
  let idx = 0;
  for (let ky = -1; ky <= 1; ky++) {
    for (let kx = -1; kx <= 1; kx++) {
      values[idx++] = sampleChannel(
        source,
        width,
        height,
        x + kx,
        y + ky,
        channelOffset,
        edge
      );
    }
  }
  values.sort((a, b) => a - b);
  return values[4];
}

function normalizeKernel3x3(
  kernel: KernelFilterStateWire["kernel3x3"]
): KernelFilterStateWire["kernel3x3"] {
  // Если сумма близка к 0 (резкие/градиентные ядра), нормализация не нужна.
  let sum = 0;
  for (const v of kernel) sum += v;
  if (Math.abs(sum) < 1e-9 || Math.abs(sum - 1) < 1e-9) {
    return kernel;
  }
  return kernel.map((v) => v / sum) as KernelFilterStateWire["kernel3x3"];
}

export function applyKernelFilterToBuffer(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  state: KernelFilterStateWire
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(source);

  const kernel =
    state.filterType === "kernel"
      ? normalizeKernel3x3(state.kernel3x3)
      : state.kernel3x3;

  const edge = state.edgeHandling;
  const { channels } = state;

  const offsets: Array<[keyof ActiveChannels, number]> = [
    ["red", 0],
    ["green", 1],
    ["blue", 2],
    ["alpha", 3],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const base = (y * width + x) * 4;
      for (const [ch, off] of offsets) {
        if (!channels[ch]) continue;

        const v =
          state.filterType === "median"
            ? applyMedianAt(source, width, height, x, y, off, edge)
            : applyKernelAt(source, width, height, x, y, off, kernel, edge);
        out[base + off] = v;
      }
    }
  }

  return out;
}

