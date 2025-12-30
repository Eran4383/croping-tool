import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as Lucide from 'lucide-react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';

const e = React.createElement;

const getCroppedImg = async (image, canvasElement, crop, options) => {
  const { expandCanvas, bgType, bgColor, bgImage, format } = options;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;

  if (expandCanvas) {
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
      const bgImg = new Image(); bgImg.src = bgImage;
      await new Promise(r => bgImg.onload = r);
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    }

    const wrapper = canvasElement;
    const imgEl = wrapper.querySelector('img.source-img');
    const wrapperRect = wrapper.getBoundingClientRect();
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

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(URL.createObjectURL(blob)), format, 1);
  });
};

const App = () => {
  const [images, setImages] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [exportFormat, setExportFormat] = useState('image/jpeg');
  
  const [expandCanvas, setExpandCanvas] = useState(false);
  const [bgType, setBgType] = useState('blur');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [bgImage, setBgImage] = useState(null);

  const [crop, setCrop] = useState();
  const [aspect, setAspect] = useState(1);
  const imgRef = useRef(null);
  const wrapperRef = useRef(null);

  const handleFiles = useCallback((files) => {
    const newImgs = Array.from(files).filter(f => f.type.startsWith('image/')).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      croppedUrl: null
    }));
    setImages(prev => [...prev, ...newImgs]);
  }, []);

  const onImageLoad = (ev) => {
    const { width, height } = wrapperRef.current ? wrapperRef.current.getBoundingClientRect() : ev.currentTarget;
    const initialCrop = aspect 
      ? centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height), width, height)
      : { unit: '%', x: 5, y: 5, width: 90, height: 90 };
    setCrop(initialCrop);
  };

  const handleNext = async () => {
    if (imgRef.current && crop) {
        const options = { expandCanvas, bgType, bgColor, bgImage, format: exportFormat };
        const url = await getCroppedImg(imgRef.current, wrapperRef.current, crop, options);
        const currentIdx = editingIndex;
        setImages(prev => prev.map((img, i) => i === currentIdx ? { ...img, croppedUrl: url } : img));
    }
    if (editingIndex < images.length - 1) setEditingIndex(editingIndex + 1);
    else setEditingIndex(null);
  };

  const applyToAll = async () => {
    if (!imgRef.current || !crop) return;
    const currentCrop = { ...crop };
    const options = { expandCanvas, bgType, bgColor, bgImage, format: exportFormat };
    const updated = await Promise.all(images.map(async (img) => {
      const temp = new Image();
      temp.src = img.previewUrl;
      await new Promise(r => temp.onload = r);
      const url = await getCroppedImg(temp, wrapperRef.current, currentCrop, options);
      return { ...img, croppedUrl: url };
    }));
    setImages(updated);
    setEditingIndex(null);
  };

  return e('div', { className: 'min-h-screen' },
    e('nav', { className: 'h-20 bg-white border-b px-8 flex items-center justify-between sticky top-0 z-40' },
      e('div', { className: 'flex items-center gap-3' },
        e('div', { className: 'bg-indigo-600 p-2 rounded-xl text-white' }, e(Lucide.Scissors, { size: 20 })),
        e('span', { className: 'text-xl font-bold' }, 'BulkCrop Pro')
      ),
      images.length > 0 && e('button', { className: 'bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg', onClick: () => setEditingIndex(0) }, 'BATCH CROP')
    ),
    e('main', { className: 'max-w-7xl mx-auto px-8 py-12' },
      images.length === 0 ? e('div', { className: 'flex justify-center py-24' },
        e('div', { 
          className: 'w-full max-w-2xl border-2 border-dashed border-slate-200 rounded-[2.5rem] p-24 bg-white text-center cursor-pointer hover:border-indigo-400 group',
          onClick: () => { const i = document.createElement('input'); i.type='file'; i.multiple=true; i.accept='image/*'; i.onchange=(ev)=>handleFiles(ev.target.files); i.click(); }
        },
          e('div', { className: 'w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform' }, e(Lucide.Upload, { size: 32 })),
          e('h2', { className: 'text-2xl font-bold' }, 'Drop or Paste Images'),
          e('p', { className: 'text-slate-400 mt-2' }, 'Supports bulk selection and canvas expansion')
        )
      ) : e('div', { className: 'animate-in' },
        e('div', { className: 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6' },
          images.map((img, idx) => e('div', { key: img.id, className: 'group bg-white rounded-2xl overflow-hidden border border-slate-200 relative' },
            e('div', { className: 'aspect-square relative cursor-pointer', onClick: () => setEditingIndex(idx) },
              e('img', { src: img.croppedUrl || img.previewUrl, className: 'w-full h-full object-cover' }),
              e('button', { 
                className: 'absolute top-2 right-2 p-1.5 bg-white text-slate-400 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-sm',
                onClick: (ev) => { ev.stopPropagation(); setImages(p => p.filter(i => i.id !== img.id)); }
              }, e(Lucide.X, { size: 14, strokeWidth: 3 }))
            ),
            e('div', { className: 'p-3 text-[10px] font-bold text-slate-500 truncate' }, img.name)
          ))
        )
      )
    ),
    editingIndex !== null && e('div', { className: 'fixed inset-0 z-50 bg-slate-950 flex flex-col lg:flex-row' },
      e('div', { className: 'bg-white w-full h-full flex flex-col overflow-hidden' },
        e('div', { className: 'p-6 border-b flex justify-between items-center' },
          e('h3', { className: 'font-bold' }, `${editingIndex + 1} / ${images.length} - ${images[editingIndex].name}`),
          e('button', { onClick: () => setEditingIndex(null) }, e(Lucide.X, { size: 28 }))
        ),
        e('div', { className: 'flex-1 flex flex-col lg:flex-row' },
            e('div', { className: 'w-full lg:w-72 bg-slate-50 border-r p-6' },
                e('div', { className: 'flex items-center justify-between' },
                    e('label', { className: 'font-bold text-xs' }, 'Canvas Expand'),
                    e('input', { type: 'checkbox', checked: expandCanvas, onChange: (ev) => setExpandCanvas(ev.target.checked) })
                ),
                expandCanvas && e('div', { className: 'mt-4 space-y-4' },
                    e('select', { className: 'w-full p-2 rounded border text-xs', value: bgType, onChange: (ev) => setBgType(ev.target.value) },
                        e('option', { value: 'color' }, 'Color'),
                        e('option', { value: 'blur' }, 'Blur'),
                        e('option', { value: 'image' }, 'Image')
                    ),
                    bgType === 'color' && e('input', { type: 'color', value: bgColor, onChange: (ev) => setBgColor(ev.target.value), className: 'w-full' })
                )
            ),
            e('div', { className: 'flex-1 relative bg-black flex items-center justify-center p-8' },
                e(ReactCrop, { crop, onChange: setCrop, aspect }, 
                    e('div', { 
                        ref: wrapperRef, 
                        className: `flex items-center justify-center ${expandCanvas ? 'p-48' : ''}`,
                        style: { background: bgType === 'color' && expandCanvas ? bgColor : 'transparent' }
                    },
                        expandCanvas && bgType === 'blur' && e('img', { src: images[editingIndex].previewUrl, className: 'absolute inset-0 w-full h-full object-cover blur-3xl opacity-50' }),
                        e('img', { ref: imgRef, src: images[editingIndex].previewUrl, onLoad: onImageLoad, className: 'source-img max-h-[60vh] object-contain relative z-10' })
                    )
                )
            )
        ),
        e('div', { className: 'p-8 border-t flex items-center justify-between' },
          e('div', { className: 'flex gap-2' },
            [{l: '1:1', v: 1}, {l: '16:9', v: 16/9}, {l: '9:16', v: 9/16}, {l: 'Free', v: undefined}].map(v => e('button', { 
              key: v.l, onClick: () => setAspect(v.v),
              className: `px-6 py-2 rounded-lg text-xs font-bold ${aspect === v.v ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`
            }, v.l))
          ),
          e('div', { className: 'flex gap-3' },
            e('button', { className: 'px-6 py-3 text-indigo-600 font-bold', onClick: applyToAll }, 'Apply to All'),
            e('button', { className: 'px-10 py-3 bg-indigo-600 text-white rounded-xl font-bold', onClick: handleNext }, 'Next Image')
          )
        )
      )
    )
  );
};

const root = createRoot(document.getElementById('root'));
root.render(e(App));
