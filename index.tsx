
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Scissors, 
  Download, 
  X, 
  Check, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Loader2, 
  Trash2, 
  Maximize, 
  RotateCcw, 
  RotateCw,
  Image as ImageIcon,
  MousePointer2,
  Move,
  Undo,
  Settings,
  SlidersHorizontal,
  LayoutGrid,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import { jsPDF } from 'jspdf';

const VERSION = "v5.1.6";

interface ImageItem {
  id: string;
  url: string;
  name: string;
  croppedUrl: string | null;
  cropConfig: {
    crop: Crop;
    aspect: number | undefined;
    rotation: number;
  } | null;
  selected: boolean;
}

const App = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(true);
  
  // Editor States
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [aspect, setAspect] = useState<number | undefined>(undefined); // Start with 'Free' by default
  const [rotation, setRotation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'transform' | 'adjust' | 'resize' | 'enhance'>('transform');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const selectedCount = useMemo(() => images.filter(img => img.selected).length, [images]);

  const handleAddImages = useCallback((files: FileList | null) => {
    if (!files) return;
    const newImgs = Array.from(files).filter(f => f.type.startsWith('image/')).map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      url: URL.createObjectURL(f),
      name: f.name,
      croppedUrl: null,
      cropConfig: null,
      selected: true
    }));
    setImages(prev => [...prev, ...newImgs]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    if (images.length === 0 && newImgs.length > 0) {
      setEditingIdx(0);
    }
  }, [images]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        const files: File[] = [];
        for (const item of Array.from(items)) {
          if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
        if (files.length > 0) {
          const dataTransfer = new DataTransfer();
          files.forEach(f => dataTransfer.items.add(f));
          handleAddImages(dataTransfer.files);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleAddImages]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    let initialCrop;
    if (aspect === undefined) {
      // Free mode default to full image (100% width and height)
      initialCrop = { unit: '%' as const, x: 0, y: 0, width: 100, height: 100 };
    } else {
      initialCrop = centerCrop(
        makeAspectCrop({ unit: '%' as const, width: 90 }, aspect, width, height),
        width,
        height
      );
    }
    setCrop(initialCrop);
  };

  const toggleSelect = (id: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, selected: !img.selected } : img));
  };

  const selectAll = () => {
    setImages(prev => prev.map(img => ({ ...img, selected: true })));
  };

  const handleApplyBatch = async () => {
    if (!completedCrop || !imgRef.current || editingIdx === null) return;
    setIsProcessing(true);

    const sourceWidth = imgRef.current.width;
    const sourceHeight = imgRef.current.height;
    
    const pX = (completedCrop.x / sourceWidth) * 100;
    const pY = (completedCrop.y / sourceHeight) * 100;
    const pW = (completedCrop.width / sourceWidth) * 100;
    const pH = (completedCrop.height / sourceHeight) * 100;

    const updated = await Promise.all(images.map(async (img) => {
      if (!img.selected && img.id !== images[editingIdx].id) return img;

      const tempImg = new Image();
      tempImg.src = img.url;
      await new Promise(r => tempImg.onload = r);
      
      const canvas = document.createElement('canvas');
      const realX = (pX * tempImg.naturalWidth) / 100;
      const realY = (pY * tempImg.naturalHeight) / 100;
      const realW = (pW * tempImg.naturalWidth) / 100;
      const realH = (pH * tempImg.naturalHeight) / 100;
      
      canvas.width = realW;
      canvas.height = realH;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(tempImg, realX, realY, realW, realH, 0, 0, realW, realH);
      
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9));
      return {
        ...img,
        croppedUrl: blob ? URL.createObjectURL(blob) : null,
        cropConfig: {
          crop: { unit: '%', x: pX, y: pY, width: pW, height: pH } as Crop,
          aspect,
          rotation
        }
      };
    }));

    setImages(updated);
    setIsProcessing(false);
    setEditingIdx(null);
  };

  const handleDownloadSelected = async () => {
    const selected = images.filter(i => i.selected);
    for (const img of selected) {
      if (img.croppedUrl) {
        const link = document.createElement('a');
        link.href = img.croppedUrl;
        link.download = `cropped_${img.name.split('.')[0]}.jpg`;
        link.click();
        await new Promise(r => setTimeout(r, 200));
      }
    }
  };

  if (editingIdx === null && images.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background-light dark:bg-background-dark transition-colors duration-300">
        <div className="w-full max-w-md bg-white dark:bg-surface-dark rounded-[3rem] shadow-xl overflow-hidden flex flex-col relative transition-all">
          <header className="flex items-center justify-between px-8 py-8">
            <div className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">
              {VERSION}
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">Bulk Crop Pro</h1>
              <Scissors className="text-primary w-6 h-6" />
            </div>
          </header>

          <main className="px-8 pb-8 flex-1 flex flex-col items-center justify-center">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[4/5] dashed-border relative flex flex-col items-center justify-center p-8 group cursor-pointer hover:scale-[1.01] transition-all"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center mb-2 shadow-inner group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors">
                  <Plus className="text-primary w-12 h-12" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black">Upload Images</h2>
                  <p className="text-slate-400 dark:text-slate-500 text-base font-medium">
                    Click here, drag files or just <span className="text-primary font-bold underline">Paste (CTRL+V)</span>
                  </p>
                </div>
                <div className="pt-6 flex items-center justify-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-wide">
                  <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">
                    <span>PDF</span><Check size={12} className="text-primary" />
                  </div>
                  <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">
                    <span>PNG</span><Check size={12} className="text-primary" />
                  </div>
                  <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">
                    <span>JPG</span><Check size={12} className="text-primary" />
                  </div>
                </div>
              </div>
            </div>
          </main>

          <div className="px-8 pb-8">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
            >
              <ImageIcon size={20} /> Select Files
            </button>
          </div>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          multiple 
          accept="image/*" 
          className="hidden" 
          onChange={e => handleAddImages(e.target.files)} 
        />
      </div>
    );
  }

  if (editingIdx === null && images.length > 0) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-background-light dark:bg-background-dark">
        <header className="h-16 flex items-center justify-between px-6 bg-white dark:bg-background-dark border-b dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setImages([])}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-base font-bold leading-tight">{images.length} Selected</h2>
              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Gallery View</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleDownloadSelected}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-black rounded-full text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition-all"
            >
              Export Selected
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 max-w-7xl mx-auto">
            {images.map((img, idx) => (
              <div 
                key={img.id}
                onClick={() => setEditingIdx(idx)}
                className={`relative aspect-square rounded-2xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-[1.02] ${img.selected ? 'border-primary shadow-lg' : 'border-transparent bg-white dark:bg-slate-800'}`}
              >
                <img src={img.croppedUrl || img.url} className="w-full h-full object-cover" />
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(img.id);
                  }}
                  className={`absolute top-2 right-2 p-1 rounded-full shadow-md transition-colors ${img.selected ? 'bg-primary text-white' : 'bg-white/80 text-slate-400 hover:text-primary'}`}
                >
                  {img.selected ? <Check size={16} /> : <div className="w-4 h-4 border-2 border-slate-300 rounded-full" />}
                </button>
              </div>
            ))}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:text-primary hover:border-primary transition-all"
            >
              <Plus size={32} />
              <span className="text-xs font-bold mt-2 uppercase">Add More</span>
            </button>
          </div>
        </main>
        <input 
          type="file" 
          ref={fileInputRef} 
          multiple 
          accept="image/*" 
          className="hidden" 
          onChange={e => handleAddImages(e.target.files)} 
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black text-white">
      <header className="flex items-center justify-between px-4 py-3 shrink-0 bg-black/50 backdrop-blur-md border-b border-white/10 z-20">
        <button 
          onClick={() => setEditingIdx(null)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h2 className="text-base font-semibold leading-tight">{selectedCount} Selected</h2>
          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">Batch Mode Active</span>
        </div>
        <button 
          onClick={handleApplyBatch}
          disabled={isProcessing}
          className="px-5 py-1.5 bg-white text-black rounded-full text-sm font-bold shadow-sm hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : "Save All"}
        </button>
      </header>

      {/* VIEWPORT AREA: Strictly contained within header and footer */}
      <main className="image-viewport">
        <div className="w-full h-full max-w-full max-h-full p-4 md:p-8 flex items-center justify-center overflow-hidden pointer-events-auto">
          {editingIdx !== null && (
            <ReactCrop 
              crop={crop} 
              onChange={c => setCrop(c)} 
              onComplete={c => setCompletedCrop(c)}
              aspect={aspect}
            >
              <img 
                ref={imgRef}
                src={images[editingIdx].url} 
                onLoad={onImageLoad}
                style={{ transform: `rotate(${rotation}deg)` }}
                alt="Editor Main View" 
                className="editor-image select-none pointer-events-none"
              />
              <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full crop-grid opacity-60"></div>
              </div>
            </ReactCrop>
          )}
          {completedCrop && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-mono font-medium text-white/90 z-30">
              {Math.round(completedCrop.width)} × {Math.round(completedCrop.height)}
            </div>
          )}
        </div>
      </main>

      <section className="shrink-0 bg-surface-dark rounded-t-[1.5rem] shadow-2xl flex flex-col overflow-hidden z-20 pb-safe">
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/5">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative inline-flex items-center">
              <input 
                type="checkbox"
                checked={isBatchMode}
                onChange={() => setIsBatchMode(!isBatchMode)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
            </div>
            <span className="text-xs font-semibold text-slate-200 group-hover:text-primary transition-colors">Batch Mode</span>
          </label>
          <div className="flex items-center gap-4">
             <button onClick={selectAll} className="text-primary text-[10px] font-bold hover:text-primary/80 uppercase tracking-widest">Select All</button>
             <div className="w-px h-3 bg-white/10" />
             <div className="flex items-center gap-2">
                <button onClick={() => setEditingIdx(Math.max(0, editingIdx! - 1))} disabled={editingIdx === 0} className="p-1 text-white/30 hover:text-white disabled:opacity-10 transition-colors"><ChevronLeft size={16}/></button>
                <button onClick={() => setEditingIdx(Math.min(images.length - 1, editingIdx! + 1))} disabled={editingIdx === images.length - 1} className="p-1 text-white/30 hover:text-white disabled:opacity-10 transition-colors"><ChevronRight size={16}/></button>
             </div>
          </div>
        </div>

        <div className="w-full border-b border-white/5 py-2 bg-slate-900/30">
          <div className="flex overflow-x-auto no-scrollbar gap-2 px-6 snap-x">
            {images.map((img, idx) => (
              <div 
                key={img.id}
                onClick={() => setEditingIdx(idx)}
                className="shrink-0 snap-center"
              >
                <div className={`w-10 h-14 rounded-md overflow-hidden relative group cursor-pointer border-2 transition-all ${editingIdx === idx ? 'border-primary ring-1 ring-primary/20 scale-105' : 'border-transparent opacity-50'}`}>
                  <img src={img.url} className="w-full h-full object-cover" />
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(img.id);
                    }}
                    className={`absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center transition-all ${img.selected ? 'bg-primary text-white shadow-sm' : 'bg-black/30 backdrop-blur-[2px] border border-white/20'}`}
                  >
                    {img.selected && <Check size={8} strokeWidth={4} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Rotation</p>
                <p className="text-white text-[10px] font-bold font-mono bg-white/5 px-1.5 rounded">{rotation}°</p>
              </div>
              <div className="flex items-center gap-3 h-6">
                <button onClick={() => setRotation(r => r - 1)} className="text-slate-500 hover:text-white transition-colors"><RotateCcw size={14}/></button>
                <div className="relative flex h-1 flex-1 rounded-full bg-slate-800">
                  <input 
                    type="range" min="-180" max="180" value={rotation}
                    onChange={e => setRotation(parseInt(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="absolute left-1/2 top-0 h-full w-px bg-slate-500"></div>
                  <div 
                    className="absolute h-full bg-primary rounded-full transition-all"
                    style={{ 
                      left: rotation >= 0 ? '50%' : `${50 + (rotation / 360) * 100}%`,
                      width: `${Math.abs(rotation / 360) * 100}%`
                    }}
                  ></div>
                </div>
                <button onClick={() => setRotation(r => r + 1)} className="text-slate-500 hover:text-white transition-colors"><RotateCw size={14}/></button>
              </div>
            </div>

            <button 
              onClick={handleApplyBatch}
              className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98]"
            >
              <Check size={16} />
              <span className="text-xs font-bold">Apply to {selectedCount}</span>
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {[
              { label: 'Free', value: undefined, icon: <Maximize size={14} /> },
              { label: '1:1', value: 1, icon: <LayoutGrid size={14} /> },
              { label: '4:5', value: 0.8, icon: <ImageIcon size={14} className="rotate-90" /> },
              { label: '16:9', value: 16/9, icon: <ImageIcon size={14} /> },
              { label: '3:2', value: 3/2, icon: <ImageIcon size={14} /> }
            ].map(a => (
              <button 
                key={a.label}
                onClick={() => {
                  setAspect(a.value);
                  if (imgRef.current) {
                    const { width, height } = imgRef.current;
                    let newCrop;
                    if (a.value === undefined) {
                      newCrop = { unit: '%' as const, x: 0, y: 0, width: 100, height: 100 };
                    } else {
                      newCrop = centerCrop(
                        makeAspectCrop({ unit: '%' as const, width: 90 }, a.value, width, height),
                        width,
                        height
                      );
                    }
                    setCrop(newCrop);
                  }
                }}
                className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-lg px-3 transition-all ${aspect === a.value ? 'bg-primary/20 ring-1 ring-primary text-primary' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
              >
                {a.icon}
                <span className="text-[10px] font-bold">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 px-4 pb-4 pt-2 border-t border-white/5 bg-slate-900/10">
          {[
            { id: 'transform', label: 'Transform', icon: <Scissors size={18} /> },
            { id: 'adjust', label: 'Adjust', icon: <SlidersHorizontal size={18} /> },
            { id: 'resize', label: 'Resize', icon: <Maximize size={18} /> },
            { id: 'enhance', label: 'Enhance', icon: <Sparkles size={18} /> }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl transition-all ${activeTab === tab.id ? 'text-primary' : 'text-slate-500'}`}
            >
              <div className={`p-1.5 rounded-full transition-all ${activeTab === tab.id ? 'bg-primary/10' : ''}`}>
                {tab.icon}
              </div>
              <span className={`text-[9px] uppercase tracking-wider font-bold ${activeTab === tab.id ? '' : 'opacity-60'}`}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </section>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        multiple 
        accept="image/*" 
        className="hidden" 
        onChange={e => handleAddImages(e.target.files)} 
      />
    </div>
  );
};

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
