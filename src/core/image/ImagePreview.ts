import { ImageModel } from './ImageModel';

export type ChannelPreview = {
  mode: string;
  previewUrl: string;
};

export class ImagePreview {
  static generate(model: ImageModel): ChannelPreview[] {
    const channels = ['red', 'green', 'blue'];

    return channels.map(channel => {
      const cloned = model.clone();
      const data = cloned.getRawData();

      for (let i = 0; i < data.length; i += 4) {
        if (channel !== 'red') data[i] = 0;
        if (channel !== 'green') data[i + 1] = 0;
        if (channel !== 'blue') data[i + 2] = 0;
      }

      const imageData = cloned.toImageData();

      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return {
          mode: channel,
          previewUrl: '',
        };
      }

      ctx.putImageData(imageData, 0, 0);

      return {
        mode: channel,
        previewUrl: canvas.toDataURL(),
      };
    });
  }
}