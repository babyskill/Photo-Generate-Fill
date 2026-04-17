import React, { useRef, useState, useEffect } from 'react';
import { Upload, Eraser, Download, Image as ImageIcon, Loader2, Maximize, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Undo, Redo } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

const RATIOS = [
  { str: "1:1", val: 1/1 },
  { str: "3:4", val: 3/4 },
  { str: "4:3", val: 4/3 },
  { str: "9:16", val: 9/16 },
  { str: "16:9", val: 16/9 },
  { str: "1:4", val: 1/4 },
  { str: "1:8", val: 1/8 },
  { str: "4:1", val: 4/1 },
  { str: "8:1", val: 8/1 },
];

const getClosestAspectRatio = (width: number, height: number) => {
  const target = width / height;
  let closest = RATIOS[0];
  let minDiff = Math.abs(target - closest.val);
  for (const r of RATIOS) {
    const diff = Math.abs(target - r.val);
    if (diff < minDiff) {
      minDiff = diff;
      closest = r;
    }
  }
  return closest.str;
};

export function ImageExpander() {
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(50);
  const [hasImage, setHasImage] = useState(false);
  const [imageToDraw, setImageToDraw] = useState<HTMLImageElement | null>(null);
  
  const [prompt, setPrompt] = useState('');
  const [keepOriginalStyle, setKeepOriginalStyle] = useState(false);
  const [resolution, setResolution] = useState('2K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Undo/Redo State
  const historyRef = useRef<{img: ImageData, mask: ImageData, w: number, h: number}[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateUndoRedoState = () => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  const saveState = () => {
    const imgCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!imgCanvas || !maskCanvas) return;
    const imgCtx = imgCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!imgCtx || !maskCtx) return;

    const w = imgCanvas.width;
    const h = imgCanvas.height;
    const imgData = imgCtx.getImageData(0, 0, w, h);
    const maskData = maskCtx.getImageData(0, 0, w, h);

    const nextIndex = historyIndexRef.current + 1;
    historyRef.current = historyRef.current.slice(0, nextIndex);
    historyRef.current.push({ img: imgData, mask: maskData, w, h });
    historyIndexRef.current = nextIndex;
    updateUndoRedoState();
  };

  useEffect(() => {
    if (imageToDraw && imageCanvasRef.current && maskCanvasRef.current) {
      const imgCanvas = imageCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      
      imgCanvas.width = imageToDraw.width;
      imgCanvas.height = imageToDraw.height;
      maskCanvas.width = imageToDraw.width;
      maskCanvas.height = imageToDraw.height;
      
      const imgCtx = imgCanvas.getContext('2d');
      const maskCtx = maskCanvas.getContext('2d');
      
      imgCtx?.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
      imgCtx?.drawImage(imageToDraw, 0, 0);
      maskCtx?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      
      setImageToDraw(null);
      
      historyRef.current = [];
      historyIndexRef.current = -1;
      saveState();
    }
  }, [imageToDraw]);

  const restoreState = (index: number) => {
    const state = historyRef.current[index];
    if (!state) return;
    const imgCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!imgCanvas || !maskCanvas) return;

    imgCanvas.width = state.w;
    imgCanvas.height = state.h;
    maskCanvas.width = state.w;
    maskCanvas.height = state.h;
    setCanvasSize({ width: state.w, height: state.h });

    imgCanvas.getContext('2d')?.putImageData(state.img, 0, 0);
    maskCanvas.getContext('2d')?.putImageData(state.mask, 0, 0);

    historyIndexRef.current = index;
    updateUndoRedoState();
  };

  const undo = () => {
    if (historyIndexRef.current > 0) {
      restoreState(historyIndexRef.current - 1);
    }
  };

  const redo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      restoreState(historyIndexRef.current + 1);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setCanvasSize({ width: img.width, height: img.height });
        setHasImage(true);
        setResultImage(null);
        setImageToDraw(img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const expandCanvas = (direction: 'top' | 'bottom' | 'left' | 'right', amount: number = 256) => {
    const imgCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!imgCanvas || !maskCanvas) return;
    const imgCtx = imgCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!imgCtx || !maskCtx) return;

    const oldImgData = imgCtx.getImageData(0, 0, imgCanvas.width, imgCanvas.height);
    const oldMaskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    
    let newWidth = imgCanvas.width;
    let newHeight = imgCanvas.height;
    let dx = 0;
    let dy = 0;

    if (direction === 'left') { newWidth += amount; dx = amount; }
    else if (direction === 'right') { newWidth += amount; }
    else if (direction === 'top') { newHeight += amount; dy = amount; }
    else if (direction === 'bottom') { newHeight += amount; }

    setCanvasSize({ width: newWidth, height: newHeight });
    imgCanvas.width = newWidth;
    imgCanvas.height = newHeight;
    maskCanvas.width = newWidth;
    maskCanvas.height = newHeight;
    
    imgCtx.clearRect(0, 0, newWidth, newHeight);
    imgCtx.putImageData(oldImgData, dx, dy);
    
    maskCtx.clearRect(0, 0, newWidth, newHeight);
    maskCtx.putImageData(oldMaskData, dx, dy);

    saveState();
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const ctx = maskCanvasRef.current?.getContext('2d');
      if (ctx) ctx.beginPath();
      saveState();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.globalCompositeOperation = 'source-over';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleGenerate = async () => {
    const imgCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!imgCanvas || !maskCanvas) return;
    
    setIsGenerating(true);
    setError(null);
    setResultImage(null);

    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = imgCanvas.width;
      tempCanvas.height = imgCanvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error("Không thể tạo canvas tạm thời");

      tempCtx.drawImage(imgCanvas, 0, 0);
      tempCtx.globalCompositeOperation = 'destination-out';
      tempCtx.drawImage(maskCanvas, 0, 0);

      const canvasDataUrl = tempCanvas.toDataURL('image/png');
      const base64Data = canvasDataUrl.split(',')[1];
      
      const apiKey = (typeof process !== 'undefined' && process.env ? process.env.API_KEY : undefined) || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });

      const aspectRatio = getClosestAspectRatio(canvasSize.width, canvasSize.height);

      let finalPrompt = prompt;
      if (keepOriginalStyle) {
        finalPrompt += " IMPORTANT: Strictly preserve the original style, design, and aesthetics of the existing image. Only add details to the masked/transparent areas without altering the core visual identity of the original content.";
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: 'image/png',
              },
            },
            {
              text: finalPrompt,
            },
          ],
        },
        config: {
          imageConfig: {
            imageSize: resolution,
            aspectRatio: aspectRatio,
          }
        }
      });

      console.log("Model response:", response);

      if (response.promptFeedback?.blockReason) {
        throw new Error(`Prompt đã bị chặn: ${response.promptFeedback.blockReason}`);
      }

      if (response.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error("Việc tạo ảnh đã bị chặn do bộ lọc an toàn. Vui lòng thử một hình ảnh hoặc prompt khác.");
      }

      let foundImage = false;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            setResultImage(`data:image/png;base64,${part.inlineData.data}`);
            foundImage = true;
            break;
          } else if (part.text) {
            console.log("Model returned text:", part.text);
          }
        }
      }
      
      if (!foundImage) {
        const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
        const debugInfo = JSON.stringify(response);
        throw new Error(textPart ? `Mô hình trả về văn bản thay vì hình ảnh: ${textPart}` : `Mô hình không trả về hình ảnh nào. Thông tin lỗi: ${debugInfo}`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Đã xảy ra lỗi trong quá trình tạo ảnh.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Maximize className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Công cụ mở rộng ảnh AI</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel: Editor */}
        <div className="flex-1 flex flex-col bg-gray-50 border-r overflow-hidden">
          <div className="p-4 bg-white border-b flex flex-wrap items-center gap-4 shadow-sm z-10">
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors font-medium">
              <Upload size={18} />
              Tải ảnh lên
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>

            {hasImage && (
              <>
                <div className="h-6 w-px bg-gray-300 mx-2"></div>
                <div className="flex items-center gap-2">
                  <button onClick={undo} disabled={!canUndo} className={`p-2 rounded-md transition-colors ${canUndo ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300 cursor-not-allowed'}`} title="Hoàn tác"><Undo size={18} /></button>
                  <button onClick={redo} disabled={!canRedo} className={`p-2 rounded-md transition-colors ${canRedo ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300 cursor-not-allowed'}`} title="Làm lại"><Redo size={18} /></button>
                </div>

                <div className="h-6 w-px bg-gray-300 mx-2"></div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Mở rộng:</span>
                  <button onClick={() => expandCanvas('top')} className="p-2 hover:bg-gray-100 rounded-md" title="Mở rộng lên trên"><ArrowUp size={18} /></button>
                  <button onClick={() => expandCanvas('bottom')} className="p-2 hover:bg-gray-100 rounded-md" title="Mở rộng xuống dưới"><ArrowDown size={18} /></button>
                  <button onClick={() => expandCanvas('left')} className="p-2 hover:bg-gray-100 rounded-md" title="Mở rộng sang trái"><ArrowLeft size={18} /></button>
                  <button onClick={() => expandCanvas('right')} className="p-2 hover:bg-gray-100 rounded-md" title="Mở rộng sang phải"><ArrowRight size={18} /></button>
                </div>
                
                <div className="h-6 w-px bg-gray-300 mx-2"></div>
                <div className="flex items-center gap-3">
                  <Eraser size={18} className="text-gray-600" />
                  <span className="text-sm font-medium text-gray-600">Cọ vẽ mặt nạ:</span>
                  <input 
                    type="range" 
                    min="10" 
                    max="200" 
                    value={brushSize} 
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-24 accent-blue-600"
                  />
                  <span className="text-xs text-gray-500 w-8">{brushSize}px</span>
                </div>
              </>
            )}
          </div>

          <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-gray-200 relative checkerboard-bg">
            {!hasImage ? (
              <div className="text-center text-gray-400 flex flex-col items-center">
                <ImageIcon size={48} className="mb-4 opacity-50" />
                <p>Tải một bức ảnh lên để bắt đầu</p>
              </div>
            ) : (
              <div className="relative shadow-2xl rounded-sm overflow-hidden border border-gray-300 bg-white/50 inline-block">
                <canvas
                  ref={imageCanvasRef}
                  className="max-w-full max-h-[70vh] w-auto h-auto block"
                />
                <canvas
                  ref={maskCanvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="absolute top-0 left-0 w-full h-full cursor-crosshair touch-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Controls & Result */}
        <div className="w-full lg:w-96 bg-white flex flex-col overflow-y-auto">
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Cài đặt tạo ảnh</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Độ phân giải</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['1K', '2K', '4K'].map((res) => (
                      <button
                        key={res}
                        onClick={() => setResolution(res)}
                        className={`py-2 text-sm font-medium rounded-lg border transition-colors ${
                          resolution === res 
                            ? 'bg-blue-50 border-blue-600 text-blue-700' 
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả mong muốn (Prompt)</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm"
                    placeholder="Mô tả những gì bạn muốn thêm vào vùng trong suốt..."
                  />
                  <div className="mt-2 flex items-center">
                    <input
                      type="checkbox"
                      id="keepOriginalStyle"
                      checked={keepOriginalStyle}
                      onChange={(e) => setKeepOriginalStyle(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="keepOriginalStyle" className="ml-2 text-sm font-medium text-gray-700">
                      Giữ nguyên phong cách gốc (Chỉ thêm chi tiết)
                    </label>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={!hasImage || isGenerating}
                  className={`w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                    !hasImage || isGenerating
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Đang tạo...
                    </>
                  ) : (
                    <>
                      <ImageIcon size={18} />
                      Tạo ảnh
                    </>
                  )}
                </button>
                
                {error && (
                  <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 break-words">
                    {error}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Kết quả</h3>
              {resultImage ? (
                <div className="space-y-3">
                  <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                    <img src={resultImage} alt="Generated result" className="w-full h-auto" />
                  </div>
                  <a
                    href={resultImage}
                    download="expanded-image.png"
                    className="w-full py-2 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download size={18} />
                    Tải ảnh xuống
                  </a>
                </div>
              ) : (
                <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 text-gray-400">
                  <p className="text-sm">Ảnh được tạo sẽ xuất hiện ở đây</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
