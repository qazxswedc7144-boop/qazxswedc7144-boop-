import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Check, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CameraModuleProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64: string) => void;
}

export const CameraModule: React.FC<CameraModuleProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error("Camera access error:", err);
      setError("تعذر الوصول إلى الكاميرا. يرجى التأكد من منح الأذونات.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCapturedImage(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg');
        setCapturedImage(base64);
      }
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] bg-black flex flex-col font-['Cairo']">
          <div className="p-4 flex justify-between items-center bg-slate-900/50 backdrop-blur-md border-b border-white/10">
            <h3 className="text-white font-bold text-sm">تصوير مستند</h3>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 relative flex items-center justify-center overflow-hidden p-4">
            {!capturedImage ? (
              <div className="relative w-full max-w-md aspect-[3/4] border-4 border-[#1E4D4D] rounded-2xl overflow-hidden shadow-2xl">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                {error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
                    <p className="text-red-400 text-sm font-bold">{error}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative w-full max-w-md aspect-[3/4] border-4 border-[#1E4D4D] rounded-2xl overflow-hidden shadow-2xl">
                <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
              </div>
            )}
          </div>

          <div className="p-8 bg-slate-900/50 backdrop-blur-md flex justify-center items-center gap-8 border-t border-white/10">
            {!capturedImage ? (
              <button 
                onClick={capturePhoto}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform"
              >
                <div className="w-16 h-16 rounded-full bg-white" />
              </button>
            ) : (
              <>
                <button 
                  onClick={() => setCapturedImage(null)}
                  className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                  <RefreshCw size={28} />
                </button>
                <button 
                  onClick={handleConfirm}
                  className="w-20 h-20 rounded-full bg-[#10B981] flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
                >
                  <Check size={40} />
                </button>
              </>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </AnimatePresence>
  );
};
