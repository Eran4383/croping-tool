import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Upload, Image as ImageIcon, ClipboardPaste, Crop, 
  Download, Trash2, X, Check, Palette,
  Plus, Scissors, Settings2, FileType, ChevronLeft, ChevronRight,
  MousePointer2, Layers, Sparkles, ZoomIn
} from 'lucide-react';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop as CropType, type PixelCrop } from 'react-image-crop';

// --- HELPERS ---
const getCroppedImg = async (image: HTMLImageElement, canvasWrapper: HTMLDivElement, crop: PixelCrop, options: any) => {
  const { expandCanvas, bgType, bgColor, bgImage, format } = options;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;

  if (expandCanvas) {
    // 1. Draw Background
    if (bgType === 'color') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (bgType === 'blur') {
      ctx.filter = 'blur(60px) brightness(0.7)';
      const aspect = image.naturalWidth / image.naturalHeight;
      const canvasAspect = canvas.width / canvas.height;
      let drawW, drawH;
      if (aspect > canvasAspect) { drawH = canvas.height; drawW = drawH * aspect; }
      else { drawW = canvas.width; drawH = drawW / aspect; }
      ctx.drawImage(image, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
      ctx.filter = 'none';
    } else if (bgType === 'image' && bgImage) {
      const bgImg = new Image();
      bgImg.src = bgImage;
      await new Promise(r => bgImg.onload = r);
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    }

    // 2. Draw Image relative to the expansion
    const imgEl = canvasWrapper.querySelector('img.source-img') as HTMLImageElement;
    const wrapperRect = canvasWrapper.getBoundingClientRect();
    const imgRect = imgEl.getBoundingClientRect();

    const imgOffsetX = (imgRect.left - wrapperRect.left) * scaleX;
    const imgOffsetY = (imgRect.top - wrapperRect.top) * scaleY;
    
    ctx.drawImage(
      image,
      0, 0, image.naturalWidth, image.naturalHeight,
      imgOffsetX - (crop.x * scaleX),
      imgOffsetY - (crop.y * scaleY),
      image.naturalWidth,
      image.naturalHeight
    );
  } else {
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    );
  }

  return new Promise<string>((resolve) => {
    canvas.toBlob((blob) => resolve(URL.createObjectURL(blob!)), format, 1);
  });
};

const App = () => {
  const [images, setImages] = useState<any[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [exportFormat, setExportFormat] = useState('image/jpeg');
  const [isDragging, setIsDragging] = useState(false);
  
  // Expansion Settings
  const [expandCanvas, setExpandCanvas] = useState(false);
  const [bgType, setBgType] = useState('blur');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [bgImage, setBgImage] = useState<string | null>(null);

  // Crop Settings
  const [crop, setCrop] = useState<CropType>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>(1);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const newImgs = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        croppedUrl: null,
      }));
    setImages(prev => [...prev, ...newImgs]);
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length) handleFiles(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFiles]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = wrapperRef.current?.getBoundingClientRect() || e.currentTarget;
    const initialCrop = aspect 
      ? centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height), width, height)
      : { unit: '%', x: 5, y: 5, width: 90, height: 90 };
    setCrop(initialCrop);
  };

  const saveCurrentCrop = async () => {
    if (!imgRef.current || !completedCrop || !wrapperRef.current) return;
    const currentIdx = editingIndex!;
    const options = { expandCanvas, bgType, bgColor, bgImage, format: exportFormat };
    const url = await getCroppedImg(imgRef.current, wrapperRef.current, completedCrop, options);
    setImages(prev => prev.map((img, i) => i === currentIdx ? { ...img, croppedUrl: url } : img));
  };

  const handleNext = async () => {
    await saveCurrentCrop();
    if (editingIndex! < images.length - 1) setEditingIndex(editingIndex! + 1);
    else setEditingIndex(null);
  };

  const applyToAll = async () => {
    if (!imgRef.current || !completedCrop || !wrapperRef.current) return;
    const currentCrop = { ...completedCrop };
    const options = { expandCanvas, bgType, bgColor, bgImage, format: exportFormat };
    
    const updatedImages = await Promise.all(images.map(async (img) => {
      const tempImg = new Image();
      tempImg.src = img.previewUrl;
      await new Promise(r => tempImg.onload = r);
      const url = await getCroppedImg(tempImg, wrapperRef.current!, currentCrop, options);
      return { ...img, croppedUrl: url };
    }));
    
    setImages(updatedImages);
    setEditingIndex(null);
  };

  const downloadAll = () => {
    images.forEach((img, idx) => {
      setTimeout(() => {
        const a = document.createElement('a');
        const ext = exportFormat.split('/')[1];
        a.href = img.croppedUrl || img.previewUrl;
        a.download = `crop-${img.name.split('.')[0]}.${ext}`;
        a.click();
      }, idx * 250);
    });
  };

  return (
    <div 
      className={`min-h-screen transition-all ${isDragging ? 'bg-indigo-50/50' : 'bg-slate-50'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
    >
      <nav className="h-20 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 md:px-12 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg">
            <Scissors size={20} />
          </div>
          <span className="text-xl font-extrabold tracking-tight hidden sm:block">BulkCrop Pro</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl">
            <FileType size={16} className="text-slate-400" />
            <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="bg-transparent text-xs font-bold uppercase outline-none cursor-pointer">
              <option value="image/jpeg">JPEG</option>
              <option value="image/png">PNG</option>
              <option value="image/webp">WebP</option>
            </select>
          </div>
          {images.length > 0 && (
            <button onClick={() => setEditingIndex(0)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-xl shadow-indigo-100 flex items-center gap-2 hover:scale-105 transition-all">
              <Crop size={18} /> Batch Process
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200 p-20 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/10 transition-all group"
            onClick={() => { const i = document.createElement('input'); i.type='file'; i.multiple=true; i.accept='image/*'; i.onchange=(e: any)=>handleFiles(e.target.files); i.click(); }}>
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform"><Upload size={40} /></div>
            <h2 className="text-3xl font-black text-slate-900">Start Your Bulk Crop</h2>
            <p className="text-slate-400 mt-4 text-lg">Drag multiple images here, paste from clipboard, or click to browse gallery.</p>
            <div className="mt-12 flex gap-4 opacity-50">
                <div className="px-4 py-2 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><ClipboardPaste size={14}/> Clipboard Paste</div>
                <div className="px-4 py-2 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><MousePointer2 size={14}/> Drag & Drop</div>
            </div>
          </div>
        ) : (
          <div className="space-y-10 animate-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-6">
                <span className="bg-indigo-100 text-indigo-700 px-6 py-2 rounded-full text-sm font-bold tracking-tight">{images.length} Images Loaded</span>
                <button onClick={() => { const i = document.createElement('input'); i.type='file'; i.multiple=true; i.accept='image/*'; i.onchange=(e: any)=>handleFiles(e.target.files); i.click(); }} className="text-indigo-600 font-bold text-sm flex items-center gap-2 hover:underline"><Plus size={20} /> Add More</button>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setImages([])} className="px-6 py-2 text-slate-400 font-bold text-sm hover:text-red-500">Clear All</button>
                <button onClick={downloadAll} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-xl hover:bg-black transition-all flex items-center gap-2"><Download size={18}/> Export All</button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {images.map((img, idx) => (
                <div key={img.id} className="group relative bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all h-full flex flex-col">
                  <div className="aspect-square relative cursor-pointer" onClick={() => setEditingIndex(idx)}>
                    <img src={img.croppedUrl || img.previewUrl} className="w-full h-full object-cover" loading="lazy" />
                    {img.croppedUrl && <div className="absolute top-3 left-3 bg-green-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg"><Check size={12} strokeWidth={4} /> Cropped</div>}
                    <button onClick={(e) => { e.stopPropagation(); setImages(prev => prev.filter(i => i.id !== img.id)); }} className="absolute top-3 right-3 p-2 bg-white/90 text-slate-400 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-md md:opacity-0 group-hover:opacity-100"><X size={16} strokeWidth={3} /></button>
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><div className="bg-white px-6 py-2.5 rounded-2xl text-xs font-black text-slate-900 shadow-2xl">Edit Selection</div></div>
                  </div>
                  <div className="p-4 text-[11px] font-bold text-slate-400 truncate mt-auto">{img.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {editingIndex !== null && (
        <div className="fixed inset-0 z-50 bg-slate-950/98 flex flex-col animate-in overflow-hidden">
          <div className="bg-white w-full h-full flex flex-col shadow-2xl">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg font-black text-xs">{editingIndex + 1} / {images.length}</span>
                <h3 className="text-lg font-bold truncate max-w-[200px] md:max-w-md">{images[editingIndex].name}</h3>
              </div>
              <button onClick={() => setEditingIndex(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-all"><X size={32} /></button>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-900">
              <aside className="w-full lg:w-80 bg-white border-r border-slate-100 p-8 space-y-10 overflow-y-auto no-scrollbar">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 font-black text-xs uppercase tracking-widest text-slate-500"><Layers size={18} className="text-indigo-600" /> Canvas Expansion</label>
                        <input type="checkbox" checked={expandCanvas} onChange={(e) => { setExpandCanvas(e.target.checked); setTimeout(() => onImageLoad({ currentTarget: imgRef.current! } as any), 100); }} className="w-6 h-6 accent-indigo-600 rounded-lg cursor-pointer" />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Allow cropping beyond image borders to add padding or visual effects like blur and custom backgrounds.</p>
                </div>

                {expandCanvas && (
                    <div className="space-y-8 animate-in">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Background Mode</label>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { id: 'color', label: 'Solid Color', icon: Palette },
                                    { id: 'blur', label: 'Image Blur', icon: Sparkles },
                                    { id: 'image', label: 'Custom BG', icon: ImageIcon }
                                ].map(type => (
                                    <button key={type.id} onClick={() => setBgType(type.id)} className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left text-xs font-bold transition-all ${bgType === type.id ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm' : 'border-slate-100 bg-white text-slate-400'}`}>
                                        <type.icon size={18} /> {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {bgType === 'color' && (
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pick Fill Color</label>
                                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-full h-14 p-1 bg-white border-2 border-slate-100 rounded-2xl cursor-pointer" />
                            </div>
                        )}

                        {bgType === 'image' && (
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Upload Background</label>
                                <div onClick={() => { const i = document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange=(e: any)=>setBgImage(URL.createObjectURL(e.target.files[0])); i.click(); }}
                                    className="w-full aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors relative overflow-hidden">
                                    {bgImage ? <img src={bgImage} className="w-full h-full object-cover" /> : <Plus size={24} className="text-slate-300" />}
                                </div>
                            </div>
                        )}
                    </div>
                )}
              </aside>

              <section className="flex-1 relative flex items-center justify-center overflow-hidden p-6 md:p-12">
                <div className="max-w-full max-h-full flex items-center justify-center">
                  <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)} aspect={aspect}>
                    <div ref={wrapperRef} className={`canvas-wrapper transition-all duration-300 ${expandCanvas ? 'p-32 md:p-52' : ''}`} style={{ background: bgType === 'color' && expandCanvas ? bgColor : '#000' }}>
                        {expandCanvas && bgType === 'blur' && <img src={images[editingIndex].previewUrl} className="bg-blur-preview" />}
                        {expandCanvas && bgType === 'image' && bgImage && <img src={bgImage} className="absolute inset-0 w-full h-full object-cover" />}
                        <img ref={imgRef} src={images[editingIndex].previewUrl} onLoad={onImageLoad} className="source-img max-h-[55vh] md:max-h-[60vh] lg:max-h-[65vh] object-contain relative z-10 shadow-2xl" />
                    </div>
                  </ReactCrop>
                </div>
              </section>
            </div>

            <footer className="p-6 md:p-10 bg-white border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl">
                    {[ { l: '1:1', v: 1 }, { l: '16:9', v: 16/9 }, { l: '9:16', v: 9/16 }, { l: 'Free', v: undefined } ].map(v => (
                        <button key={v.l} onClick={() => { setAspect(v.v); onImageLoad({ currentTarget: imgRef.current! } as any); }} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${aspect === v.v ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                        {v.l}
                        </button>
                    ))}
                    </div>
                    <div className="flex items-center gap-4 bg-slate-50 px-6 py-2.5 rounded-2xl border border-slate-100">
                        <ZoomIn size={18} className="text-indigo-600" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{Math.round(completedCrop?.width || 0)}% Wide</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button onClick={() => editingIndex > 0 && setEditingIndex(editingIndex - 1)} className={`flex-1 md:flex-none px-6 py-4 bg-slate-50 text-slate-500 rounded-2xl font-bold flex items-center justify-center gap-2 ${editingIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-100'}`}><ChevronLeft size={20} /> Prev</button>
                    <button onClick={applyToAll} className="flex-1 md:flex-none px-8 py-4 bg-indigo-50 text-indigo-700 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-100"><Settings2 size={20} /> Sync All</button>
                    <button onClick={handleNext} className="flex-1 md:flex-none px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl shadow-indigo-200 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all">{editingIndex === images.length - 1 ? 'Finish' : 'Next'} <ChevronRight size={20} /></button>
                </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);