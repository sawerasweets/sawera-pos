import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, RefreshCw, Zap, ZapOff, Check, AlertCircle, Volume2 } from 'lucide-react';
import { playBeep } from '../utils/audio';

export function CameraBarcodeModal({ isOpen, onClose, onScan, title = "Barcode Scanner / بارکوڈ سکینر", allowContinuous = false }) {
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [continuous, setContinuous] = useState(allowContinuous);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const scannerRef = useRef(null);
  const isCooldownRef = useRef(false);

  // Initialize and list cameras
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function initCameras() {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back/environment camera
          const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment'));
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setErrorMessage('No camera found on this device.');
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Error fetching cameras:', err);
        setErrorMessage('Camera access permission denied or camera unavailable. Please check browser permissions.');
      }
    }

    initCameras();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  // Start scanner when camera is selected
  useEffect(() => {
    if (!isOpen || !selectedCameraId) return;

    startScanner(selectedCameraId);

    return () => {
      stopScanner();
    };
  }, [isOpen, selectedCameraId]);

  const startScanner = async (cameraId) => {
    try {
      await stopScanner();

      const readerElement = document.getElementById('camera-barcode-reader');
      if (!readerElement) return;

      const formats = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE
      ];

      const html5QrCode = new Html5Qrcode('camera-barcode-reader', {
        formatsToSupport: formats,
        verbose: false
      });
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        cameraId,
        {
          fps: 12,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.333
        },
        (decodedText) => {
          handleDetectedCode(decodedText);
        },
        (ignoreErrorMessage) => {
          // Frame by frame detection noise, intentionally ignored
        }
      );

      setIsScanning(true);
      setErrorMessage('');

      // Check torch capability
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities?.();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      } catch (e) {
        setHasTorch(false);
      }

    } catch (err) {
      console.error('Failed to start camera scanner:', err);
      setIsScanning(false);
      setErrorMessage(err.message || 'Unable to start camera video stream.');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {
        console.warn('Scanner stop error:', e);
      }
      scannerRef.current = null;
      setIsScanning(false);
    }
  };

  const handleDetectedCode = (code) => {
    if (!code || isCooldownRef.current) return;

    // Cooldown debouncing for continuous mode
    isCooldownRef.current = true;
    setLastScanned(code);

    // Audio & vibration feedback
    playBeep();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(80);
    }

    // Callback to parent
    if (onScan) {
      onScan(code.trim());
    }

    if (!continuous) {
      // Single scan mode: close modal after brief visual indicator
      setTimeout(() => {
        stopScanner();
        onClose();
        isCooldownRef.current = false;
      }, 400);
    } else {
      // Continuous mode: cool down for 1.4 seconds before scanning next item
      setTimeout(() => {
        isCooldownRef.current = false;
        setLastScanned(null);
      }, 1400);
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }]
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIdx = cameras.findIndex(c => c.id === selectedCameraId);
    const nextIdx = (currentIdx + 1) % cameras.length;
    setSelectedCameraId(cameras[nextIdx].id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col text-white">
        
        {/* Header */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">{title}</h3>
              <p className="text-[10px] text-slate-400">EAN-13, EAN-8, UPC, Code 128, Code 39</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-xl transition ${torchOn ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                title="Toggle Flashlight"
              >
                {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            {cameras.length > 1 && (
              <button
                type="button"
                onClick={switchCamera}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                title="Switch Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                stopScanner();
                onClose();
              }}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Scanner Container */}
        <div className="relative bg-black flex items-center justify-center min-h-[300px] overflow-hidden">
          
          <div id="camera-barcode-reader" className="w-full h-full max-h-[360px]" />

          {/* Aiming Reticle Overlay */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <div className="relative w-64 h-36 border-2 border-amber-400/80 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-center justify-center">
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

              {/* Laser animation */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse" />
            </div>
            <p className="mt-3 text-[11px] font-bold text-amber-200/90 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
              Align barcode inside frame / بارکوڈ فریم کے اندر رکھیں
            </p>
          </div>

          {/* Scanned Feedback Pill */}
          {lastScanned && (
            <div className="absolute top-4 bg-emerald-600 text-white font-mono font-bold text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
              <Check className="w-4 h-4" />
              <span>Scanned: {lastScanned}</span>
            </div>
          )}

          {/* Error notice */}
          {errorMessage && (
            <div className="absolute inset-x-4 bg-rose-900/90 border border-rose-700 text-rose-100 p-4 rounded-2xl text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
              <div>
                <p className="font-bold">Camera Scanner Notice</p>
                <p className="text-[11px] text-rose-200 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs">
          <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer select-none text-slate-300">
            <input
              type="checkbox"
              checked={continuous}
              onChange={(e) => setContinuous(e.target.checked)}
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
            />
            <span className="font-semibold text-xs">Continuous Scan Mode (مسلسل سکین)</span>
          </label>

          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
