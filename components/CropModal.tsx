
import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, Square, RectangleHorizontal, RectangleVertical, Move, Hash } from 'lucide-react';
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

    const w = type === 'width' ? parseInt(val) : parseInt(manualWidth);
    const h = type === 'height' ? parseInt(val) : parseInt(manualHeight);

    if (w > 0 && h > 0) {
      setAspect(w / h);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-5xl h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Advanced Image Crop</h3>
            <p className="text-xs text-slate-500 truncate max-w-xs">{imageName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Cropper Area */}
        <div className="flex-1 relative bg-slate-900 overflow-hidden">
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

        {/* Advanced Controls */}
        <div className="p-6 bg-white border-t border-slate-200">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-end">
            
            {/* Aspect Ratio Buttons */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Aspect Ratio</span>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setAspect(1)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${aspect === 1 ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Square size={14} /> 1:1
                </button>
                <button
                  onClick={() => setAspect(16/9)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${aspect === 16/9 ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <RectangleHorizontal size={14} /> 16:9
                </button>
                <button
                  onClick={() => setAspect(undefined)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${aspect === undefined ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Move size={14} /> Free
                </button>
              </div>
            </div>

            {/* Manual Dimensions */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Manual Dimensions (PX)</span>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">W</span>
                  <input
                    type="number"
                    value={manualWidth}
                    onChange={(e) => handleManualDimensionChange(e, 'width')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="Width"
                  />
                </div>
                <X size={14} className="text-slate-300" />
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">H</span>
                  <input
                    type="number"
                    value={manualHeight}
                    onChange={(e) => handleManualDimensionChange(e, 'height')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="Height"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => croppedAreaPixels && onSave(croppedAreaPixels)}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                <Check size={20} />
                Save Changes
              </button>
            </div>
          </div>
          
          {/* Zoom Slider */}
          <div className="mt-6 flex items-center gap-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zoom</span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.01}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <span className="text-xs font-bold text-slate-600 w-8">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
