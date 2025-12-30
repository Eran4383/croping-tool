
import React, { useCallback, useRef } from 'react';
import { Upload, Image as ImageIcon, ClipboardPaste } from 'lucide-react';

interface DropzoneProps {
  onFilesAdded: (files: File[]) => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFilesAdded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { files } = e.dataTransfer;
    if (files && files.length > 0) {
      onFilesAdded(Array.from(files));
    }
  }, [onFilesAdded]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesAdded(Array.from(e.target.files));
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className="group relative border-2 border-dashed border-slate-300 rounded-2xl p-12 transition-all hover:border-indigo-500 hover:bg-indigo-50/50 cursor-pointer flex flex-col items-center justify-center gap-4 bg-white shadow-sm"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
        accept="image/*"
      />
      <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center transition-transform group-hover:scale-110">
        <Upload className="w-8 h-8 text-indigo-600" />
      </div>
      <div className="text-center">
        <h3 className="text-xl font-semibold text-slate-800">Drop images, click to browse</h3>
        <p className="text-slate-500 mt-1">or simply <span className="font-bold text-indigo-600">Paste (Ctrl+V)</span> anywhere</p>
      </div>
      <div className="flex gap-4">
        <div className="flex gap-2 items-center text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
          <ImageIcon size={14} />
          PNG, JPG, WebP
        </div>
        <div className="flex gap-2 items-center text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
          <ClipboardPaste size={14} />
          Clipboard Support
        </div>
      </div>
    </div>
  );
};
