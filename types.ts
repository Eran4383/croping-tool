
export interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  croppedUrl?: string;
  name: string;
  isProcessing: boolean;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}
