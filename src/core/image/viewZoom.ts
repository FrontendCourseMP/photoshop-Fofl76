export const VIEW_ZOOM_MIN = 0.12;
export const VIEW_ZOOM_MAX = 3;
export const CANVAS_FIT_PADDING_PX = 50;

/** Быстрый выбор масштаба просмотра; ресемплинг — через `resampleImageDataSync` / `getInterpolationMethod`. */
export const VIEW_ZOOM_PRESETS = [
  { label: "12%", value: 0.12 },
  { label: "25%", value: 0.25 },
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1 },
  { label: "150%", value: 1.5 },
  { label: "200%", value: 2 },
  { label: "300%", value: 3 },
] as const;

export function clampViewZoom(scale: number): number {
  return Math.min(VIEW_ZOOM_MAX, Math.max(VIEW_ZOOM_MIN, scale));
}

export function computeFitViewZoom(
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
  padding = CANVAS_FIT_PADDING_PX
): number {
  const availableWidth = Math.max(1, containerWidth - padding * 2);
  const availableHeight = Math.max(1, containerHeight - padding * 2);
  const fitScale = Math.min(
    availableWidth / imageWidth,
    availableHeight / imageHeight
  );

  return clampViewZoom(fitScale);
}
