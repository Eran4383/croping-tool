import React, { useState, useCallback, useEffect, useRef } from 'https://esm.sh/react@19';
import { createRoot } from 'https://esm.sh/react-dom@19/client';
import { 
  Upload, Scissors, X, Check, Layers, Sparkles, Palette, 
  Image as ImageIcon, Plus, ChevronLeft, ChevronRight, 
  Download, Settings2
} from 'https://esm.sh/lucide-react@0.460.0';
import ReactCrop, { centerCrop, makeAspectCrop } from 'https://esm.sh/react-image-crop@11.0.7';

// Helper to generate the final image
const getCroppedImg = async (image: HTMLImageElement, workspaceEl: HTMLElement, crop: any, options: any) => {
  const { expand, bgType, bgColor, bgImage, format } = options;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;

  if (expand) {
    if (bgType === 'color') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (bgType === 'blur') {
      ctx.filter = 'blur(60px) brightness(0.7)';
      ctx.drawImage(image, -canvas.width * 0.2, -canvas.height * 0.2, canvas.width * 1.4, canvas.height * 1.4);
      ctx.filter = 'none';
    } else if (bgType === 'image' && bgImage) {
      const bImg = new Image();
      bImg.src = bgImage;
      await new Promise(r => bImg.onload = r);
      ctx.drawImage(bImg, 0, 0, canvas.width, canvas.height);
    }

    const imgEl = workspaceEl.querySelector('.source-img') as HTMLImageElement;
    const workspaceRect = workspaceEl.getBoundingClientRect();
    const imgRect = imgEl.getBoundingClientRect();

    const offX = (imgRect.left - workspaceRect.left) * scaleX;
    const offY = (imgRect.top - workspaceRect.top) * scaleY;

    ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, offX - (crop.x * scaleX), offY - (crop.y * scaleY), image.naturalWidth, image.naturalHeight);
  } else {
    ctx.drawImage(image, crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY, 0, 0, crop.width * scaleX, crop.height * scaleY);
  }

  return new Promise<string>(res => canvas.toBlob(b => res(URL.createObjectURL(b!)), format, 1));
};

const App = () => {
  const [images, setImages] = useState<any[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [format, setFormat] = useState('image/jpeg');
  const [expand, setExpand] = useState(false);
  const [bgType, setBgType] = useState('blur');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<any>();
  const [pixelCrop, setPixelCrop] = useState<any>();
  const [aspect, setAspect] = useState<number | undefined>(1);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const onUpload = (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/')).map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      url: URL.createObjectURL(f),
      name: f.name,
      cropped: null
    }));
    setImages(prev => [...prev, ...arr]);
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = workspaceRef.current?.getBoundingClientRect() || e.currentTarget;
    setCrop(aspect ? centerCrop(makeAspectCrop({ unit: '%', width: 80 }, aspect, width, height), width, height) : { unit: '%', x: 10, y: 10, width: 80, height: 80 });
  };

  const finishCrop = async () => {
    if (!pixelCrop || editingIndex === null || !imgRef.current || !workspaceRef.current) return;
    const url = await getCroppedImg(imgRef.current, workspaceRef.current, pixelCrop, { expand, bgType, bgColor, bgImage, format });
    setImages(prev => prev.map((img, i) => i === editingIndex ? { ...img, cropped: url } : img));
  };

  const next = async () => {
    await finishCrop();
    if (editingIndex !== null && editingIndex < images.length - 1) {
      setEditingIndex(editingIndex + 1);
    } else {
      setEditingIndex(null);
    }
  };

  const downloadAll = () => {
    images.forEach((img, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = img.cropped || img.url;
        a.download = `crop-${img.name}`;
        a.click();
      }, i * 300);
    });
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white"><Scissors size={20}/></div>
          <h1 className="text-xl font-extrabold tracking-tight">BulkCrop Pro</h1>
        </div>
        {images.length > 0 && (
          <div className="flex items-center gap-4">
            <button onClick={() => setEditingIndex(0)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 hover:bg-indigo-700 transition-all"><Settings2 size={18}/> ערוך הכל</button>
            <button onClick={downloadAll} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-all"><Download size={18}/> הורד הכל</button>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto p-8">
        {images.length === 0 ? (
          <div 
            onClick={() => { const i = document.createElement('input'); i.type='file'; i.multiple=true; i.onchange=(e: any)=>onUpload(e.target.files); i.click(); }} 
            className="border-4 border-dashed rounded-[3rem] p-32 text-center bg-white cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/10 transition-all group animate-in"
          >
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform"><Upload size={40}/></div>
            <h2 className="text-3xl font-black mb-2">גרור תמונות לכאן</h2>
            <p className="text-slate-400 text-lg">או לחץ לבחירה מהמחשב (ניתן להעלות כמות גדולה)</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-in">
            {images.map((img, idx) => (
              <div key={img.id} className="bg-white rounded-3xl overflow-hidden border shadow-sm group hover:shadow-md transition-all">
                <div className="aspect-square relative cursor-pointer" onClick={() => setEditingIndex(idx)}>
                  <img src={img.cropped || img.url} className="w-full h-full object-cover" />
                  {img.cropped && <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg"><Check size={12}/> בוצע</div>}
                  <button onClick={e => { e.stopPropagation(); setImages(p => p.filter(i => i.id !== img.id)); }} className="absolute top-3 left-3 p-2 bg-white/90 text-slate-400 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all shadow-sm"><X size={16}/></button>
                </div>
                <div className="p-3 text-xs font-bold text-slate-500 truncate text-center">{img.name}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      {editingIndex !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col animate-in">
          <div className="bg-white h-full flex flex-col shadow-2xl overflow-hidden">
            <header className="p-6 border-b flex justify-between items-center bg-white z-10">
              <div className="flex items-center gap-4">
                <span className="bg-indigo-100 text-indigo-700 px-4 py-1 rounded-lg font-black text-xs">{editingIndex+1} / {images.length}</span>
                <h3 className="font-bold text-lg truncate max-w-xs">{images[editingIndex].name}</h3>
              </div>
              <button onClick={() => setEditingIndex(null)} className="p-2 hover:bg-slate-100 rounded-full transition-all"><X size={32} className="text-slate-400"/></button>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-100">
              <aside className="w-full lg:w-80 bg-white border-l p-8 space-y-8 overflow-y-auto no-scrollbar shadow-inner">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase text-slate-500 flex items-center gap-2"><Layers size={18} className="text-indigo-600"/> הרחבת קנבס</label>
                    <input type="checkbox" checked={expand} onChange={e => { setExpand(e.target.checked); setTimeout(() => onImageLoad({ currentTarget: imgRef.current! } as any), 50); }} className="w-6 h-6 accent-indigo-600 rounded cursor-pointer" />
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">מאפשר לחתוך גם מחוץ לגבולות התמונה המקורית</p>
                </div>

                {expand && (
                  <div className="space-y-6 animate-in border-t pt-6">
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: 'blur', label: 'טשטוש רקע', icon: Sparkles },
                        { id: 'color', label: 'צבע אחיד', icon: Palette },
                        { id: 'image', label: 'תמונת רקע', icon: ImageIcon }
                      ].map(t => (
                        <button key={t.id} onClick={() => setBgType(t.id)} className={`p-4 rounded-2xl border-2 text-right text-xs font-bold transition-all flex items-center gap-3 ${bgType === t.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                          <t.icon size={16}/> {t.label}
                        </button>
                      ))}
                    </div>
                    {bgType === 'color' && <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-full h-12 p-1 rounded-xl cursor-pointer border border-slate-200" />}
                    {bgType === 'image' && (
                      <div onClick={() => { const i = document.createElement('input'); i.type='file'; i.onchange=(e: any)=>setBgImage(URL.createObjectURL(e.target.files[0])); i.click(); }} className="aspect-video bg-slate-50 border-2 border-dashed rounded-2xl flex items-center justify-center cursor-pointer hover:border-indigo-400 transition-all overflow-hidden relative">
                        {bgImage ? <img src={bgImage} className="w-full h-full object-cover" /> : <Plus className="text-slate-300"/>}
                      </div>
                    )}
                  </div>
                )}
              </aside>

              <section className="flex-1 relative flex items-center justify-center p-8 md:p-16 overflow-hidden bg-slate-900">
                <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setPixelCrop(c)} aspect={aspect}>
                  <div ref={workspaceRef} className={`canvas-workspace ${expand ? 'p-32 md:p-56' : ''}`} style={{ background: expand && bgType === 'color' ? bgColor : '#000' }}>
                    {expand && bgType === 'blur' && <img src={images[editingIndex].url} className="blur-bg" />}
                    {expand && bgType === 'image' && bgImage && <img src={bgImage} className="absolute inset-0 w-full h-full object-cover" />}
                    <img ref={imgRef} src={images[editingIndex].url} onLoad={onImageLoad} className="source-img max-h-[60vh] object-contain relative z-10 shadow-2xl rounded-sm" />
                  </div>
                </ReactCrop>
              </section>
            </div>

            <footer className="p-8 bg-white border-t flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl">
                {[
                  {l: '1:1', v: 1}, {l: '16:9', v: 16/9}, {l: '9:16', v: 9/16}, {l: 'חופשי', v: undefined}
                ].map(v => (
                  <button key={v.l} onClick={() => { setAspect(v.v); onImageLoad({ currentTarget: imgRef.current! } as any); }} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${aspect === v.v ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{v.l}</button>
                ))}
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <button onClick={() => editingIndex > 0 && setEditingIndex(editingIndex - 1)} className={`px-8 py-4 rounded-2xl font-bold flex items-center gap-2 transition-all ${editingIndex === 0 ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><ChevronRight size={18}/> קודם</button>
                <button onClick={next} className="flex-1 md:flex-none px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl shadow-indigo-200 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all">{editingIndex === images.length - 1 ? 'סיים חיתוך' : 'הבא'} <ChevronLeft size={18}/></button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<App />);