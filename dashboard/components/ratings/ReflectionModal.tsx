"use client";

import { useState, useEffect } from "react";
import { Star, CheckCircle, Sparkles, X } from "lucide-react";
import { ratingsApi } from "@/lib/api";
import { playSamaritanDialogSequence, playSamaritanDismiss } from "@/lib/samaritanAudio";

interface ReflectionModalProps {
  isOpen: boolean;
  deepWorkId?: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
}

const ACCOMPLISHMENT_TAGS = [
  "Shipped Feature",
  "Fixed Bug",
  "Code Review",
  "Documentation",
  "Design / Spec",
  "Deep Reading",
  "Felt Distracted",
  "Flow State",
];

export default function ReflectionModal({
  isOpen,
  deepWorkId,
  onClose,
  onSubmitted,
}: ReflectionModalProps) {
  const [rating, setRating] = useState<number>(4);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>(["Flow State"]);
  const [note, setNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    playSamaritanDialogSequence(1.0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playSamaritanDismiss(0.9);
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const fullNote = selectedTags.length
        ? `[${selectedTags.join(", ")}] ${note}`.trim()
        : note.trim();

      await ratingsApi.createRating({
        rating,
        deepWorkId: deepWorkId || undefined,
        note: fullNote || undefined,
      });

      setSubmitted(true);
      setTimeout(() => {
        onSubmitted?.();
        onClose();
      }, 1200);
    } catch (e) {
      console.error("Failed to submit reflection rating:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="samaritan-card sam-dialog-aperture relative w-full max-w-md overflow-hidden border border-zinc-800 bg-zinc-950 font-sans text-zinc-100">
        {/* Single Phosphor Laser Scanline Sweep */}
        <div className="sam-scanline-beam" aria-hidden="true" />

        {/* Surveillance Directive Banner */}
        <div className="flex shrink-0 select-none items-center justify-between border-b border-zinc-800/80 bg-zinc-950 px-4 py-2 font-mono text-[10px] tracking-wider">
          <div className="flex items-center gap-2">
            <span className="text-xs leading-none text-red-500 animate-pulse" aria-hidden="true">
              ▼
            </span>
            <span className="uppercase text-zinc-500">{"/// SYS.DIRECTIVE //"}</span>
            <span className="font-bold uppercase text-white">EVAL.REFLECTION</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" aria-hidden="true" />
            <span className="font-mono">[SELF_AUDIT]</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="absolute right-3 top-8 z-20 rounded-none p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 rounded-none border border-red-500/30 bg-red-500/10 p-3 text-red-500">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="font-mono text-base font-bold uppercase text-white">Reflection Logged</h3>
              <p className="mt-1 text-xs text-zinc-400">Baseline evaluation synced with Samaritan core.</p>
            </div>
          ) : (
            <div>
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider text-red-500">
                <Sparkles className="h-3.5 w-3.5" /> Session Assessment
              </div>

              <h3 className="font-mono text-lg font-bold uppercase tracking-tight text-white">Focus Quality Index</h3>
              <p className="mb-5 mt-1 text-xs text-zinc-400">
                Evaluate your focus efficiency to update behavioral baselines.
              </p>

              {/* 1-5 Star Selection */}
              <div className="mb-5 flex items-center justify-center gap-2 rounded-none border border-zinc-800 bg-zinc-900/60 py-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1.5 transition-transform hover:scale-125 focus:outline-none"
                  >
                    <Star
                      className={`h-7 w-7 transition-colors ${
                        star <= (hoverRating || rating)
                          ? "fill-red-500 text-red-500"
                          : "fill-zinc-900 text-zinc-700"
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Accomplishment Tag Pills */}
              <div className="mb-4">
                <label className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Target Vector Focus
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ACCOMPLISHMENT_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-none border px-2.5 py-1 text-xs font-mono transition-all ${
                        selectedTags.includes(tag)
                          ? "border-red-500/40 bg-red-500/15 text-white"
                          : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reflection Note */}
              <div className="mb-6">
                <label className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Debrief Telemetry (Optional)
                </label>
                <div className="relative">
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Completed module refactor, eliminated race condition..."
                    className="w-full resize-none rounded-none border border-zinc-800 bg-zinc-900/80 p-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-red-500/60 focus:outline-none"
                  />
                </div>
              </div>

              {/* Submit Action */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="sam-button w-full justify-center py-2.5"
                data-variant="primary"
              >
                {isSubmitting ? "Logging Telemetry..." : "Save Reflection"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
