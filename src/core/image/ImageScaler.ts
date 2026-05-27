import {
  DEFAULT_INTERPOLATION_ID,
  getInterpolationMethod,
  type InterpolationMethodId,
} from "./interpolation";
import { ImageModel } from "./ImageModel";

export function scaleImageModel(
  source: ImageModel,
  newWidth: number,
  newHeight: number,
  methodId: InterpolationMethodId = DEFAULT_INTERPOLATION_ID
): ImageModel {
  const dstWidth = Math.max(1, Math.round(newWidth));
  const dstHeight = Math.max(1, Math.round(newHeight));

  if (dstWidth === source.width && dstHeight === source.height) {
    return source.clone();
  }

  const method = getInterpolationMethod(methodId);
  const pixels = method.resize({
    source: source.getRawData(),
    srcWidth: source.width,
    srcHeight: source.height,
    dstWidth,
    dstHeight,
  });

  return new ImageModel(dstWidth, dstHeight, {
    ...source.meta,
    width: dstWidth,
    height: dstHeight,
  }, pixels);
}

export function megapixels(width: number, height: number): number {
  return (width * height) / 1_000_000;
}

export function formatMegapixels(width: number, height: number): string {
  return `${megapixels(width, height).toFixed(2)} Мп`;
}
