
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Scissors, Download, X, Check, Plus, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, Trash2, Move, MousePointer2, Maximize, RotateCw, RotateCcw, FileType, Settings, RefreshCw, Undo as UndoIcon, Redo as RedoIcon } from 'lucide-react';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import { jsPDF } from 'jspdf';

const VERSION = "v4.5.2";
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
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) files.push(file);
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
    const img = imgRef.current;
    const vw = viewport.clientWidth - 40;
    const vh = viewport.clientHeight - 40;
    const ratio = Math.min(vw / img.naturalWidth, vh / img.naturalHeight);
    setZoom(ratio);
    zoomState.current.lastZoom = ratio;
    const zoomedW = img.naturalWidth * ratio;
    const zoomedH = img.naturalHeight * ratio;
    requestAnimationFrame(() => {
      if (viewportRef.current) {
        viewportRef.current.scrollLeft = (zoomedW / 2 + PADDING) - (viewportRef.current.clientWidth / 2);
        viewportRef.current.scrollTop = (zoomedH / 2 + PADDING) - (viewportRef.current.clientHeight / 2);
      }
    });
  }, []);

  const currentOriginalAspect = imgRef.current ? imgRef.current.naturalWidth / imgRef.current.naturalHeight : undefined;

  const pushToHistory = useCallback((state: EditorState) => {
    if (isInternalHistoryUpdate.current) return;
    setHistory(prev => {
      const newHistory = prev.slice(0, historyPointer + 1);
      const last = newHistory[newHistory.length - 1];
      if (last && 
          JSON.stringify(last.crop) === JSON.stringify(state.crop) && 
          last.aspect === state.aspect && 
          last.rotation === state.rotation) {
        return prev;
      }
      newHistory.push(state);
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryPointer(prev => {
      const newPointer = prev + 1;
      return newPointer >= 50 ? 49 : newPointer;
    });
  }, [historyPointer]);

  const undo = () => {
    if (historyPointer > 0) {
      isInternalHistoryUpdate.current = true;
      const prevState = history[historyPointer - 1];
      setCrop(prevState.crop);
      setAspect(prevState.aspect);
      setRotation(prevState.rotation);
      setHistoryPointer(historyPointer - 1);
      setTimeout(() => { isInternalHistoryUpdate.current = false; }, 0);
    }
  };

  const redo = () => {
    if (historyPointer < history.length - 1) {
      isInternalHistoryUpdate.current = true;
      const nextState = history[historyPointer + 1];
      setCrop(nextState.crop);
      setAspect(nextState.aspect);
      setRotation(nextState.rotation);
      setHistoryPointer(historyPointer + 1);
      setTimeout(() => { isInternalHistoryUpdate.current = false; }, 0);
    }
  };

  const onAspectChange = (newAspect: number | undefined) => {
    setAspect(newAspect);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      let newCrop: Crop;
      if (newAspect === undefined || (currentOriginalAspect && Math.abs(newAspect - currentOriginalAspect) < 0.001)) {
        newCrop = { unit: '%' as const, x: 0, y: 0, width: 100, height: 100 };
      } else {
        newCrop = centerCrop(makeAspectCrop({ unit: '%' as const, width: 100 }, newAspect, width, height), width, height);
      }
      setCrop(newCrop);
      setTimeout(() => updateZoomAnchor(), 50);
      pushToHistory({ crop: newCrop, aspect: newAspect, rotation });
    }
  };

  const navigateTo = useCallback((newIdx: number | null) => {
    if (editingIdx !== null && crop) {
      setImages(prev => prev.map((img, i) => i === editingIdx ? {
        ...img,
        cropConfig: { crop: { ...crop }, aspect, rotation }
      } : img));
    }
    setEditingIdx(newIdx);
  }, [editingIdx, crop, aspect, rotation]);

  useEffect(() => {
    if (editingIdx === null) return;
    const observer = new ResizeObserver(() => {
      if (!zoomState.current.isPinching) fitToViewport();
    });
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [editingIdx, fitToViewport]);

  useLayoutEffect(() => {
    if (!viewportRef.current || !imgRef.current) return;
    const { lastZoom, anchorX, anchorY, viewX, viewY } = zoomState.current;
    if (Math.abs(zoom - lastZoom) > 0.0001) {
      applyZoomScroll(zoom, anchorX, anchorY, viewX, viewY);
    }
    zoomState.current.lastZoom = zoom;
  }, [zoom, applyZoomScroll]);

  useEffect(() => {
    if (editingIdx !== null && images[editingIdx]) {
      document.body.classList.add('editor-open');
      setIsPanMode(false);
      const currentImg = images[editingIdx];
      let initialCrop: Crop = { unit: '%' as const, x: 0, y: 0, width: 100, height: 100 };
      let initialAspect: number | undefined = undefined;
      let initialRotation = 0;

      if (currentImg && currentImg.cropConfig) {
        initialCrop = currentImg.cropConfig.crop;
        initialAspect = currentImg.cropConfig.aspect;
        initialRotation = currentImg.cropConfig.rotation || 0;
      }
      
      setCrop(initialCrop);
      setAspect(initialAspect);
      setRotation(initialRotation);
      
      setHistory([{ crop: initialCrop, aspect: initialAspect, rotation: initialRotation }]);
      setHistoryPointer(0);

      setTimeout(fitToViewport, 100);
    } else if (editingIdx === null) {
      document.body.classList.remove('editor-open');
    }
  }, [editingIdx, images, fitToViewport]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    imgRef.current = e.currentTarget;
    fitToViewport();
  };

  const onCropComplete = (pixelCrop: PixelCrop) => {
    setCompletedCrop(pixelCrop);
    pushToHistory({ crop, aspect, rotation });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsPinching(true);
      zoomState.current.isPinching = true;
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
      setZoom(newZoom);
      applyZoomScroll(newZoom, zoomState.current.anchorX, zoomState.current.anchorY, midX, midY);
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

  const handleZoomAction = (factor: number) => {
    updateZoomAnchor();
    setZoom(z => Math.min(20, Math.max(0.001, z * factor)));
  };

  const getProcessedCanvas = async (image: HTMLImageElement, cropConfig: PixelCrop, currentRotation: number) => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const cropX = cropConfig.x * scaleX;
    const cropY = cropConfig.y * scaleY;
    const cropW = cropConfig.width * scaleX;
    const cropH = cropConfig.height * scaleY;
    canvas.width = Math.ceil(cropW); canvas.height = Math.ceil(cropH);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((currentRotation * Math.PI) / 180);
    const imgCenterX = cropX + cropW / 2;
    const imgCenterY = cropY + cropH / 2;
    ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, -imgCenterX, -imgCenterY, image.naturalWidth, image.naturalHeight);
    ctx.restore();
    return canvas;
  };

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current || editingIdx === null) return;
    setIsProcessing(true);
    const canvas = await getProcessedCanvas(imgRef.current, completedCrop, rotation);
    const previewBlob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.95));
    if (!previewBlob) return;
    const previewUrl = URL.createObjectURL(previewBlob);
    setImages(prev => prev.map((img, i) => i === editingIdx ? { ...img, cropped: previewUrl, cropConfig: { crop: { ...crop! }, aspect, rotation } } : img));
    setIsProcessing(false);
    setEditingIdx(null);
  };

  const handleApplyAll = async () => {
    if (!completedCrop || !imgRef.current) return;
    setIsProcessing(true);
    const sourceImg = imgRef.current;
    const xP = (completedCrop.x / sourceImg.width) * 100;
    const yP = (completedCrop.y / sourceImg.height) * 100;
    const wP = (completedCrop.width / sourceImg.width) * 100;
    const hP = (completedCrop.height / sourceImg.height) * 100;
    const updated = await Promise.all(images.map(async (img) => {
      const tempImg = new Image();
      tempImg.src = img.url;
      await new Promise(r => tempImg.onload = r);
      const pxCrop = { x: (xP * tempImg.naturalWidth) / 100, y: (yP * tempImg.naturalHeight) / 100, width: (wP * tempImg.naturalWidth) / 100, height: (hP * tempImg.naturalHeight) / 100 };
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(pxCrop.width); canvas.height = Math.ceil(pxCrop.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      const imgCX = pxCrop.x + pxCrop.width / 2;
      const imgCY = pxCrop.y + pxCrop.height / 2;
      ctx.drawImage(tempImg, -imgCX, -imgCY);
      ctx.restore();
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.95));
      return { ...img, cropped: blob ? URL.createObjectURL(blob) : null, cropConfig: { crop: { unit: '%' as const, x: xP, y: yP, width: wP, height: hP }, aspect, rotation } };
    }));
    setImages(updated);
    setIsProcessing(false);
    alert(`החיתוך והסיבוב הוחלו על כל הגלריה.`);
  };

  const downloadFile = async (img: ImageItem) => {
    if (!img.cropped) return;
    const format = globalFormat;
    const baseName = img.name.split('.')[0];
    if (format === 'application/pdf') {
      const response = await fetch(img.cropped);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const tempImg = new Image();
      tempImg.src = dataUrl;
      await new Promise(r => tempImg.onload = r);
      const pdf = new jsPDF({ orientation: tempImg.width > tempImg.height ? 'l' : 'p', unit: 'px', format: [tempImg.width, tempImg.height] });
      pdf.addImage(dataUrl, 'JPEG', 0, 0, tempImg.width, tempImg.height);
      pdf.save(`CROP_${baseName}.pdf`);
    } else {
      const link = document.createElement('a');
      link.href = img.cropped;
      link.download = `CROP_${baseName}.${format === 'image/png' ? 'png' : 'jpg'}`;
      link.click();
    }
  };

  const downloadAll = async () => {
    for (const img of images) {
      if (!img.cropped) continue;
      await downloadFile(img);
      await new Promise(r => setTimeout(r, 400));
    }
  };

  return (
    <div className="h-screen flex flex-col ltr-force overflow-hidden relative">
      <header className="h-16 bg-white border-b px-6 flex items-center justify-between sticky top-0 z-40 shrink-0" style={{ direction: 'rtl' }}>
        <div className="flex items-center gap-3">
          <Scissors className="text-indigo-600" size={24}/>
          <h1 className="font-extrabold text-lg flex items-center gap-2">Bulk Crop Pro <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md border border-slate-200">{VERSION}</span></h1>
        </div>
        {images.length > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={() => {if(confirm('למחוק הכל?')) setImages([]);}} className="text-slate-400 hover:text-red-500 p-2"><Trash2 size={20}/></button>
            <button onClick={downloadAll} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg"><Download size={16}/> הורד הכל</button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-5 md:p-10" style={{ direction: 'rtl' }}>
        <div className="max-w-6xl mx-auto w-full">
          {images.length === 0 ? (
            <div onClick={() => fileInputRef.current?.click()} className="min-h-[60vh] bg-white border-4 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer hover:border-indigo-300 transition-all group">
              <div className="bg-indigo-50 p-6 rounded-full group-hover:scale-110 transition-transform mb-6"><Plus size={54} className="text-indigo-600"/></div>
              <h2 className="text-2xl font-black text-slate-800">העלאת תמונות לחיתוך</h2>
              <p className="text-slate-400 mt-3 text-center px-8 text-lg">לחצו כאן, גררו קבצים או פשוט <b>הדביקו (CTRL+V)</b></p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 pb-32">
              {images.map((img, idx) => (
                <div key={img.id} onClick={() => setEditingIdx(idx)} className={`img-grid-item group ${img.cropped ? 'done' : ''}`}>
                  <img src={img.cropped || img.url} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  {img.cropped && (
                    <div className="absolute top-3 right-3 bg-emerald-500 text-white rounded-full p-1.5 shadow-xl flex items-center gap-1 px-2">
                      <Check size={12}/>
                      <span className="text-[10px] font-bold uppercase">{ globalFormat.split('/')[1] }</span>
                    </div>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setImages(images.filter(i => i.id !== img.id)); }} className="absolute top-3 left-3 bg-black/40 hover:bg-red-500 text-white p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                  <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-all">
                     <button onClick={(e)=>{e.stopPropagation(); downloadFile(img);}} className="w-full bg-white/90 hover:bg-white text-indigo-600 py-1.5 rounded-lg text-[10px] font-bold shadow-lg flex items-center justify-center gap-1"><Download size={12}/> הורד</button>
                  </div>
                </div>
              ))}
              <div title="הוספה" onClick={() => fileInputRef.current?.click()} className="img-grid-item border-4 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 hover:text-indigo-500 hover:border-indigo-200 transition-all bg-slate-50/50">
                <Plus size={40}/><span className="text-xs mt-2 font-bold uppercase tracking-wider">הוסף עוד</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {editingIdx !== null && images[editingIdx] && (
        <div className={`editor-overlay ltr-force ${isPinching ? 'is-pinching' : ''}`}>
          <div className="flex items-center justify-between px-4 sm:px-6 h-16 bg-black/70 shrink-0 backdrop-blur-xl border-b border-white/10">
            {/* Left Section: Info and Counter */}
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center bg-white/15 px-4 py-1.5 rounded-xl border border-white/10 shadow-inner">
                <span className="text-white font-bold text-sm counter-badge">
                  {editingIdx + 1} <span className="mx-2 opacity-30">/</span> {images.length}
                </span>
              </div>
              <div className="flex items-center bg-white/10 p-1 rounded-2xl border border-white/5">
                <button onClick={() => setIsPanMode(false)} className={`p-2.5 rounded-xl transition-all ${!isPanMode ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}><MousePointer2 size={18}/></button>
                <button onClick={() => setIsPanMode(true)} className={`p-2.5 rounded-xl transition-all ${isPanMode ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}><Move size={18}/></button>
              </div>
            </div>

            {/* Center Section: Main Tools */}
            <div className="hidden sm:flex items-center justify-center flex-1">
              <div className="flex items-center gap-1 bg-white/10 p-1 rounded-2xl border border-white/5">
                <button disabled={historyPointer <= 0} onClick={undo} className={`p-2.5 rounded-xl transition-all ${historyPointer > 0 ? 'text-white hover:bg-white/10' : 'text-white/15 cursor-not-allowed'}`}><UndoIcon size={18}/></button>
                <button disabled={historyPointer >= history.length - 1} onClick={redo} className={`p-2.5 rounded-xl transition-all ${historyPointer < history.length - 1 ? 'text-white hover:bg-white/10' : 'text-white/15 cursor-not-allowed'}`}><RedoIcon size={18}/></button>
              </div>
            </div>

            {/* Right Section: Actions */}
            <div className="flex items-center justify-end gap-3 flex-1">
              <div className="hidden lg:flex items-center bg-white/10 rounded-xl px-3 h-10 border border-white/5">
                <FileType size={16} className="text-white/40 mr-2" />
                <select value={globalFormat} onChange={(e) => setGlobalFormat(e.target.value)} className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer pl-6">
                  <option className="bg-slate-800" value="image/jpeg">JPEG</option>
                  <option className="bg-slate-800" value="image/png">PNG</option>
                  <option className="bg-slate-800" value="application/pdf">PDF</option>
                </select>
              </div>
              <button onClick={() => navigateTo(null)} className="text-white/40 p-2 hover:text-white hover:bg-white/10 rounded-full transition-all"><X size={24}/></button>
            </div>
          </div>

          <div className={`image-viewport ${isPanMode ? 'pan-mode' : ''}`} ref={viewportRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={() => { zoomState.current.isPinching = false; zoomState.current.isDragging = false; setIsPinching(false); }} onWheel={(e) => { e.preventDefault(); updateZoomAnchor(); setZoom(z => Math.min(20, Math.max(0.001, z * (e.deltaY > 0 ? 0.9 : 1.1)))); }}>
            <div className="image-container" ref={containerRef}>
              <ReactCrop crop={crop} onChange={setCrop} onComplete={onCropComplete} aspect={aspect} disabled={isPanMode || isPinching}>
                <img ref={imgRef} src={images[editingIdx].url} onLoad={onImageLoad} draggable={false} className="crop-target-img shadow-2xl" style={{ width: imgRef.current ? `${imgRef.current.naturalWidth * zoom}px` : 'auto', height: imgRef.current ? `${imgRef.current.naturalHeight * zoom}px` : 'auto', transform: `rotate(${rotation}deg)` }} />
              </ReactCrop>
            </div>
          </div>

          <div className="editor-footer" style={{ direction: 'rtl' }}>
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between max-w-6xl mx-auto">
              <div className="flex flex-col gap-2 w-full md:w-auto">
                <div className="aspect-row-scroll">
                   {[{l:'חופשי',v:undefined},{l:'מקורי',v:currentOriginalAspect},{l:'1:1',v:1},{l:'16:9',v:16/9},{l:'9:16',v:9/16},{l:'4:5',v:0.8}].map((a, i)=>(<button key={i} onClick={()=>onAspectChange(a.v)} className={`aspect-chip flex items-center justify-center min-w-[44px] ${aspect===a.v?'active':''}`}>{a.l}</button>))}
                </div>
                <div className="flex items-center gap-4 bg-white/5 p-2 rounded-xl border border-white/5" style={{ direction: 'rtl' }}>
                  <span className="text-[11px] font-bold text-white/60 whitespace-nowrap min-w-[60px]">סיבוב חופשי:</span>
                  <input type="range" min="-180" max="180" step="1" value={rotation > 180 ? rotation - 360 : rotation} onChange={(e) => { const newRot = parseInt(e.target.value); setRotation(newRot); pushToHistory({ crop, aspect, rotation: newRot }); }} className="flex-1 h-1.5" />
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-indigo-400 w-8 text-center">{Math.round(rotation)}°</span>
                    <button onClick={() => { setRotation(0); pushToHistory({ crop, aspect, rotation: 0 }); }} className="text-white/40 hover:text-white transition-colors"><RefreshCw size={14}/></button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleSave} disabled={isProcessing} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 h-12 rounded-xl font-black shadow-lg flex items-center justify-center min-w-[140px] transition-all">
                  {isProcessing ? <Loader2 className="loading-spinner" size={20}/> : 'שמור חיתוך'}
                </button>
                <button onClick={handleApplyAll} className="hidden md:block bg-white/5 hover:bg-white/10 text-indigo-300 font-bold text-xs px-5 py-3 rounded-xl border border-white/10 transition-all">החל על הכל</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <input type="file" ref={fileInputRef} multiple accept="image/*" className="hidden" onChange={e => handleAddImages(e.target.files)} />
    </div>
  );
};

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
