import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as Lucide from 'lucide-react';
import Cropper from 'react-easy-crop';

const e = React.createElement;

// --- HELPERS ---
const getCroppedImg = async (imageSrc, pixelCrop) => {
  const image = await new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(URL.createObjectURL(blob)), 'image/jpeg', 0.95);
  });
};

// --- COMPONENTS ---
const App = () => {
  const [images, setImages] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(1);
  const [pixels, setPixels] = useState(null);

  const handleFiles = (files) => {
    const newImgs = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        croppedUrl: null
      }));
    setImages(prev => [...prev, ...newImgs]);
  };

  useEffect(() => {
    const onPaste = (ev) => {
      const items = (ev.clipboardData || ev.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf("image") !== -1) handleFiles([item.getAsFile()]);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const saveCrop = async () => {
    const item = images.find(i => i.id === editingId);
    const url = await getCroppedImg(item.previewUrl, pixels);
    setImages(prev => prev.map(i => i.id === editingId ? { ...i, croppedUrl: url } : i));
    setEditingId(null);
  };

  const editingItem = images.find(i => i.id === editingId);

  return e('div', { className: 'min-h-screen pb-20' },
    // Nav
    e('nav', { className: 'h-20 bg-white border-b border-slate-100 px-8 flex items-center justify-between sticky top-0 z-40' },
      e('div', { className: 'flex items-center gap-2' },
        e('div', { className: 'bg-indigo-600 p-2 rounded-lg text-white' }, e(Lucide.Scissors, { size: 18 })),
        e('span', { className: 'text-xl font-bold' }, 'BulkCrop')
      ),
      e('div', { className: 'text-xs font-bold text-slate-400 uppercase' }, 'Private Local Processing')
    ),

    // Main
    e('main', { className: 'max-w-6xl mx-auto px-6 pt-12' },
      images.length === 0 ? 
        e('div', { 
          className: 'border-2 border-dashed border-slate-200 rounded-3xl p-20 bg-white text-center cursor-pointer hover:border-indigo-400 transition-all',
          onClick: () => { const i = document.createElement('input'); i.type='file'; i.multiple=true; i.onchange=(ev)=>handleFiles(ev.target.files); i.click(); }
        },
          e('div', { className: 'w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6' }, e(Lucide.Upload, { size: 32 })),
          e('h2', { className: 'text-2xl font-bold text-slate-800' }, 'Drop images here'),
          e('p', { className: 'text-slate-400 mt-2' }, 'Click to browse or paste from clipboard')
        )
      :
        e('div', { className: 'space-y-8' },
          e('div', { className: 'flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100' },
            e('span', { className: 'font-bold px-4' }, `${images.length} Images`),
            e('div', { className: 'flex gap-2' },
              e('button', { className: 'px-4 py-2 text-slate-500 font-bold', onClick: () => setImages([]) }, 'Clear'),
              e('button', { className: 'px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100', onClick: () => images.forEach(i => {
                const a = document.createElement('a'); a.href = i.croppedUrl || i.previewUrl; a.download = i.name; a.click();
              }) }, 'Download All')
            )
          ),
          e('div', { className: 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6' },
            images.map(img => e('div', { key: img.id, className: 'bg-white rounded-2xl overflow-hidden border border-slate-200 relative group' },
              e('div', { className: 'aspect-square relative' },
                e('img', { src: img.croppedUrl || img.previewUrl, className: 'w-full h-full object-cover' }),
                e('div', { className: 'absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2' },
                  e('button', { onClick: () => setEditingId(img.id), className: 'p-2 bg-white rounded-lg' }, e(Lucide.Crop, { size: 18 })),
                  e('button', { onClick: () => setImages(prev => prev.filter(i => i.id !== img.id)), className: 'p-2 bg-white text-red-600 rounded-lg' }, e(Lucide.Trash2, { size: 18 }))
                )
              ),
              e('div', { className: 'p-2 text-[10px] font-bold text-slate-400 truncate' }, img.name)
            ))
          )
        )
    ),

    // Modal
    editingItem && e('div', { className: 'fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4' },
      e('div', { className: 'bg-white w-full max-w-4xl h-[80vh] rounded-3xl flex flex-col overflow-hidden' },
        e('div', { className: 'p-6 border-b flex justify-between items-center' },
          e('h3', { className: 'font-bold' }, 'Crop Image'),
          e('button', { onClick: () => setEditingId(null) }, e(Lucide.X))
        ),
        e('div', { className: 'flex-1 relative bg-black' },
          e(Cropper, { 
            image: editingItem.previewUrl, 
            crop, zoom, aspect, 
            onCropChange: setCrop, 
            onZoomChange: setZoom, 
            onCropComplete: (_, p) => setPixels(p) 
          })
        ),
        e('div', { className: 'p-6 flex flex-wrap gap-4 items-center justify-between' },
          e('div', { className: 'flex gap-2' },
            [1, 16/9, 9/16].map(v => e('button', { 
              key: v, 
              onClick: () => setAspect(v), 
              className: `px-4 py-2 rounded-lg text-xs font-bold ${aspect === v ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`
            }, v === 1 ? '1:1' : v > 1 ? '16:9' : '9:16'))
          ),
          e('div', { className: 'flex gap-3' },
            e('button', { className: 'px-6 py-2 font-bold text-slate-400', onClick: () => setEditingId(null) }, 'Cancel'),
            e('button', { className: 'px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold', onClick: saveCrop }, 'Save')
          )
        )
      )
    )
  );
};

const root = createRoot(document.getElementById('root'));
root.render(e(App));
