import type { ActiveChannels } from "../types";

export function applyChannelsToBuffer(
  source: Uint8ClampedArray,
  channels: ActiveChannels
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(source);

  for (let i = 0; i < out.length; i += 4) {
    if (!channels.red) {
      out[i] = 0;
    }
    if (!channels.green) {
      out[i + 1] = 0;
    }
    if (!channels.blue) {
      out[i + 2] = 0;
    }
    if (!channels.alpha) {
      out[i + 3] = 255;
    }
  }

  return out;
}

export function extractChannelBuffer(
  source: Uint8ClampedArray,
  channel: "red" | "green" | "blue" | "alpha"
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(source);

  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const a = out[i + 3];

    switch (channel) {
      case "red":
        out[i] = r;
        out[i + 1] = 0;
        out[i + 2] = 0;
        out[i + 3] = 255;
        break;
      case "green":
        out[i] = 0;
        out[i + 1] = g;
        out[i + 2] = 0;
        out[i + 3] = 255;
        break;
      case "blue":
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = b;
        out[i + 3] = 255;
        break;
      case "alpha":
        out[i] = a;
        out[i + 1] = a;
        out[i + 2] = a;
        out[i + 3] = 255;
        break;
    }
  }

  return out;
}

export function downscaleBuffer(
  source: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dstWidth * dstHeight * 4);

  for (let y = 0; y < dstHeight; y++) {
    const srcY = Math.min(
      srcHeight - 1,
      Math.floor((y * srcHeight) / dstHeight)
    );

    for (let x = 0; x < dstWidth; x++) {
      const srcX = Math.min(
        srcWidth - 1,
        Math.floor((x * srcWidth) / dstWidth)
      );
      const srcIdx = (srcY * srcWidth + srcX) * 4;
      const dstIdx = (y * dstWidth + x) * 4;
      out[dstIdx] = source[srcIdx];
      out[dstIdx + 1] = source[srcIdx + 1];
      out[dstIdx + 2] = source[srcIdx + 2];
      out[dstIdx + 3] = source[srcIdx + 3];
    }
  }

  return out;
}

export function hasAlphaInBuffer(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      return true;
    }
  }
  return false;
}
