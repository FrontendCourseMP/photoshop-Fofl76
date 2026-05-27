import { bilinearMethod } from "./bilinear";
import { nearestNeighborMethod } from "./nearestNeighbor";
import type {
  InterpolationMethod,
  InterpolationMethodId,
} from "./types";

export {
  DEFAULT_INTERPOLATION_ID,
  type InterpolationMethod,
  type InterpolationMethodId,
  type ResizeParams,
} from "./types";

const methods: Record<InterpolationMethodId, InterpolationMethod> = {
  nearest: nearestNeighborMethod,
  bilinear: bilinearMethod,
};

export const INTERPOLATION_METHODS: InterpolationMethod[] = [
  bilinearMethod,
  nearestNeighborMethod,
];

export function getInterpolationMethod(
  id: InterpolationMethodId
): InterpolationMethod {
  return methods[id];
}

export function registerInterpolationMethod(
  method: InterpolationMethod
): void {
  methods[method.id] = method;
}
