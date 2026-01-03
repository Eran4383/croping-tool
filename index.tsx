
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Scissors, Download, X, Check, Plus, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, Trash2, Move, MousePointer2, Maximize, RotateCw, RotateCcw, FileType, Settings, RefreshCw, Undo as UndoIcon, Redo as RedoIcon } from 'lucide-react';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import { jsPDF } from 'jspdf';

const VERSION = "v4.9.0";
const PADDING = 2000;

interface ImageItem {
  id: string;
  url: string;
  name: string;
  cropped: string | null;
  cropConfig: {
    crop: Crop;
    aspect: number | undefined;
    rotation: number;
  } | null;
}

interface EditorState {
  crop: Crop | undefined;
  aspect: number | undefined;
  rotation: number;
}

const App = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [crop, setCrop] = useState<Crop>(); 
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [rotation, setRotation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isPanMode, setIsPanMode] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [globalFormat, setGlobalFormat] = useState('image/jpeg');
  
  const [history, setHistory] = useState<EditorState[]>([]);
  const [historyPointer, setHistoryPointer] = useState(-1);
  const isInternalHistoryUpdate = useRef(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const zoomState = useRef({
    lastZoom: 1, anchorX: 0, anchorY: 0, viewX: 0, viewY: 0,
    touchStartDist: 0, touchStartZoom: 1, isPinching: false, isDragging: false,
    dragStartX: 0, dragStartY: 0, dragStartScrollL: 0, dragStartScrollT: 0
  });

  const applyZoomScroll = useCallback((currentZoom: number, anchorX: number, anchorY: number, viewX: number, viewY: number) => {
    if (!viewportRef.current) return;
    const viewport = viewportRef.current;
    viewport.scrollLeft = PADDING + (anchorX * currentZoom) - viewX;
    viewport.scrollTop = PADDING + (anchorY * currentZoom) - viewY;
  }, []);

  const updateZoomAnchor = useCallback(() => {
    if (!viewportRef.current || !imgRef.current) return;
    const viewport = viewportRef.current;
    const viewPosX = viewport.clientWidth / 2;
    const viewPosY = viewport.clientHeight / 2;
    zoomState.current.viewX = viewPosX;
    zoomState.current.viewY = viewPosY;
    zoomState.current.anchorX = (viewport.scrollLeft + viewPosX - PADDING) / zoom;
    zoomState.current.anchorY = (viewport.scrollTop + viewPosY - PADDING) / zoom;
  }, [zoom]);

  const handleAddImages = useCallback((files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const newImgs = Array.from(files).filter(f => f.type.startsWith('image/')).map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      url: URL.createObjectURL(f),
      name: f.name || `Image ${new Date().toLocaleTimeString()}`,
      cropped: null,
      cropConfig: null
    }));
    setImages(prev => [...prev, ...newImgs]);
    if (fileInputRef.current) fileInputRef.current.value = ''; 
  }, []);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items; if (!items) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile(); if (file) files.push(file);
        }
      }
      if (files.length > 0) handleAddImages(files);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleAddImages]);

  const fitToViewport = useCallback(() => {
    if (!viewportRef.current || !imgRef.current) return;
    const viewport = viewportRef.current;
    const img = imgRef.current; if (!img.naturalWidth || !img.naturalHeight) return;

    const vw = viewport.clientWidth - 40;
    const vh = viewport.clientHeight - 40;
    const ratio = Math.min(vw / img.naturalWidth, vh / img.naturalHeight);
    setZoom(ratio); zoomState.current.lastZoom = ratio;
    requestAnimationFrame(() => {
      if (viewportRef.current) {
        viewportRef.current.scrollLeft = (img.naturalWidth * ratio / 2 + PADDING) - (viewportRef.current.clientWidth / 2);
        viewportRef.current.scrollTop = (img.naturalHeight * ratio / 2 + PADDING) - (viewportRef.current.clientHeight / 2);
      }
    });
  }, []);

  const currentOriginalAspect = (imgRef.current && imgRef.current.naturalWidth > 0) 
    ? imgRef.current.naturalWidth / imgRef.current.naturalHeight 
    : undefined;

  const pushToHistory = useCallback((state: EditorState) => {
    if (isInternalHistoryUpdate.current) return;
    setHistory(prev => {
      const newHistory = prev.slice(0, historyPointer + 1);
      const last = newHistory[newHistory.length - 1];
      if (last && JSON.stringify(last.crop) === JSON.stringify(state.crop) && last.aspect === state.aspect && last.rotation === state.rotation) return prev;
      newHistory.push(state);
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryPointer(prev => Math.min(prev + 1, 49));
  }, [historyPointer]);

  const undo = () => {
    if (historyPointer > 0) {
      isInternalHistoryUpdate.current = true;
      const prevState = history[historyPointer - 1];
      setCrop(prevState.crop); setAspect(prevState.aspect); setRotation(prevState.rotation);
      setHistoryPointer(historyPointer - 1);
      setTimeout(() => { isInternalHistoryUpdate.current = false; }, 0);
    }
  };

  const redo = () => {
    if (historyPointer < history.length - 1) {
      isInternalHistoryUpdate.current = true;
      const nextState = history[historyPointer + 1];
      setCrop(nextState.crop); setAspect(nextState.aspect); setRotation(nextState.rotation);
      setHistoryPointer(historyPointer + 1);
      setTimeout(() => { isInternalHistoryUpdate.current = false; }, 0);
    }
  };

  const onAspectChange = (newAspect: number | undefined) => {
    setAspect(newAspect);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      let newCrop: Crop;
      if (newAspect === undefined || (currentOriginalAspect && Math.abs(newAspect! - currentOriginalAspect) < 0.001)) {
        newCrop = { unit: '%' as const, x: 0, y: 0, width: 100, height: 100 };
      } else {
        newCrop = centerCrop(makeAspectCrop({ unit: '%' as const, width: 100 }, newAspect, width, height), width, height);
      }
      setCrop(newCrop); pushToHistory({ crop: newCrop, aspect: newAspect, rotation });
    }
  };

  const handleRotateCw = () => {
    const nextRot = (Math.round(rotation / 90) * 90 + 90) % 360;
    setRotation(nextRot); pushToHistory({ crop, aspect, rotation: nextRot });
  };

  const handleRotateCcw = () => {
    const nextRot = (Math.round(rotation / 90) * 90 - 90 + 360) % 360;
    setRotation(nextRot); pushToHistory({ crop, aspect, rotation: nextRot });
  };

  const resetRotation = () => {
    setRotation(0); pushToHistory({ crop, aspect, rotation: 0 });
  };

  const navigateTo = useCallback((newIdx: number | null) => {
    if (editingIdx !== null && crop) {
      setImages(prev => prev.map((img, i) => i === editingIdx ? { ...img, cropConfig: { crop: { ...crop }, aspect, rotation } } : img));
    }
    setEditingIdx(newIdx);
  }, [editingIdx, crop, aspect, rotation]);

  useEffect(() => {
    if (editingIdx === null) return;
    const observer = new ResizeObserver(() => { if (!zoomState.current.isPinching) fitToViewport(); });
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [editingIdx, fitToViewport]);

  useLayoutEffect(() => {
    if (!viewportRef.current || !imgRef.current) return;
    const { lastZoom, anchorX, anchorY, viewX, viewY } = zoomState.current;
    if (Math.abs(zoom - lastZoom) > 0.0001) applyZoomScroll(zoom, anchorX, anchorY, viewX, viewY);
    zoomState.current.lastZoom = zoom;
  }, [zoom, applyZoomScroll]);

  useEffect(() => {
    if (editingIdx !== null && images[editingIdx]) {
      document.body.classList.add('editor-open');
      setIsPanMode(false);
      const currentImg = images[editingIdx];
      let ic: Crop = { unit: '%' as const, x: 0, y: 0, width: 100, height: 100 };
      let ia: number | undefined = undefined; let ir = 0;
      if (currentImg && currentImg.cropConfig) {
        ic = currentImg.cropConfig.crop; ia = currentImg.cropConfig.aspect; ir = currentImg.cropConfig.rotation || 0;
      }
      setCrop(ic); setAspect(ia); setRotation(ir);
      setHistory([{ crop: ic, aspect: ia, rotation: ir }]); setHistoryPointer(0);
      setTimeout(fitToViewport, 100);
    } else if (editingIdx === null) {
      document.body.classList.remove('editor-open');
    }
  }, [editingIdx, images, fitToViewport]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => { imgRef.current = e.currentTarget; fitToViewport(); };
  const onCropComplete = (pixelCrop: PixelCrop) => { setCompletedCrop(pixelCrop); pushToHistory({ crop, aspect, rotation }); };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsPinching(true); zoomState.current.isPinching = true;
      const t1 = e.touches[0]; const t2 = e.touches[1];
      const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
      const rect = viewportRef.current!.getBoundingClientRect();
      const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
      zoomState.current.touchStartDist = dist; zoomState.current.touchStartZoom = zoom;
      zoomState.current.viewX = midX; zoomState.current.viewY = midY;
      zoomState.current.anchorX = (viewportRef.current!.scrollLeft + midX - PADDING) / zoom;
      zoomState.current.anchorY = (viewportRef.current!.scrollTop + midY - PADDING) / zoom;
    } else if (e.touches.length === 1 && isPanMode) {
      zoomState.current.isDragging = true;
      zoomState.current.dragStartX = e.touches[0].clientX; zoomState.current.dragStartY = e.touches[0].clientY;
      zoomState.current.dragStartScrollL = viewportRef.current!.scrollLeft;
      zoomState.current.dragStartScrollT = viewportRef.current!.scrollTop;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && zoomState.current.isPinching) {
      e.preventDefault();
      const t1 = e.touches[0]; const t2 = e.touches[1];
      const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
      const rect = viewportRef.current!.getBoundingClientRect();
      const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
      const ratio = dist / zoomState.current.touchStartDist;
      const newZoom = Math.min(20, Math.max(0.001, zoomState.current.touchStartZoom * ratio));
      setZoom(newZoom); applyZoomScroll(newZoom, zoomState.current.anchorX, zoomState.current.anchorY, midX, midY);
      zoomState.current.viewX = midX; zoomState.current.viewY = midY;
    } else if (e.touches.length === 1 && zoomState.current.isDragging && isPanMode) {
      e.preventDefault();
      const dx = e.touches[0].clientX - zoomState.current.dragStartX;
      const dy = e.touches[0].clientY - zoomState.current.dragStartY;
      viewportRef.current!.scrollLeft = zoomState.current.dragStartScrollL - dx;
      viewportRef.current!.scrollTop = zoomState.current.dragStartScrollT - dy;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPanMode) {
      zoomState.current.isDragging = true;
      zoomState.current.dragStartX = e.clientX; zoomState.current.dragStartY = e.clientY;
      zoomState.current.dragStartScrollL = viewportRef.current!.scrollLeft;
      zoomState.current.dragStartScrollT = viewportRef.current!.scrollTop;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (zoomState.current.isDragging && isPanMode) {
      e.preventDefault();
      const dx = e.clientX - zoomState.current.dragStartX;
      const dy = e.clientY - zoomState.current.dragStartY;
      viewportRef.current!.scrollLeft = zoomState.current.dragStartScrollL - dx;
      viewportRef.current!.scrollTop = zoomState.current.dragStartScrollT - dy;
    }
  };

  const handleMouseUp = () => { zoomState.current.isDragging = false; };

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current || editingIdx === null) return;
    setIsProcessing(true);
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width; const scaleY = image.naturalHeight / image.height;
    canvas.width = Math.ceil(completedCrop.width * scaleX); canvas.height = Math.ceil(completedCrop.height * scaleY);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate((rotation * Math.PI) / 180);
    const imgCX = completedCrop.x * scaleX + (completedCrop.width * scaleX) / 2;
    const imgCY = completedCrop.y * scaleY + (completedCrop.height * scaleY) / 2;
    ctx.drawImage(image, -imgCX, -imgCY); ctx.restore();

    const previewBlob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.95));
    if (!previewBlob) return;
    const previewUrl = URL.createObjectURL(previewBlob);

    setImages(prev => prev.map((img, i) => i === editingIdx ? { 
      ...img, cropped: previewUrl, cropConfig: { crop: { ...crop! }, aspect, rotation }
    } : img));
    setIsProcessing(false); setEditingIdx(null);
  };

  const downloadFile = async (img: ImageItem) => {
    if (!img.cropped) return;
    const format = globalFormat; const baseName = img.name.split('.')[0];
    if (format === 'application/pdf') {
      const resp = await fetch(img.cropped); const blob = await resp.blob();
      const reader = new FileReader();
      const dataUrl = await new Promise<string>(resolve => {
        reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(blob);
      });
      const tempImg = new Image(); tempImg.src = dataUrl;
      await new Promise(r => tempImg.onload = r);
      const pdf = new jsPDF({ orientation: tempImg.width > tempImg.height ? 'l' : 'p', unit: 'px', format: [tempImg.width, tempImg.height] });
      pdf.addImage(dataUrl, 'JPEG', 0, 0, tempImg.width, tempImg.height); pdf.save(`CROP_${baseName}.pdf`);
    } else {
      const link = document.createElement('a'); link.href = img.cropped; 
      link.download = `CROP_${baseName}.${format === 'image/png' ? 'png' : 'jpg'}`; link.click();
    }
  };

  const renderAspectIcon = (v: number | undefined) => {
    if (v === undefined) return <div className="w-4 h-4 border-2 border-dashed border-current opacity-50" />;
    if (v === 1) return <div className="w-3 h-3 border-2 border-current rounded-sm" />;
    if (v > 1) return <div className="w-4 h-2.5 border-2 border-current rounded-sm" />;
    return <div className="w-2.5 h-4 border-2 border-current rounded-sm" />;
  };

  return (
    <div className="h-[100dvh] flex flex-col ltr-force overflow-hidden relative">
      <header className="h-14 sm:h-16 bg-white border-b px-6 flex items-center justify-between sticky top-0 z-40 shrink-0" style={{ direction: 'rtl' }}>
        <div className="flex items-center gap-3">
          <Scissors className="text-indigo-600" size={24}/>
          <h1 className="font-extrabold text-lg flex items-center gap-2">Bulk Crop Pro <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md border border-slate-200">{VERSION}</span></h1>
        </div>
        {images.length > 0 && (
          <div className="flex items-center gap-2">
            <button title="מחיקת הכל" onClick={() => {if(confirm('למחוק הכל?')) setImages([]);}} className="text-slate-400 hover:text-red-500 p-2"><Trash2 size={20}/></button>
            <button onClick={() => {for(const img of images) { if(img.cropped) downloadFile(img); }}} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all"><Download size={16}/> הורד הכל</button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-10" style={{ direction: 'rtl' }}>
        <div className="max-w-6xl mx-auto w-full">
          {images.length === 0 ? (
            <div onClick={() => fileInputRef.current?.click()} className="min-h-[60dvh] bg-white border-4 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer hover:border-indigo-300 transition-all group">
              <Plus size={54} className="text-indigo-600 mb-6 group-hover:scale-110 transition-transform"/>
              <h2 className="text-2xl font-black text-slate-800">העלאת תמונות לחיתוך</h2>
              <p className="text-slate-400 mt-3 text-center px-8 text-lg">לחצו כאן או פשוט <b>הדביקו (CTRL+V)</b></p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-32">
              {images.map((img, idx) => (
                <div key={img.id} onClick={() => setEditingIdx(idx)} className={`img-grid-item group ${img.cropped ? 'done' : ''}`}>
                  <img src={img.cropped || img.url} className="w-full h-full object-cover" />
                  {img.cropped && (
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow-lg flex items-center gap-1 px-1.5">
                      <Check size={10}/><span className="text-[9px] font-bold uppercase">{globalFormat.split('/')[1]}</span>
                    </div>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setImages(images.filter(i => i.id !== img.id)); }} className="absolute top-2 left-2 bg-black/40 hover:bg-red-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12}/></button>
                </div>
              ))}
              <div onClick={() => fileInputRef.current?.click()} className="img-grid-item border-4 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 hover:text-indigo-500 hover:border-indigo-200 transition-all bg-slate-50/50">
                <Plus size={40}/><span className="text-xs mt-2 font-bold uppercase">הוסף עוד</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {images.length > 0 && editingIdx === null && (
        <div className="format-selector-floating bg-white border border-slate-200 p-2 rounded-2xl flex items-center gap-2 shadow-xl" style={{ direction: 'rtl' }}>
           <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Settings size={18} /></div>
           <div className="flex flex-col pr-1 pl-4">
              <span className="text-[10px] text-slate-400 font-bold leading-tight">פורמט שמירה גלובלי</span>
              <select value={globalFormat} onChange={(e) => setGlobalFormat(e.target.value)} className="bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer pr-0 pl-8 h-6">
                <option value="image/jpeg">JPEG</option>
                <option value="image/png">PNG</option>
                <option value="application/pdf">PDF</option>
              </select>
           </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} multiple accept="image/*" className="hidden" onChange={e => handleAddImages(e.target.files)} />

      {editingIdx !== null && images[editingIdx] && (
        <div className={`editor-overlay ltr-force ${isPinching ? 'is-pinching' : ''}`}>
          <div className="flex items-center justify-between px-4 sm:px-6 h-12 sm:h-14 bg-black/80 shrink-0 backdrop-blur-xl border-b border-white/10">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <div className="bg-white/15 px-2.5 py-1 rounded-lg border border-white/10 shrink-0">
                <span className="text-white font-bold text-xs">{editingIdx + 1} <span className="mx-1 opacity-30">/</span> {images.length}</span>
              </div>
              <div className="flex items-center bg-white/10 p-0.5 rounded-xl border border-white/5">
                <button onClick={() => setIsPanMode(false)} className={`p-1.5 sm:p-2 rounded-lg ${!isPanMode ? 'bg-indigo-500 text-white' : 'text-white/40'}`}><MousePointer2 size={16}/></button>
                <button onClick={() => setIsPanMode(true)} className={`p-1.5 sm:p-2 rounded-lg ${isPanMode ? 'bg-indigo-500 text-white' : 'text-white/40'}`}><Move size={16}/></button>
              </div>
              <div className="flex items-center gap-0.5 bg-white/10 p-0.5 rounded-xl border border-white/5">
                <button disabled={historyPointer <= 0} onClick={undo} className={`p-1.5 sm:p-2 rounded-lg ${historyPointer > 0 ? 'text-white' : 'text-white/15'}`}><UndoIcon size={16}/></button>
                <button disabled={historyPointer >= history.length - 1} onClick={redo} className={`p-1.5 sm:p-2 rounded-lg ${historyPointer < history.length - 1 ? 'text-white' : 'text-white/15'}`}><RedoIcon size={16}/></button>
              </div>
            </div>
            <button onClick={() => navigateTo(null)} className="text-white/40 p-2 hover:text-white rounded-full transition-all shrink-0"><X size={24}/></button>
          </div>

          <div className={`image-viewport ${isPanMode ? 'pan-mode' : ''}`} ref={viewportRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={() => { zoomState.current.isPinching = false; zoomState.current.isDragging = false; setIsPinching(false); }}>
            <div className="image-container" ref={containerRef}>
              <ReactCrop crop={crop} onChange={setCrop} onComplete={onCropComplete} aspect={aspect} disabled={isPanMode || isPinching}>
                <img ref={imgRef} src={images[editingIdx].url} onLoad={onImageLoad} draggable={false} className="crop-target-img shadow-2xl"
                  style={{ width: imgRef.current?.naturalWidth ? `${imgRef.current.naturalWidth * zoom}px` : 'auto', height: imgRef.current?.naturalHeight ? `${imgRef.current.naturalHeight * zoom}px` : 'auto', transform: `rotate(${rotation}deg)` }} />
              </ReactCrop>
            </div>
          </div>

          <div className="editor-footer" style={{ direction: 'rtl' }}>
            <div className="flex flex-col gap-2.5 max-w-6xl mx-auto w-full">
              <div className="aspect-row-scroll">
                 {[{l:'חופשי',v:undefined},{l:'מקורי',v:currentOriginalAspect},{l:'1:1',v:1},{l:'16:9',v:16/9},{l:'9:16',v:9/16},{l:'4:5',v:0.8}].map((a, i)=>(
                    <button key={i} onClick={()=>onAspectChange(a.v)} className={`aspect-chip flex items-center justify-center gap-2 px-3 py-1.5 ${aspect===a.v?'active':''}`}>
                      {renderAspectIcon(a.v)}
                      <span className="text-[11px] font-bold">{a.l}</span>
                    </button>
                  ))}
              </div>
              <div className="flex items-center gap-3 bg-white/5 p-1.5 rounded-xl border border-white/5">
                <button onClick={resetRotation} className="p-1.5 text-white/50 hover:text-white bg-white/5 rounded-lg border border-white/10" title="אפס סיבוב"><RefreshCw size={14} /></button>
                <span className="text-[10px] font-bold text-white/50 whitespace-nowrap">סיבוב:</span>
                <input type="range" min="-180" max="180" value={rotation > 180 ? rotation - 360 : rotation} onChange={(e) => { const r = parseInt(e.target.value); setRotation(r); pushToHistory({ crop, aspect, rotation: r }); }} className="flex-1 h-1" />
                <span className="text-[10px] font-mono text-indigo-400 w-8 text-center">{Math.round(rotation)}°</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-xl border border-white/5">
                  <button onClick={handleRotateCcw} className="p-2 text-white/50 hover:text-white"><RotateCcw size={16}/></button>
                  <button onClick={handleRotateCw} className="p-2 text-white/50 hover:text-white"><RotateCw size={16}/></button>
                  <button onClick={()=>updateZoomAnchor() || setZoom(z => z * 0.8)} className="p-2 text-white/50 hover:text-white"><ZoomOut size={16}/></button>
                  <button onClick={fitToViewport} className="p-2 text-white/50 hover:text-white"><Maximize size={16}/></button>
                  <button onClick={()=>updateZoomAnchor() || setZoom(z => z * 1.2)} className="p-2 text-white/50 hover:text-white"><ZoomIn size={16}/></button>
                </div>
                <div className="flex items-center gap-1 flex-1 justify-end">
                   <button onClick={()=>navigateTo(Math.max(0,editingIdx-1))} className={`p-1.5 transition-all ${editingIdx===0 ? 'text-white/10' : 'text-white/50 hover:text-white'}`}><ChevronRight size={28}/></button>
                   <button onClick={handleSave} className="bg-indigo-600 text-white px-5 h-9 sm:h-10 rounded-xl font-black text-xs sm:text-sm shadow-lg flex-1 max-w-[140px]">{isProcessing ? <Loader2 className="loading-spinner" size={16}/> : 'שמור חיתוך'}</button>
                   <button onClick={()=>navigateTo(Math.min(images.length-1,editingIdx+1))} className={`p-1.5 transition-all ${editingIdx===images.length-1 ? 'text-white/10' : 'text-white/50 hover:text-white'}`}><ChevronLeft size={28}/></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
