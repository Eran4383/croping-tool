
import React from 'react';
import { Crop, Download, Trash2, CheckCircle2 } from 'lucide-react';
import { ImageItem } from '../types';

interface ImageCardProps {
  item: ImageItem;
  onCrop: (id: string) => void;
  onRemove: (id: string) => void;
  onDownload: (item: ImageItem) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({ item, onCrop, onRemove, onDownload }) => {
  return (
    <div className="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all hover:shadow-md">
      <div className="relative aspect-square bg-slate-100 overflow-hidden">
        <img
          src={item.croppedUrl || item.previewUrl}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {item.croppedUrl && (
          <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full shadow-lg">
            <CheckCircle2 size={16} />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={() => onCrop(item.id)}
            className="p-2.5 bg-white text-slate-800 rounded-full hover:bg-indigo-600 hover:text-white transition-colors"
            title="Edit Crop"
          >
            <Crop size={20} />
          </button>
          {item.croppedUrl && (
            <button
              onClick={() => onDownload(item)}
              className="p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors"
              title="Download Cropped"
            >
              <Download size={20} />
            </button>
          )}
          <button
            onClick={() => onRemove(item.id)}
            className="p-2.5 bg-white text-red-600 rounded-full hover:bg-red-600 hover:text-white transition-colors"
            title="Remove"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-slate-700 truncate" title={item.name}>
          {item.name}
        </p>
      </div>
    </div>
  );
};
