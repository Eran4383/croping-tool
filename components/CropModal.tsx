
import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, Square, RectangleHorizontal, RectangleVertical, Move, ZoomIn } from 'lucide-react';
import { PixelCrop } from '../types';

interface CropModalProps {
  isOpen: boolean;
  imageSrc: string;
  imageName: string;
  initialAspect?: number;
  onClose: () => void;
  onSave: (croppedAreaPixels: PixelCrop) => void;
}

export const CropModal: React.FC<CropModalProps> = ({ isOpen, imageSrc, imageName, initialAspect, onClose, onSave }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(initialAspect);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null);

  const [manualWidth, setManualWidth] = useState<string>('');
  const [manualHeight, setManualHeight] = useState<string>('');

  useEffect(() => {
    setAspect(initialAspect);
  }, [initialAspect]);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: PixelCrop) => {
    setCroppedAreaPixels(croppedAreaPixels);
    setManualWidth(Math.round(croppedAreaPixels.width).toString());
    setManualHeight(Math.round(croppedAreaPixels.height).toString());
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl h-full sm:h-[85vh] sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-slate-800">Edit Crop</h3>
            <span className="text-xs text-slate-400 truncate max-w-[200px] bg-slate-50 px-2 py-1 rounded">{imageName}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        {/* Cropper */}
        <div className="flex-1 relative bg-slate-100">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        {/* Footer Controls */}
        <div className="p-6 bg-white border-t border-slate-100 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            
            {/* Aspect Ratios */}
            <div className="space-y-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Aspect Ratio</span>
              <div className="flex gap-2">
                {[
                  { label: 'Square', value: 1, icon: <Square size={14} /> },
                  { label: 'Landscape', value: 16/9, icon: <RectangleHorizontal size={14} /> },
                  { label: 'Portrait', value: 9/16, icon: <RectangleVertical size={14} /> },
                  { label: 'Free', value: undefined, icon: <Move size={14} /> },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setAspect(opt.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${aspect === opt.value ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="hidden md:flex gap-6 items-center px-6 py-2 bg-slate-50 rounded-2xl border border-slate-100">
               <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Width</span>
                  <span className="text-sm font-black text-slate-700">{manualWidth}px</span>
               </div>
               <div className="w-[1px] h-6 bg-slate-200"></div>
               <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Height</span>
                  <span className="text-sm font-black text-slate-700">{manualHeight}px</span>
               </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => croppedAreaPixels && onSave(croppedAreaPixels)}
                className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
              >
                <Check size={18} />
                Apply
              </button>
            </div>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-4">
            <ZoomIn size={16} className="text-slate-400" />
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.01}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600"
            />
            <span className="text-xs font-bold text-slate-400 w-10 text-right">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
