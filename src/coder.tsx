const GB7_SIGNATURE = [0x47, 0x42, 0x37, 0x1d] as const;
const GB7_VERSION = 0x01;

export function encodeGb7(imageData: ImageData, includeMask: boolean): Uint8Array<ArrayBuffer> {
  const { width, height, data } = imageData;
  const pixelCount = width * height;
  const buffer = new ArrayBuffer(12 + pixelCount);
  const output = new Uint8Array(buffer);
  const view = new DataView(buffer);

  GB7_SIGNATURE.forEach((value, index) => {
    output[index] = value;
  });

  output[4] = GB7_VERSION;
  output[5] = includeMask ? 0b00000001 : 0;
  view.setUint16(6, width, false);
  view.setUint16(8, height, false);
  view.setUint16(10, 0, false);

  for (let i = 0; i < pixelCount; i += 1) {
    const dataOffset = i * 4;
    const r = data[dataOffset];
    const g = data[dataOffset + 1];
    const b = data[dataOffset + 2];
    const a = data[dataOffset + 3];

    const gray8 = Math.round((r + g + b) / 3);
    const gray7 = Math.round((gray8 / 255) * 127) & 0x7f;
    const maskBit = includeMask ? (a > 0 ? 0x80 : 0x00) : 0x00;

    output[12 + i] = gray7 | maskBit;
  }

  return output;
}
