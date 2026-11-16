import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PrintPortalProps {
  active: boolean;
  children: React.ReactNode;
}

/**
 * Mounts print-only document markup directly on document.body outside all
 * fixed/overflow-hidden/transformed SPA containers so Chrome print preview
 * renders crisp multi-page A4 documents instead of a blank or clipped frame.
 */
export const PrintPortal: React.FC<PrintPortalProps> = ({ active, children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    document.body.classList.add('has-erp-print-portal');
    return () => {
      document.body.classList.remove('has-erp-print-portal');
    };
  }, [active]);

  if (!mounted || !active || typeof document === 'undefined') return null;

  return createPortal(
    <div id="erp-print-portal" className="hidden print:block bg-white text-black">
      {children}
    </div>,
    document.body
  );
};

/**
 * Ensures React state updates, fonts, and images (e.g. QR codes, logos)
 * have committed and painted before invoking window.print().
 */
export async function triggerSafeWindowPrint(imageUrls: string[] = []): Promise<void> {
  if (typeof window === 'undefined') return;

  const validUrls = imageUrls.filter(Boolean);
  if (validUrls.length > 0) {
    await Promise.race([
      Promise.all(
        validUrls.map(
          src =>
            new Promise<void>(resolve => {
              const img = new Image();
              img.onload = () => {
                if (typeof img.decode === 'function') {
                  img.decode().catch(() => {}).finally(() => resolve());
                } else {
                  resolve();
                }
              };
              img.onerror = () => resolve();
              img.src = src;
            })
        )
      ),
      new Promise<void>(resolve => setTimeout(resolve, 600))
    ]);
  }

  if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
    await Promise.race([
      (document as any).fonts.ready.catch(() => {}),
      new Promise<void>(resolve => setTimeout(resolve, 250))
    ]);
  }

  await new Promise<void>(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });

  window.print();
}
