
import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, Square, RectangleHorizontal, RectangleVertical, Move, ZoomIn } from 'lucide-react';
import { PixelCrop } from '../types';

interface CropModalProps {
  isOpen: boolean;
  imageSrc: string;
  imageName: string;
  onClose: () => void;
  onSave: (croppedAreaPixels: PixelCrop) => void;
}

export const CropModal: React.FC<CropModalProps> = ({ isOpen, imageSrc, imageName, onClose, onSave }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null);

  const [manualWidth, setManualWidth] = useState<string>('');
  const [manualHeight, setManualHeight] = useState<string>('');

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: PixelCrop) => {
    setCroppedAreaPixels(croppedAreaPixels);
    setManualWidth(Math.round(croppedAreaPixels.width).toString());
    setManualHeight(Math.round(croppedAreaPixels.height).toString());
  }, []);

  const handleManualDimensionChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'width' | 'height') => {
    const val = e.target.value;
    if (type === 'width') setManualWidth(val);
    else setManualHeight(val);

    // If both are numbers, we can set aspect if needed, but usually we just let the cropper reflect it
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl h-full sm:h-[90vh] sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-white/20">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
              <Move size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Fine-tune Crop</h3>
              <p className="text-xs text-slate-400 font-bold truncate max-w-[200px] uppercase tracking-tighter">{imageName}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors active:scale-90"
          >
            <X size={24} />
          </button>
        </div>

        {/* Cropper Area - CRITICAL: must be relative */}
        <div className="flex-1 relative bg-slate-950">
          <div className="absolute inset-0">
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
        </div>

        {/* Advanced Controls */}
        <div className="p-8 bg-white border-t border-slate-100">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-end">
            
            {/* Aspect Ratio Selection */}
            <div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-4">Ratio Presets</span>
              <div className="grid grid-cols-4 gap-2 bg-slate-50 p-1.5 rounded-2xl">
                <button
                  onClick={() => setAspect(1)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-[10px] font-black transition-all ${aspect === 1 ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-100' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Square size={16} /> 1:1
                </button>
                <button
                  onClick={() => setAspect(16/9)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-[10px] font-black transition-all ${aspect === 16/9 ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-100' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <RectangleHorizontal size={16} /> 16:9
                </button>
                <button
                  onClick={() => setAspect(9/16)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-[10px] font-black transition-all ${aspect === 9/16 ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-100' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <RectangleVertical size={16} /> 9:16
                </button>
                <button
                  onClick={() => setAspect(undefined)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-[10px] font-black transition-all ${aspect === undefined ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-100' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Move size={16} /> Free
                </button>
              </div>
            </div>

            {/* Dimension Indicators */}
            <div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-4">Current Output (PX)</span>
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex-1 flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Width</span>
                  <span className="text-xl font-black text-slate-800 leading-none">{manualWidth}</span>
                </div>
                <div className="text-slate-200">
                  <X size={16} strokeWidth={3} />
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Height</span>
                  <span className="text-xl font-black text-slate-800 leading-none">{manualHeight}</span>
                </div>
              </div>
            </div>

            {/* Final Actions */}
            <div className="flex gap-4">
              <button
                onClick={onClose}
                className="flex-1 py-4 rounded-2xl font-black text-sm text-slate-500 bg-slate-50 hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => croppedAreaPixels && onSave(croppedAreaPixels)}
                className="flex-[2] flex items-center justify-center gap-3 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95"
              >
                <Check size={20} strokeWidth={3} />
                Apply Changes
              </button>
            </div>
          </div>
          
          {/* Zoom Slider */}
          <div className="mt-10 flex items-center gap-6">
            <div className="text-slate-400">
              <ZoomIn size={18} />
            </div>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.01}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600"
            />
            <span className="text-xs font-black text-slate-500 min-w-[40px] tabular-nums">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
