import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useTranslation } from 'react-i18next';

/** Camera QR scanner: native BarcodeDetector when available, jsQR otherwise. */
export function Scanner({ onResult, onError }: { onResult: (text: string) => void; onError?: (msg: string) => void }) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const Detector = (window as any).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setReady(true);
        loop();
      } catch {
        onError?.(t('m.counter.noCamera'));
      }
    }

    async function loop() {
      if (stopped || done.current || !video.current) return;
      const v = video.current;
      if (v.readyState >= 2) {
        let text: string | null = null;
        if (detector) {
          const codes = await detector.detect(v).catch(() => []);
          text = codes[0]?.rawValue ?? null;
        } else if (canvas.current) {
          const c = canvas.current;
          const w = (c.width = Math.min(640, v.videoWidth));
          const h = (c.height = Math.round((v.videoHeight / v.videoWidth) * w));
          const ctx = c.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(v, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          text = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null;
        }
        if (text) {
          done.current = true;
          navigator.vibrate?.(40);
          onResult(text);
          return;
        }
      }
      raf = window.setTimeout(loop, 200);
    }

    start();
    return () => {
      stopped = true;
      clearTimeout(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [onResult, onError, t]);

  return (
    <div className="relative aspect-square w-full max-w-sm mx-auto rounded-[24px] overflow-hidden bg-ink">
      <video ref={video} playsInline muted className="w-full h-full object-cover" />
      <canvas ref={canvas} className="hidden" />
      <div className="absolute inset-8 border-[3px] border-white/80 rounded-[20px] pointer-events-none" />
      {!ready && <div className="absolute inset-0 grid place-items-center text-white/70 text-sm">{t('m.counter.startingCamera')}</div>}
    </div>
  );
}
