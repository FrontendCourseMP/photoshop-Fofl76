export type SourceFormat = 'png' | 'jpg' | 'gb7';

export type PixelData = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type ImageMeta = {
  width: number;
  height: number;
  bitDepth: string;
  colorType: string;
  hasAlpha: boolean;
  format: SourceFormat;
};

export type ActiveChannels = {
  red: boolean;
  green: boolean;
  blue: boolean;
  alpha: boolean;
};