export type InterpolationMethodId = "nearest" | "bilinear";

export type ResizeParams = {
  source: Uint8ClampedArray;
  srcWidth: number;
  srcHeight: number;
  dstWidth: number;
  dstHeight: number;
};

export interface InterpolationMethod {
  readonly id: InterpolationMethodId;
  readonly label: string;
  readonly description: string;
  resize(params: ResizeParams): Uint8ClampedArray;
}

export const DEFAULT_INTERPOLATION_ID: InterpolationMethodId = "bilinear";
