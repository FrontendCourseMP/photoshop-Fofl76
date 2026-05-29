import {
  DEFAULT_INTERPOLATION_ID,
  getInterpolationMethod,
  type InterpolationMethodId,
} from "./interpolation";
import { imageWorkerClient } from "./ImageWorkerClient";

const ASYNC_RESAMPLE_PIXEL_THRESHOLD = 512 * 512;

export function computeViewDisplayDimensions(
  width: number,
  height: number,
  zoom: number
): { width: number; height: number } {
  if (zoom === 1) {
    return { width, height };
  }

  return {
    width: Math.max(1, Math.round(width * zoom)),
    height: Math.max(1, Math.round(height * zoom)),
  };
}

export function resampleImageDataSync(
  source: ImageData,
  zoom: number,
  methodId: InterpolationMethodId = DEFAULT_INTERPOLATION_ID
): ImageData {
  if (zoom === 1) {
    return source;
  }

  const { width: dstW, height: dstH } = computeViewDisplayDimensions(
    source.width,
    source.height,
    zoom
  );
  const method = getInterpolationMethod(methodId);
  const pixels = method.resize({
    source: source.data,
    srcWidth: source.width,
    srcHeight: source.height,
    dstWidth: dstW,
    dstHeight: dstH,
  });

  return new ImageData(new Uint8ClampedArray(pixels), dstW, dstH);
}

export async function resampleImageDataForView(
  source: ImageData,
  zoom: number,
  methodId: InterpolationMethodId = DEFAULT_INTERPOLATION_ID
): Promise<ImageData> {
  if (zoom === 1) {
    return source;
  }

  if (source.width * source.height <= ASYNC_RESAMPLE_PIXEL_THRESHOLD) {
    return resampleImageDataSync(source, zoom, methodId);
  }

  const { width: dstW, height: dstH } = computeViewDisplayDimensions(
    source.width,
    source.height,
    zoom
  );
  const pixels = await imageWorkerClient.resize(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height,
    dstW,
    dstH,
    methodId
  );

  return new ImageData(new Uint8ClampedArray(pixels), dstW, dstH);
}

export function mapCanvasPointToImage(
  canvasX: number,
  canvasY: number,
  canvasWidth: number,
  canvasHeight: number,
  panX: number,
  panY: number,
  displayWidth: number,
  displayHeight: number,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } {
  const dx = canvasX - canvasWidth / 2 - panX;
  const dy = canvasY - canvasHeight / 2 - panY;

  return {
    x: Math.floor(
      dx * (imageWidth / displayWidth) + imageWidth / 2
    ),
    y: Math.floor(
      dy * (imageHeight / displayHeight) + imageHeight / 2
    ),
  };
}
