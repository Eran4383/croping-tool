
import React, { useState, useCallback, useEffect } from 'react';
import { Dropzone } from './components/Dropzone';
import { ImageCard } from './components/ImageCard';
import { CropModal } from './components/CropModal';
import { ImageItem, PixelCrop } from './types';
import { getCroppedImg } from './utils/imageHelpers';
import { Download, Layers, Trash2, Github, Plus } from 'lucide-react';

const App: React.FC = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  const handleFilesAdded = useCallback((files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;
    
    const newItems: ImageItem[] = validFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name || `Image-${Date.now()}`,
      isProcessing: false,
    }));
    setImages((prev) => [...prev, ...newItems]);
  }, []);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile();
          if (blob) {
            const file = new File([blob], `pasted-${Date.now()}.png`, { type: blob.type });
            files.push(file);
          }
        }
      }
      if (files.length > 0) handleFilesAdded(files);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFilesAdded]);

  const handleRemove = (id: string) => {
    setImages((prev) => {
      const item = prev.find(i => i.id === id);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
        if (item.croppedUrl) URL.revokeObjectURL(item.croppedUrl);
      }
      return prev.filter(i => i.id !== id);
    });
  };

  const handleClearAll = () => {
    images.forEach(img => {
      URL.revokeObjectURL(img.previewUrl);
      if (img.croppedUrl) URL.revokeObjectURL(img.croppedUrl);
    });
    setImages([]);
  };

  const handleSaveCrop = async (pixelCrop: PixelCrop) => {
    if (!editingImageId) return;

    const item = images.find((i) => i.id === editingImageId);
    if (!item) return;

    try {
      const croppedUrl = await getCroppedImg(item.previewUrl, pixelCrop);
      setImages((prev) =>
        prev.map((i) => (i.id === editingImageId ? { ...i, croppedUrl } : i))
      );
      setEditingImageId(null);
    } catch (e) {
      console.error('Failed to crop image', e);
    }
  };

  const handleDownload = (item: ImageItem) => {
    const url = item.croppedUrl || item.previewUrl;
    const link = document.createElement('a');
    link.href = url;
    link.download = `cropped-${item.name.split('.')[0]}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = async () => {
    setIsProcessingAll(true);
    // Sequence downloads to avoid browser blocking multiple triggers
    for (let i = 0; i < images.length; i++) {
      handleDownload(images[i]);
      await new Promise(r => setTimeout(r, 200));
    }
    setIsProcessingAll(false);
  };

  const editingImage = images.find((i) => i.id === editingImageId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 selection:bg-indigo-100">
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-1.5 rounded-lg shadow-indigo-200 shadow-lg">
                <Layers className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-black tracking-tight text-slate-900">InstaCrop</span>
            </div>
            <div className="flex items-center gap-6">
              <span className="hidden md:inline-flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                <kbd className="bg-white border border-slate-200 px-1 rounded shadow-sm">CTRL+V</kbd> to paste anywhere
              </span>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-900 transition-colors">
                <Github size={22} />
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <header className="text-center mb-16">
          <h1 className="text-5xl sm:text-6xl font-black text-slate-900 mb-6 tracking-tight">
            Bulk Image <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-violet-600">Cropping</span>
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
            Professional browser-based image tools. No uploads, no servers, just speed.
          </p>
        </header>

        {images.length === 0 ? (
          <div className="max-w-2xl mx-auto scale-105 transform transition-all">
            <Dropzone onFilesAdded={handleFilesAdded} />
            <div className="mt-12 grid grid-cols-3 gap-8 opacity-40 grayscale pointer-events-none">
              <div className="h-32 bg-slate-200 rounded-2xl animate-pulse"></div>
              <div className="h-32 bg-slate-200 rounded-2xl animate-pulse delay-75"></div>
              <div className="h-32 bg-slate-200 rounded-2xl animate-pulse delay-150"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-5 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/60 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-6 pl-2">
                <div>
                  <p className="text-sm font-bold text-slate-800 leading-none mb-1">
                    {images.length} Images
                  </p>
                  <p className="text-xs text-slate-400 font-medium italic">Ready for processing</p>
                </div>
                <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>
                <button
                  className="flex items-center gap-2 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.accept = 'image/*';
                    input.onchange = (ev: any) => handleFilesAdded(Array.from(ev.target.files));
                    input.click();
                  }}
                >
                  <Plus size={18} />
                  Add More
                </button>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleClearAll}
                  className="flex-1 sm:flex-none px-5 py-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} />
                  Reset
                </button>
                <button
                  onClick={handleDownloadAll}
                  disabled={isProcessingAll}
                  className="flex-1 sm:flex-none px-8 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95"
                >
                  <Download size={18} className={isProcessingAll ? "animate-bounce" : ""} />
                  {isProcessingAll ? "Downloading..." : "Download All"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {images.map((img) => (
                <ImageCard
                  key={img.id}
                  item={img}
                  onCrop={(id) => setEditingImageId(id)}
                  onRemove={handleRemove}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {editingImage && (
        <CropModal
          isOpen={!!editingImageId}
          imageSrc={editingImage.previewUrl}
          imageName={editingImage.name}
          onClose={() => setEditingImageId(null)}
          onSave={handleSaveCrop}
        />
      )}

      <footer className="fixed bottom-0 left-0 right-0 bg-white/60 backdrop-blur-xl border-t border-slate-100 py-3 px-6 flex justify-between items-center text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest">
        <span>&copy; {new Date().getFullYear()} InstaCrop Bulk</span>
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
          Local Processing Active
        </span>
      </footer>
    </div>
  );
};

export default App;
