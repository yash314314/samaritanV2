"use client";

import { useState } from "react";
import { Star, CheckCircle, Sparkles, X, MessageSquare } from "lucide-react";
import { ratingsApi } from "@/lib/api";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative text-slate-100 font-sans">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-full mb-3 border border-emerald-500/30">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-100">Reflection Logged!</h3>
            <p className="text-xs text-slate-400 mt-1">Great job keeping your focus history clean.</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" /> Focus Self-Reflection
            </div>

            <h3 className="text-xl font-extrabold text-white">How productive was your session?</h3>
            <p className="text-xs text-slate-400 mt-1 mb-5">
              Reflect on your focus quality to train your productivity baseline.
            </p>

            {/* 1-5 Star Selection */}
            <div className="flex items-center justify-center gap-2 mb-6 py-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1.5 transition-transform hover:scale-125 focus:outline-none"
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      star <= (hoverRating || rating)
                        ? "text-amber-400 fill-amber-400 shadow-sm"
                        : "text-slate-700 fill-slate-800"
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Accomplishment Tag Pills */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                What did you focus on?
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ACCOMPLISHMENT_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      selectedTags.includes(tag)
                        ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm"
                        : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Reflection Note */}
            <div className="mb-6">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Accomplishment Note (Optional)
              </label>
              <div className="relative">
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Fixed state synchronization bug in WebSocket handler..."
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 resize-none"
                />
              </div>
            </div>

            {/* Submit Action */}
            <button
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
            >
              {isSubmitting ? "Logging Reflection..." : "Save Reflection"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
