"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Decode } from "./Decode";
import { playSamaritanDialogSequence, playSamaritanDismiss } from "../../lib/samaritanAudio";

export interface SamDialogProps {
  isOpen: boolean;
  onClose: () => void;
  directiveTag?: string;
  statusTag?: string;
  title?: string | ReactNode;
  subtitle?: string | ReactNode;
  maxWidth?: string;
  children: ReactNode;
  footer?: ReactNode;
  hideHeader?: boolean;
  closeOnBackdrop?: boolean;
}

/**
 * SamDialog
 * Reusable Samaritan Dialog implementing the canonical Person of Interest UI sequence:
 * 1. Center hairline outward expansion & vertical aperture unfold
 * 2. Stepped L-bracket reticle lock-on
 * 3. 1px phosphor laser scanline pass
 * 4. Synthesized optical reticle audio telemetry chirp
 * 5. Surveillance directive banner with inverted triangle (▼)
 */
export default function SamDialog({
  isOpen,
  onClose,
  directiveTag = "SYS.DIRECTIVE",
  statusTag = "TARGET_ACQUIRED",
  title,
  subtitle,
  maxWidth = "max-w-4xl",
  children,
  footer,
  hideHeader = false,
  closeOnBackdrop = true,
}: SamDialogProps) {
  const hasPlayedAudioRef = useRef(false);

  const handleClose = () => {
    playSamaritanDismiss(0.9);
    onClose();
  };

  useEffect(() => {
    if (isOpen && !hasPlayedAudioRef.current) {
      playSamaritanDialogSequence(1.0);
      hasPlayedAudioRef.current = true;
    } else if (!isOpen) {
      hasPlayedAudioRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={closeOnBackdrop ? handleClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`samaritan-card sam-dialog-aperture relative my-8 w-full ${maxWidth} overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Single Phosphor Laser Scanline Sweep */}
        <div className="sam-scanline-beam" aria-hidden="true" />

        {!hideHeader && (
          <>
            {/* Surveillance Directive Banner */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950 px-4 py-2 font-mono text-[10px] tracking-wider select-none">
              <div className="flex items-center gap-2">
                <span className="text-red-500 text-xs animate-pulse leading-none" aria-hidden="true">
                  ▼
                </span>
                <span className="text-zinc-500 uppercase">{"/// SYS.DIRECTIVE //"}</span>
                <span className="font-bold uppercase text-white">{directiveTag}</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" aria-hidden="true" />
                <span className="font-mono">[{statusTag}]</span>
              </div>
            </div>

            {/* Header Content Bar */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/95 backdrop-blur px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-white">
                  <span className="text-sm font-mono font-bold text-red-500">▼</span>
                </div>
                <div>
                  {typeof title === "string" ? (
                    <h2 className="text-lg font-bold text-white tracking-wide">
                      <Decode value={title} trigger="mount" />
                    </h2>
                  ) : (
                    title
                  )}
                  {subtitle && (
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">{subtitle}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </>
        )}

        {/* Dialog Body Content */}
        <div className="space-y-6 p-6">{children}</div>

        {/* Optional Footer */}
        {footer && (
          <div className="sticky bottom-0 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
