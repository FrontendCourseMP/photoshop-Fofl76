const GB7_SIGNATURE = [0x47, 0x42, 0x37, 0x1d] as const;
const GB7_VERSION = 0x01;

export function decodeGb7(buffer: ArrayBuffer): { imageData: ImageData; hasMask: boolean } {
  const view = new DataView(buffer);
  if (view.byteLength < 12) throw new Error('GB7: недостаточно данных (файл слишком мал)');

  for (let i = 0; i < GB7_SIGNATURE.length; i += 1) {
    if (view.getUint8(i) !== GB7_SIGNATURE[i]) {
      throw new Error('GB7: неверная сигнатура файла');
    }
  }

  const version = view.getUint8(4);
  if (version !== GB7_VERSION) throw new Error(`GB7: неподдерживаемая версия ${version}`);

  const flags = view.getUint8(5);
  if ((flags & 0b11111110) !== 0) {
    throw new Error('GB7: зарезервированные биты флагов должны быть равны 0');
  }

  const hasMask = (flags & 0b00000001) === 1;
  const width = view.getUint16(6, false);
  const height = view.getUint16(8, false);
  const reserved = view.getUint16(10, false);

  if (reserved !== 0) throw new Error('GB7: зарезервированное поле должно быть 0x0000');
  if (width === 0 || height === 0) throw new Error('GB7: ширина и высота не могут быть нулевыми');

  const pixelCount = width * height;
  const expectedLength = 12 + pixelCount;
  if (view.byteLength !== expectedLength) {
    throw new Error('GB7: размер файла не соответствует ожидаемому');
  }

  const rgba = new Uint8ClampedArray(pixelCount * 4);
  let rgbaIndex = 0;

  for (let i = 0; i < pixelCount; i += 1) {
    const byte = view.getUint8(12 + i);
    const gray7 = byte & 0x7f;
    const maskBit = (byte & 0x80) !== 0;
    const gray8 = Math.round((gray7 / 127) * 255);

    rgba[rgbaIndex] = gray8;
    rgba[rgbaIndex + 1] = gray8;
    rgba[rgbaIndex + 2] = gray8;
    rgba[rgbaIndex + 3] = hasMask ? (maskBit ? 255 : 0) : 255;
    rgbaIndex += 4;
  }

  return { imageData: new ImageData(rgba, width, height), hasMask };
}
