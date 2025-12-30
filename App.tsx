
import React, { useState, useCallback, useEffect } from 'react';
import { Dropzone } from './components/Dropzone';
import { ImageCard } from './components/ImageCard';
import { CropModal } from './components/CropModal';
import { ImageItem, PixelCrop } from './types';
import { getCroppedImg } from './utils/imageHelpers';
import { Download, Layers, Trash2, Github } from 'lucide-react';

const App: React.FC = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);

  const handleFilesAdded = useCallback((files: File[]) => {
    if (files.length === 0) return;
    
    const newItems: ImageItem[] = files.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name || `Pasted Image - ${new Date().toLocaleTimeString()}`,
      isProcessing: false,
    }));
    setImages((prev) => [...prev, ...newItems]);
  }, []);

  // Robust Paste Listener
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

      if (files.length > 0) {
        handleFilesAdded(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFilesAdded]);

  const handleRemove = (id: string) => {
    setImages((prev) => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const handleClearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.previewUrl));
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
    link.download = `cropped-${item.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    images.forEach((item) => handleDownload(item));
  };

  const editingImage = images.find((i) => i.id === editingImageId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <Layers className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-black tracking-tight text-slate-900">InstaCrop</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
              <span className="hidden sm:inline bg-slate-100 px-2 py-1 rounded">Hint: CTRL+V anywhere to paste</span>
              <a href="#" className="text-slate-500 hover:text-slate-900 transition-colors ml-2">
                <Github size={20} />
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
            Bulk Image <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Cropping</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Upload, <span className="font-semibold text-indigo-600">Paste (CTRL+V)</span>, or drag images. Everything stays in your browser.
          </p>
        </div>

        {images.length === 0 ? (
          <div className="max-w-2xl mx-auto">
            <Dropzone onFilesAdded={handleFilesAdded} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-4">
                <p className="text-sm font-medium text-slate-500">
                  <span className="text-indigo-600 font-bold">{images.length}</span> images loaded
                </p>
                <div className="h-4 w-[1px] bg-slate-200 hidden sm:block"></div>
                <button
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-semibold"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.accept = 'image/*';
                    input.onchange = (ev: any) => handleFilesAdded(Array.from(ev.target.files));
                    input.click();
                  }}
                >
                  Add More
                </button>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleClearAll}
                  className="flex-1 sm:flex-none px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} />
                  Clear
                </button>
                <button
                  onClick={handleDownloadAll}
                  className="flex-1 sm:flex-none px-6 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Download All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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

      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 py-3 text-center text-xs text-slate-400 font-medium">
        All images are processed locally. No data is sent to any server.
      </footer>
    </div>
  );
};

export default App;
