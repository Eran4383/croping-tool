import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as Lucide from 'lucide-react';
import Cropper from 'react-easy-crop';

const e = React.createElement;

// --- HELPERS ---
const getCroppedImg = async (imageSrc, pixelCrop, format = 'image/jpeg') => {
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
    canvas.toBlob((blob) => resolve(URL.createObjectURL(blob)), format, 0.95);
  });
};

// --- COMPONENTS ---
const App = () => {
  const [images, setImages] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [exportFormat, setExportFormat] = useState('image/jpeg');
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

  const removeImage = (id) => setImages(prev => prev.filter(img => img.id !== id));

  const saveCrop = async (id = editingId) => {
    const item = images.find(i => i.id === id);
    const url = await getCroppedImg(item.previewUrl, pixels, exportFormat);
    setImages(prev => prev.map(i => i.id === id ? { ...i, croppedUrl: url } : i));
    setEditingId(null);
  };

  const applyToAll = async () => {
    if (!pixels) return;
    const currentPixels = { ...pixels };
    const updatedImages = await Promise.all(images.map(async (img) => {
      if (img.id === editingId || !img.croppedUrl) {
        const url = await getCroppedImg(img.previewUrl, currentPixels, exportFormat);
        return { ...img, croppedUrl: url };
      }
      return img;
    }));
    setImages(updatedImages);
    setEditingId(null);
  };

  const download = (item) => {
    const a = document.createElement('a');
    const ext = exportFormat.split('/')[1];
    a.href = item.croppedUrl || item.previewUrl;
    a.download = `crop-${item.name.split('.')[0]}.${ext}`;
    a.click();
  };

  const editingItem = images.find(i => i.id === editingId);

  return e('div', { className: 'min-h-screen pb-20' },
    e('nav', { className: 'h-20 bg-white border-b border-slate-100 px-8 flex items-center justify-between sticky top-0 z-40' },
      e('div', { className: 'flex items-center gap-3' },
        e('div', { className: 'bg-indigo-600 p-2 rounded-xl text-white' }, e(Lucide.Scissors, { size: 18 })),
        e('span', { className: 'text-xl font-bold' }, 'BulkCrop Pro')
      ),
      e('div', { className: 'flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg border' },
        e(Lucide.FileType, { size: 12, className: 'text-slate-400' }),
        e('select', { 
          className: 'bg-transparent text-[10px] font-bold outline-none cursor-pointer',
          value: exportFormat,
          onChange: (ev) => setExportFormat(ev.target.value)
        },
          e('option', { value: 'image/jpeg' }, 'JPEG'),
          e('option', { value: 'image/png' }, 'PNG'),
          e('option', { value: 'image/webp' }, 'WebP')
        )
      )
    ),

    e('main', { className: 'max-w-6xl mx-auto px-6 pt-12' },
      images.length === 0 ? 
        e('div', { 
          className: 'border-2 border-dashed border-slate-200 rounded-3xl p-24 bg-white text-center cursor-pointer hover:border-indigo-400 group',
          onClick: () => {
            const i = document.createElement('input'); i.type='file'; i.multiple=true; i.accept='image/*';
            i.onchange=(ev)=>handleFiles(ev.target.files); i.click();
          }
        },
          e('div', { className: 'w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform' }, e(Lucide.Upload, { size: 32 })),
          e('h2', { className: 'text-2xl font-bold' }, 'Select Images'),
          e('p', { className: 'text-slate-400 mt-2' }, 'Gallery enabled • Multi-select supported')
        )
      :
        e('div', { className: 'space-y-8 animate-in' },
          e('div', { className: 'flex justify-between items-center bg-white p-6 rounded-2xl border' },
            e('div', { className: 'flex items-center gap-4' },
              e('span', { className: 'font-bold' }, `${images.length} Files`),
              e('button', { className: 'text-indigo-600 text-sm font-bold flex items-center gap-1', onClick: () => {
                const i = document.createElement('input'); i.type='file'; i.multiple=true; i.accept='image/*';
                i.onchange=(ev)=>handleFiles(ev.target.files); i.click();
              }}, e(Lucide.Plus, { size: 16 }), 'Add More')
            ),
            e('div', { className: 'flex gap-4' },
              e('button', { className: 'text-slate-400 font-bold text-sm', onClick: () => setImages([]) }, 'Clear'),
              e('button', { className: 'px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100', onClick: () => images.forEach(download) }, 'Download All')
            )
          ),
          e('div', { className: 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6' },
            images.map(img => e('div', { key: img.id, className: 'bg-white rounded-2xl overflow-hidden border relative group' },
              e('div', { className: 'aspect-square relative' },
                e('img', { src: img.croppedUrl || img.previewUrl, className: 'w-full h-full object-cover' }),
                img.croppedUrl && e('div', { className: 'absolute top-2 left-2 bg-green-500 text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase' }, 'Cropped'),
                e('button', { 
                  className: 'absolute top-2 right-2 p-1.5 bg-white text-slate-400 rounded-full shadow-sm opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all',
                  onClick: (ev) => { ev.stopPropagation(); removeImage(img.id); }
                }, e(Lucide.X, { size: 14, strokeWidth: 3 })),
                e('div', { className: 'absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2' },
                  e('button', { onClick: () => setEditingId(img.id), className: 'p-3 bg-white text-indigo-600 rounded-xl' }, e(Lucide.Crop, { size: 20 })),
                  e('button', { onClick: () => download(img), className: 'p-3 bg-indigo-600 text-white rounded-xl' }, e(Lucide.Download, { size: 20 }))
                )
              ),
              e('div', { className: 'p-2 text-[10px] font-bold text-slate-400 truncate' }, img.name)
            ))
          )
        )
    ),

    editingItem && e('div', { className: 'fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4' },
      e('div', { className: 'bg-white w-full max-w-5xl h-[85vh] rounded-3xl flex flex-col overflow-hidden shadow-2xl' },
        e('div', { className: 'p-6 border-b flex justify-between items-center' },
          e('h3', { className: 'font-bold' }, 'Crop Editor'),
          e('button', { onClick: () => setEditingId(null) }, e(Lucide.X, { size: 28 }))
        ),
        e('div', { className: 'flex-1 relative bg-black' },
          e(Cropper, { image: editingItem.previewUrl, crop, zoom, aspect, onCropChange: setCrop, onZoomChange: setZoom, onCropComplete: (_, p) => setPixels(p) })
        ),
        e('div', { className: 'p-6 flex flex-wrap gap-6 items-center justify-between border-t bg-slate-50' },
          e('div', { className: 'flex gap-2 p-1 bg-white rounded-xl border' },
            [{l: '1:1', v: 1}, {l: '16:9', v: 16/9}, {l: '9:16', v: 9/16}, {l: 'Free', v: undefined}].map(v => e('button', {
              key: v.l, onClick: () => setAspect(v.v),
              className: `px-6 py-2 rounded-lg text-xs font-bold ${aspect === v.v ? 'bg-indigo-600 text-white' : 'text-slate-400'}`
            }, v.l))
          ),
          e('div', { className: 'flex gap-3' },
            e('button', { className: 'px-6 py-3 bg-white text-indigo-600 border border-indigo-100 rounded-xl font-bold text-sm flex items-center gap-2', onClick: applyToAll }, e(Lucide.Settings2, { size: 18 }), 'Apply to All'),
            e('button', { className: 'px-10 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-xl shadow-indigo-100', onClick: () => saveCrop() }, 'Save Selection')
          )
        )
      )
    )
  );
};

const root = createRoot(document.getElementById('root'));
root.render(e(App));
