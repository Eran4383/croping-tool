
import React, { useState, useCallback, useEffect } from 'react';
import { Dropzone } from './components/Dropzone';
import { ImageCard } from './components/ImageCard';
import { CropModal } from './components/CropModal';
import { ImageItem, PixelCrop } from './types';
import { getCroppedImg } from './utils/imageHelpers';
import { Download, Layers, Trash2, Github, Plus, Settings2, Square, RectangleHorizontal, RectangleVertical } from 'lucide-react';

const App: React.FC = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [globalAspect, setGlobalAspect] = useState<number | undefined>(1);

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
    if (images.length === 0) return;
    setIsProcessingAll(true);
    for (let i = 0; i < images.length; i++) {
      handleDownload(images[i]);
      await new Promise(r => setTimeout(r, 300)); // Delay to prevent browser blocking
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
              <span className="hidden md:inline-flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full uppercase tracking-wider">
                Local Only • No Uploads
              </span>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-900 transition-colors">
                <Github size={20} />
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <header className="text-center mb-12">
          <h1 className="text-5xl sm:text-6xl font-black text-slate-900 mb-6 tracking-tighter">
            Bulk Image <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-violet-600">Cropper</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">
            The fastest way to crop multiple images for social media, directly in your browser.
          </p>
        </header>

        {images.length === 0 ? (
          <div className="max-w-2xl mx-auto">
            <Dropzone onFilesAdded={handleFilesAdded} />
            <div className="mt-12 flex justify-center gap-12 opacity-30 grayscale">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                <div className="w-16 h-2 bg-slate-200 rounded"></div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                <div className="w-16 h-2 bg-slate-200 rounded"></div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                <div className="w-16 h-2 bg-slate-200 rounded"></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Global Toolbar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-6 items-center justify-between">
              <div className="flex items-center gap-4 w-full lg:w-auto">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                  <Settings2 size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Global Aspect Ratio</span>
                  <div className="flex gap-1 mt-1">
                    {[
                      { label: '1:1', value: 1, icon: <Square size={14} /> },
                      { label: '16:9', value: 16/9, icon: <RectangleHorizontal size={14} /> },
                      { label: '9:16', value: 9/16, icon: <RectangleVertical size={14} /> },
                      { label: 'Free', value: undefined, icon: <Layers size={14} /> },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => setGlobalAspect(opt.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${globalAspect === opt.value ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                      >
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0">
                <button
                  onClick={handleClearAll}
                  className="flex-1 lg:flex-none px-4 py-2.5 text-slate-400 hover:text-red-600 transition-colors font-bold text-sm flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} />
                  Clear
                </button>
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.accept = 'image/*';
                    input.onchange = (ev: any) => handleFilesAdded(Array.from(ev.target.files));
                    input.click();
                  }}
                  className="flex-1 lg:flex-none px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Add Images
                </button>
                <button
                  onClick={handleDownloadAll}
                  disabled={isProcessingAll}
                  className="flex-[2] lg:flex-none px-8 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95"
                >
                  <Download size={18} className={isProcessingAll ? "animate-bounce" : ""} />
                  {isProcessingAll ? "Processing..." : `Download ${images.length} Images`}
                </button>
              </div>
            </div>

            {/* Image Grid */}
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
          initialAspect={globalAspect}
          onClose={() => setEditingImageId(null)}
          onSave={handleSaveCrop}
        />
      )}

      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 py-3 px-6 flex justify-between items-center text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest">
        <span>&copy; {new Date().getFullYear()} InstaCrop Bulk</span>
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            Private Mode
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
