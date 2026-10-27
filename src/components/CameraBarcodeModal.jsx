import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, RefreshCw, Zap, ZapOff, Check, AlertCircle, Volume2, Keyboard, ShieldAlert } from 'lucide-react';
import { playBeep } from '../utils/audio';

export function CameraBarcodeModal({
  isOpen,
  onClose,
  onScan,
  title = "Barcode Scanner / بارکوڈ سکینر",
  allowContinuous = false
}) {
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [errorType, setErrorType] = useState(''); // 'permission', 'in-use', 'no-camera', 'insecure', 'general'
  const [continuous, setContinuous] = useState(allowContinuous);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const scannerRef = useRef(null);
  const isCooldownRef = useRef(false);
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const containerIdRef = useRef(`camera-scanner-${Math.random().toString(36).slice(2, 8)}`);

  // Parse and categorize browser camera errors into helpful bilingual messages
  const parseCameraError = (err) => {
    const errorStr = (err?.message || err?.name || String(err) || '').toLowerCase();

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      return {
        type: 'insecure',
        title: 'HTTPS Secure Context Required',
        titleUrdu: 'کیمرہ کے لیے سیکیور HTTPS کنکشن لازمی ہے',
        message: 'Camera access is blocked because the page is not loaded over HTTPS. Please open https://pos.sawerasweets.store',
        messageUrdu: 'براؤزر نے کیمرہ بلاک کر دیا ہے کیونکہ ویب سائٹ سیکیور (HTTPS) پر ہونی چاہیے۔'
      };
    }

    if (errorStr.includes('notallowederror') || errorStr.includes('permission denied') || errorStr.includes('permission')) {
      return {
        type: 'permission',
        title: 'Camera Permission Denied',
        titleUrdu: 'کیمرہ کی اجازت نہیں دی گئی',
        message: 'Camera permission was denied. Please tap the lock icon in your browser address bar and enable Camera access.',
        messageUrdu: 'براؤزر کے ایڈریس بار میں لاک (Lock) کے نشان پر کلک کریں اور کیمرہ کو Allow (اجازت) کریں۔'
      };
    }

    if (errorStr.includes('notreadableerror') || errorStr.includes('trackstarterror') || errorStr.includes('device in use')) {
      return {
        type: 'in-use',
        title: 'Camera Already in Use',
        titleUrdu: 'کیمرہ کسی اور ایپ میں استعمال ہو رہا ہے',
        message: 'Your camera is being used by another app or browser tab. Please close any camera apps and try again.',
        messageUrdu: 'کیمرہ پہلے سے کسی دوسری ایپ میں چل رہا ہے۔ دیگر ایپس بند کر کے دوبارہ کوشش کریں۔'
      };
    }

    if (errorStr.includes('notfounderror') || errorStr.includes('devicesnotfounderror') || errorStr.includes('no camera')) {
      return {
        type: 'no-camera',
        title: 'No Camera Detected',
        titleUrdu: 'کیمرہ دستیاب نہیں ہے',
        message: 'No physical camera was found on this device. You can type the barcode manually below.',
        messageUrdu: 'اس موبائل پر کیمرہ نہیں مل سکا۔ آپ نیچے بارکوڈ خود لکھ سکتے ہیں۔'
      };
    }

    if (errorStr.includes('overconstrainederror') || errorStr.includes('constraint')) {
      return {
        type: 'general',
        title: 'Camera Constraints Error',
        titleUrdu: 'کیمرہ ریزولیوشن کا مسئلہ',
        message: 'The requested camera mode could not be configured. Trying fallback camera...',
        messageUrdu: 'مطلوبہ کیمرہ سیٹنگ سپورٹ نہیں ہوئی۔ متبادل کیمرہ شروع کیا جا رہا ہے۔'
      };
    }

    return {
      type: 'general',
      title: 'Camera Initialization Failed',
      titleUrdu: 'کیمرہ شروع کرنے میں مسئلہ',
      message: err?.message || 'Unable to start camera video stream. Please check permissions or type the barcode manually.',
      messageUrdu: 'ویڈیو سٹریم شروع نہیں ہو سکی۔ برائے مہربانی کیمرہ پرمیشن چیک کریں یا مینوئل کوڈ درج کریں۔'
    };
  };

  // Safe stop scanner method
  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    if (scannerRef.current) {
      try {
        const instance = scannerRef.current;
        if (instance.isScanning) {
          await instance.stop().catch(() => {});
        }
        await instance.clear().catch(() => {});
      } catch (e) {
        console.warn('Notice while stopping scanner:', e);
      } finally {
        scannerRef.current = null;
      }
    }

    setIsScanning(false);
    setIsInitializing(false);
    setTorchOn(false);
    setHasTorch(false);
    isStoppingRef.current = false;
  }, []);

  // Safe start scanner method with multi-camera fallback
  const startScanner = useCallback(async (preferredCameraId = null) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setIsInitializing(true);
    setErrorMessage('');
    setErrorDetails('');
    setErrorType('');

    try {
      await stopScanner();

      // Ensure DOM element is present
      const containerId = containerIdRef.current;
      const readerElement = document.getElementById(containerId);
      if (!readerElement) {
        isStartingRef.current = false;
        setIsInitializing(false);
        return;
      }

      // Supported retail barcode formats
      const formats = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE
      ];

      const html5QrCode = new Html5Qrcode(containerId, {
        formatsToSupport: formats,
        verbose: false
      });
      scannerRef.current = html5QrCode;

      // Config without hardcoded landscape aspectRatio to prevent OverconstrainedError on Android portrait
      const qrConfig = {
        fps: 12,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const w = Math.min(Math.floor(viewfinderWidth * 0.85), 320);
          const h = Math.min(Math.floor(viewfinderHeight * 0.5), 200);
          return { width: Math.max(w, 200), height: Math.max(h, 120) };
        }
      };

      const handleSuccess = (decodedText) => {
        handleDetectedCode(decodedText);
      };

      const handleError = () => {
        // Frame analysis noise, safely ignored
      };

      // Camera selection strategy:
      // 1. If user explicitly chose a camera from dropdown, use { deviceId: { exact: preferredCameraId } }
      // 2. Otherwise prefer mobile rear camera: { facingMode: "environment" }
      // 3. If that fails, fallback to user camera or any video device
      let started = false;

      if (preferredCameraId) {
        try {
          await html5QrCode.start(
            { deviceId: { exact: preferredCameraId } },
            qrConfig,
            handleSuccess,
            handleError
          );
          started = true;
        } catch (specErr) {
          console.warn('Starting with exact camera ID failed, trying environment facingMode:', specErr);
        }
      }

      if (!started) {
        try {
          // Primary mobile rear camera target
          await html5QrCode.start(
            { facingMode: "environment" },
            qrConfig,
            handleSuccess,
            handleError
          );
          started = true;
        } catch (envErr) {
          console.warn('Environment facingMode failed, trying user camera fallback:', envErr);
          // Fallback to front camera or any available video track
          try {
            await html5QrCode.start(
              { facingMode: "user" },
              qrConfig,
              handleSuccess,
              handleError
            );
            started = true;
          } catch (userErr) {
            console.warn('User camera fallback failed, trying default constraints:', userErr);
            // Final fallback: any device
            await html5QrCode.start(
              true,
              qrConfig,
              handleSuccess,
              handleError
            );
            started = true;
          }
        }
      }

      setIsScanning(true);
      setIsInitializing(false);
      setErrorMessage('');

      // Check flashlight capability
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities?.();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }

      // Populate camera list for switcher now that permission has been granted
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
          const activeCameraId = html5QrCode.getRunningTrackCameraId?.();
          if (activeCameraId) {
            setSelectedCameraId(activeCameraId);
          }
        }
      } catch (camListErr) {
        console.warn('Could not list cameras after start:', camListErr);
      }

    } catch (err) {
      console.error('Failed to start camera scanner:', err);
      setIsScanning(false);
      setIsInitializing(false);

      const parsed = parseCameraError(err);
      setErrorMessage(`${parsed.title} (${parsed.titleUrdu})`);
      setErrorDetails(`${parsed.message}\n${parsed.messageUrdu}`);
      setErrorType(parsed.type);
    } finally {
      isStartingRef.current = false;
    }
  }, [stopScanner]);

  // Handle open / close lifecycle
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    // Small delay to allow modal DOM animation to mount element
    const timer = setTimeout(() => {
      startScanner();
    }, 150);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, startScanner, stopScanner]);

  const handleDetectedCode = (code) => {
    if (!code || isCooldownRef.current) return;

    isCooldownRef.current = true;
    setLastScanned(code);

    // Audio beep and mobile haptic feedback
    playBeep();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([70]);
      } catch {}
    }

    if (onScan) {
      onScan(code.trim());
    }

    if (!continuous) {
      setTimeout(() => {
        stopScanner();
        onClose();
        isCooldownRef.current = false;
      }, 350);
    } else {
      setTimeout(() => {
        isCooldownRef.current = false;
        setLastScanned(null);
      }, 1500);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const code = manualCode.trim();
    setManualCode('');
    setShowManualInput(false);
    handleDetectedCode(code);
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
    const nextCam = cameras[nextIdx];
    setSelectedCameraId(nextCam.id);
    startScanner(nextCam.id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col text-white">

        {/* Header */}
        <div className="p-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">{title}</h3>
              <p className="text-[10px] text-slate-400">EAN-13, EAN-8, UPC, Code 128, Code 39</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-xl transition cursor-pointer ${torchOn ? 'bg-amber-500 text-slate-900 shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                title="Toggle Flashlight / فلیش لائٹ"
              >
                {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            {cameras.length > 1 && (
              <button
                type="button"
                onClick={switchCamera}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
                title="Switch Camera (کیمرہ تبدیل کریں)"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className={`p-2 rounded-xl transition cursor-pointer ${showManualInput ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              title="Manual Input / خود ٹائپ کریں"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                stopScanner();
                onClose();
              }}
              className="p-2 bg-slate-800 hover:bg-rose-900/40 hover:text-rose-400 text-slate-300 rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Scanner Viewport */}
        <div className="relative bg-black flex items-center justify-center min-h-[300px] max-h-[420px] overflow-hidden">
          
          <div
            id={containerIdRef.current}
            className="w-full h-full min-h-[300px] flex items-center justify-center"
          />

          {/* Aiming Reticle Overlay (Only when scanning is active) */}
          {isScanning && !errorMessage && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="relative w-64 h-36 border-2 border-amber-400/80 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-center justify-center">
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse" />
              </div>
              <p className="mt-3 text-[11px] font-bold text-amber-200/90 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
                Align barcode inside frame / بارکوڈ فریم کے اندر رکھیں
              </p>
            </div>
          )}

          {/* Initializing Spinner */}
          {isInitializing && !errorMessage && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
              <p className="text-xs font-bold text-slate-300">Starting camera / کیمرہ شروع ہو رہا ہے...</p>
            </div>
          )}

          {/* Last Scanned Feedback Pill */}
          {lastScanned && (
            <div className="absolute top-4 bg-emerald-600 text-white font-mono font-bold text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce z-10">
              <Check className="w-4 h-4" />
              <span>Scanned: {lastScanned}</span>
            </div>
          )}

          {/* Actionable Error Notice */}
          {errorMessage && (
            <div className="absolute inset-4 bg-slate-900/95 border border-rose-500/50 text-white p-5 rounded-2xl flex flex-col justify-center items-center text-center gap-3 z-10 shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-rose-300">{errorMessage}</h4>
                <p className="text-xs text-slate-300 mt-1 whitespace-pre-line leading-relaxed">{errorDetails}</p>
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => startScanner()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera / دوبارہ کوشش کریں</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualInput(true)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>Enter Code Manually</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Manual Barcode Input Drawer */}
        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              autoFocus
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Type barcode or product code (e.g. 8964000...)"
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Submit
            </button>
          </form>
        )}

        {/* Footer Controls */}
        <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs">
          <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer select-none text-slate-300">
            <input
              type="checkbox"
              checked={continuous}
              onChange={(e) => setContinuous(e.target.checked)}
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
            />
            <span className="font-semibold text-xs">Continuous Scan (مسلسل سکین)</span>
          </label>

          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition cursor-pointer"
          >
            Close / بند کریں
          </button>
        </div>

      </div>
    </div>
  );
}
