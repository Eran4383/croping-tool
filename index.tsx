
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Upload, Scissors, Download, X, Check, 
  Plus, ChevronLeft, ChevronRight, Copy, ImageIcon, RefreshCw, Minus, Loader2, Maximize, ZoomIn, ZoomOut, Trash2
} from 'lucide-react';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';

// --- Types ---
interface ImageFile {
  id: string;
  url: string;
  name: string;
  cropped?: string;
  lastCrop?: PixelCrop;
  lastAspect?: number;
}

const VERSION = "v1.5.0";

// --- Components ---

const App = () => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [zoom, setZoom] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const imgRef = useRef<HTMLImageElement>(null);

  // Lock scroll when editor is open
  useEffect(() => {
    if (editingIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [editingIndex]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    // Fix: Explicitly cast Array.from result to File[] to avoid 'unknown' type errors for .type and .name properties
    const files = Array.from(e.target.files) as File[];
    const newImages: ImageFile[] = files
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({
        id: Math.random().toString(36).substr(2, 9),
        url: URL.createObjectURL(f),
        name: f.name
      }));
    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const getInitialCrop = (img: HTMLImageElement, targetAspect?: number) => {
    const { naturalWidth: width, naturalHeight: height } = img;
    const effAspect = targetAspect ?? (width / height);
    return centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, effAspect, width, height),
      width,
      height
    );
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const currentImg = images[editingIndex!];
    
    if (currentImg?.lastCrop) {
      setCrop(currentImg.lastCrop);
      setAspect(currentImg.lastAspect);
    } else {
      setCrop(getInitialCrop(img, aspect));
    }
    setZoom(1);
  };

  const saveCrop = async () => {
    if (!imgRef.current || !crop || editingIndex === null) return;
    setIsProcessing(true);

    try {
      const image = imgRef.current;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const scaleX = image.naturalWidth / 100;
      const scaleY = image.naturalHeight / 100;

      const pixelX = crop.x * scaleX;
      const pixelY = crop.y * scaleY;
      const pixelW = crop.width * scaleX;
      const pixelH = crop.height * scaleY;

      canvas.width = pixelW;
      canvas.height = pixelH;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Ensure the image source is usable
      ctx.drawImage(
        image,
        pixelX, pixelY, pixelW, pixelH,
        0, 0, pixelW, pixelH
      );

      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.95));
      if (!blob) throw new Error("Canvas to Blob failed");
      
      const croppedUrl = URL.createObjectURL(blob);
      
      setImages(prev => prev.map((img, i) => 
        i === editingIndex ? { ...img, cropped: croppedUrl, lastCrop: crop as PixelCrop, lastAspect: aspect } : img
      ));

      if (editingIndex < images.length - 1) {
        setEditingIndex(editingIndex + 1);
      } else {
        setEditingIndex(null);
      }
    } catch (err) {
      console.error(err);
      alert("שגיאה בעיבוד התמונה. נסה שנית.");
    } finally {
      setIsProcessing(false);
    }
  };

  const applyToAll = () => {
    if (!crop) return;
    setImages(prev => prev.map(img => ({
      ...img,
      lastCrop: crop as PixelCrop,
      lastAspect: aspect,
      cropped: undefined // Force re-render/re-process if they want
    })));
    alert("הגדרות החיתוך הוחלו על כל התמונות בגלריה.");
  };

  const downloadAll = async () => {
    for (const img of images) {
      if (!img.cropped) continue;
      const a = document.createElement('a');
      a.href = img.cropped;
      a.download = `cropped-${img.name}`;
      a.click();
      await new Promise(r => setTimeout(r, 400));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900 overflow-x-hidden">
      
      {/* --- Landing Page Header --- */}
      <header className="h-20 bg-white border-b border-slate-200 px-6 md:px-12 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <Scissors size={24} strokeWidth={2.5}/>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none">Bulk Crop Pro</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">גרסה {VERSION}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {images.length > 0 && (
            <button 
              onClick={() => setEditingIndex(0)} 
              className="bg-indigo-600 text-white h-11 px-6 rounded-xl font-black text-sm hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100"
            >
              עריכה קבוצתית
            </button>
          )}
        </div>
      </header>

      {/* --- Gallery View --- */}
      {editingIndex === null ? (
        <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full">
          {images.length === 0 ? (
            <div 
              onClick={() => document.getElementById('file-input')?.click()}
              className="min-h-[60vh] border-4 border-dashed border-slate-200 bg-white rounded-[3rem] flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/10 transition-all group"
            >
              <input id="file-input" type="file" multiple accept="image/*" className="hidden" onChange={handleFiles} />
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-indigo-50 transition-all shadow-inner">
                <Upload size={48} className="text-slate-300 group-hover:text-indigo-600"/>
              </div>
              <h2 className="text-2xl font-black text-slate-800">העלאת תמונות לחיתוך</h2>
              <p className="text-slate-400 font-bold mt-2">לחץ כאן או גרור קבצים לתיבת העלאה</p>
              <div className="mt-8 flex gap-2">
                <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-wider">Fast Processing</span>
                <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider">High Quality</span>
              </div>
            </div>
          ) : (
            <div className="space-y-10 animate-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">התמונות שלך</h2>
                  <p className="text-slate-400 font-bold mt-1 text-xs uppercase tracking-widest">{images.length} קבצים ממתינים</p>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => document.getElementById('file-input')?.click()}
                    className="w-14 h-14 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center hover:bg-slate-200 transition-all active:scale-95 border border-slate-200 shadow-sm"
                  >
                    <Plus size={24}/>
                  </button>
                  <button 
                    onClick={downloadAll} 
                    className="bg-slate-900 text-white h-14 px-10 rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-black transition-all active:scale-95 shadow-xl"
                  >
                    <Download size={20}/> הורד הכל
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {images.map((img, idx) => (
                  <div key={img.id} className="bg-white p-3 rounded-[1.8rem] border border-slate-100 shadow-md group hover:shadow-2xl transition-all relative">
                    <div className="aspect-square relative rounded-[1.4rem] overflow-hidden bg-slate-50">
                      <img src={img.cropped || img.url} className="w-full h-full object-cover" />
                      {img.cropped && (
                        <div className="absolute inset-0 bg-indigo-600/10 flex items-center justify-center backdrop-blur-[1px]">
                          <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">מעובד</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 px-1 flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 truncate w-2/3 uppercase">{img.name}</p>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => setEditingIndex(idx)} 
                          className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-colors"
                        >
                          <ImageIcon size={16}/>
                        </button>
                        <button 
                          onClick={() => removeImage(img.id)} 
                          className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      ) : (
        /* --- PRO Editor View --- */
        <div className="fixed inset-0 z-[1000] bg-[#020617] flex flex-col" dir="rtl">
          
          {/* Editor Header */}
          <header className="h-16 px-6 bg-slate-900/50 border-b border-white/5 flex items-center justify-between shrink-0 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <Scissors size={20} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white font-black text-sm">Editor Mode</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                <span className="text-slate-400 text-xs font-bold">{editingIndex + 1} / {images.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={applyToAll} 
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 text-white rounded-xl text-[10px] font-black uppercase border border-white/10 hover:bg-white/10 transition-all active:scale-95"
              >
                <Copy size={14}/> החל על כולם
              </button>
              <button 
                onClick={() => setEditingIndex(null)} 
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all"
              >
                <X size={28}/>
              </button>
            </div>
          </header>

          <div className="flex-1 flex flex-col md:flex-row-reverse overflow-hidden">
            
            {/* Control Panel (Sidebar on Desktop, Bottom Panel on Mobile) */}
            <aside className="w-full md:w-80 bg-slate-900 border-l border-white/5 flex flex-col z-50 shadow-2xl overflow-y-auto no-scrollbar">
              <div className="p-6 space-y-8 flex-1">
                
                {/* Aspect Ratio Section */}
                <section>
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">יחסי חיתוך (Aspect Ratio)</h3>
                  <div className="grid grid-cols-4 md:grid-cols-2 gap-3">
                    {[
                      { label: '1:1', value: 1, w: 20, h: 20 },
                      { label: '16:9', value: 16/9, w: 28, h: 16 },
                      { label: '9:16', value: 9/16, w: 16, h: 28 },
                      { label: 'Free', value: undefined, w: 22, h: 20 }
                    ].map(a => (
                      <button 
                        key={a.label}
                        onClick={() => setAspect(a.value)}
                        className={`flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all group ${aspect === a.value ? 'bg-indigo-600/10 border-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'bg-white/5 border-transparent text-slate-500 hover:bg-white/10'}`}
                      >
                        <div className={`border-2 rounded-sm transition-colors ${aspect === a.value ? 'border-white' : 'border-current'}`} style={{ width: a.w, height: a.h }}></div>
                        <span className="text-[10px] font-black uppercase tracking-widest">{a.label}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <div className="h-px bg-white/5"></div>

                {/* Navigation Tools */}
                <section>
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">ניווט תמונות</h3>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setEditingIndex(i => Math.max(0, i-1))}
                      disabled={editingIndex === 0}
                      className="flex-1 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400 disabled:opacity-10 hover:bg-white/10 transition-all border border-white/5"
                    >
                      <ChevronRight size={24}/>
                    </button>
                    <button 
                      onClick={() => setEditingIndex(i => Math.min(images.length - 1, i+1))}
                      disabled={editingIndex === images.length - 1}
                      className="flex-1 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400 disabled:opacity-10 hover:bg-white/10 transition-all border border-white/5"
                    >
                      <ChevronLeft size={24}/>
                    </button>
                  </div>
                </section>

                {/* Mobile Extra Actions */}
                <section className="md:hidden">
                  <button onClick={applyToAll} className="w-full h-12 bg-white/5 text-white rounded-xl text-[10px] font-black uppercase border border-white/10 flex items-center justify-center gap-2">
                    <Copy size={16}/> החל הגדרה על כולם
                  </button>
                </section>
              </div>

              {/* Action Footer in Sidebar */}
              <div className="p-6 bg-slate-900/80 border-t border-white/10 space-y-4 backdrop-blur-xl">
                <button 
                  onClick={() => setCrop(getInitialCrop(imgRef.current!, aspect))}
                  className="w-full h-10 flex items-center justify-center gap-2 text-[10px] font-black text-slate-500 uppercase hover:text-white transition-colors"
                >
                  <RefreshCw size={14}/> איפוס מסגרת
                </button>
                <button 
                  onClick={saveCrop} 
                  disabled={isProcessing}
                  className="w-full h-16 bg-indigo-600 text-white rounded-[1.4rem] font-black text-base shadow-2xl shadow-indigo-600/30 flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={24}/> : (editingIndex === images.length - 1 ? 'שמור וסיים' : 'שמור והמשך')}
                  <Check size={24} strokeWidth={3}/>
                </button>
              </div>
            </aside>

            {/* Main Canvas Area */}
            <main className="flex-1 relative flex items-center justify-center p-4 md:p-12 overflow-hidden bg-[#01040a]">
              
              {/* Grid Background */}
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
              
              {/* Image & Crop Logic (Forced LTR for stability) */}
              <div className="relative flex items-center justify-center transition-transform duration-200 ease-out" style={{ transform: `scale(${zoom})`, direction: 'ltr' }}>
                <ReactCrop 
                  crop={crop} 
                  onChange={c => setCrop(c)} 
                  aspect={aspect}
                  keepSelection
                  unit="%"
                >
                  <img 
                    ref={imgRef}
                    src={images[editingIndex].url} 
                    onLoad={onImageLoad}
                    className="max-w-full max-h-[60vh] md:max-h-[75vh] shadow-[0_40px_100px_rgba(0,0,0,0.6)] object-contain rounded-sm"
                    draggable={false}
                  />
                </ReactCrop>
              </div>

              {/* Zoom Controls Overlay */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-xl border border-white/10 px-6 py-2 rounded-full flex items-center gap-6 z-40 shadow-2xl" dir="rtl">
                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="text-slate-400 hover:text-white transition-all p-2"><Minus size={18}/></button>
                <span className="text-white font-black text-[11px] w-12 text-center select-none">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="text-slate-400 hover:text-white transition-all p-2"><Plus size={18}/></button>
                <div className="w-px h-6 bg-white/10"></div>
                <button onClick={() => setZoom(1)} className="text-slate-400 hover:text-white transition-all p-2"><Maximize size={18}/></button>
              </div>

              {/* Processing Loader */}
              {isProcessing && (
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md z-[200] flex flex-col items-center justify-center gap-4">
                  <Loader2 size={48} className="text-indigo-500 animate-spin" strokeWidth={3}/>
                  <span className="text-white font-black uppercase text-[10px] tracking-widest">מעבד קובץ...</span>
                </div>
              )}
            </main>

          </div>
        </div>
      )}

      {/* --- Footer --- */}
      {editingIndex === null && (
        <footer className="py-12 bg-white text-center border-t border-slate-100 mt-auto">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] mb-3">Bulk Crop Engine {VERSION}</p>
          <div className="flex items-center justify-center gap-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-100"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-300"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
          </div>
        </footer>
      )}
    </div>
  );
};

// --- Entry Point ---
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
