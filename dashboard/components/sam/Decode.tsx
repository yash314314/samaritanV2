"use client";

import { useLayoutEffect, useRef } from "react";
import {
  ROUTE_ENTRY_WINDOW_MS,
  prefersReducedMotion,
  randomDigit,
  randomGlyph,
  routeVisitAge,
  useRouteVisit,
} from "../../lib/motion";

/*
 * Both components keep the real text in the DOM for assistive technology and
 * draw the animation in a separate aria-hidden span that React never renders
 * into, so frames are written straight to the DOM without re-rendering.
 * Under reduced motion, or outside a route entry, they render the final text.
 */

const TYPE_CHAR_MS = 26;
const TYPE_MAX_MS = 420;
const PROMPT_CHAR_MS = 30;
const PROMPT_MAX_MS = 600;
const NOISE_WIDTH = 2;
const CURSOR_BLINK_MS = 220;

function span(className: string, text = "") {
  const node = document.createElement("span");
  node.className = className;
  node.textContent = text;
  return node;
}

function noiseFor(text: string) {
  return text.replace(/\S/g, () => randomGlyph());
}

type DecodeTextProps = {
  text: string;
  // "route": play once when the page is entered (titles). "mount": play
  // whenever the component mounts (loading prompts).
  trigger?: "route" | "mount";
  // Keep the cursor blinking after the text resolves (work in progress).
  hold?: boolean;
  // Draw Samaritan's hairline under the text while it resolves.
  underline?: boolean;
  className?: string;
};

// Text that resolves left to right behind a block cursor, which blinks twice
// once the text is complete and then disappears.
export function DecodeText({ text, trigger = "route", hold = false, underline = true, className = "" }: DecodeTextProps) {
  const visit = useRouteVisit();
  const rootRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const live = liveRef.current;
    // Tells RouteStage the title has hydrated and can be revealed.
    root?.setAttribute("data-hydrated", "");
    if (!root || !live || !text || prefersReducedMotion()) return;

    const key = `text:${text}`;
    if (trigger === "route") {
      if (routeVisitAge(visit) > ROUTE_ENTRY_WINDOW_MS || visit?.played.has(key)) return;
      visit?.played.add(key);
    }

    const total = Math.min(trigger === "route" ? TYPE_MAX_MS : PROMPT_MAX_MS, text.length * (trigger === "route" ? TYPE_CHAR_MS : PROMPT_CHAR_MS));
    const start = performance.now();
    let frame = 0;
    let finished = false;
    let fallback = 0;

    const paint = (shown: number, noise: string) => {
      live.replaceChildren(
        span("sam-decode-on", text.slice(0, shown)),
        span("sam-decode-noise", noise),
        span("sam-decode-cursor"),
        span("sam-decode-off", text.slice(shown + noise.length))
      );
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(fallback);
      root.removeAttribute("data-phase");
      live.replaceChildren();
    };

    const onAnimationEnd = (event: AnimationEvent) => {
      if (event.animationName === "sam-cursor-blink") finish();
    };

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / total);
      if (progress >= 1) {
        paint(text.length, "");
        root.setAttribute("data-phase", "cursor");
        if (hold) return;
        root.addEventListener("animationend", onAnimationEnd);
        fallback = window.setTimeout(finish, CURSOR_BLINK_MS * 2 + 120);
        return;
      }
      const shown = Math.floor(progress * text.length);
      paint(shown, noiseFor(text.slice(shown, shown + NOISE_WIDTH)));
      frame = requestAnimationFrame(tick);
    };

    root.setAttribute("data-phase", "run");
    paint(0, noiseFor(text.slice(0, NOISE_WIDTH)));
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("animationend", onAnimationEnd);
      // An interrupted entry (Strict Mode's double effect, a fast remount)
      // may play again; a finished one may not.
      if (!finished && trigger === "route") visit?.played.delete(key);
      finish();
    };
  }, [text, trigger, hold, visit]);

  return (
    <span
      ref={rootRef}
      className={`sam-decode ${className}`}
      data-underline={underline ? "" : undefined}
      data-hold={hold ? "" : undefined}
    >
      <span className="sam-decode-final">{text}</span>
      <span ref={liveRef} className="sam-decode-live" aria-hidden />
    </span>
  );
}

const SCRAMBLE_MS = 360;
const SETTLE_FROM_MS = 120;
const SCRAMBLE_FRAME_MS = 40;

type DecodeProps = {
  value: string | number | null | undefined;
  // "route": resolve when the page is entered and on every change. "mount":
  // also resolve whenever it mounts (panels that open later, like results).
  trigger?: "route" | "mount";
  className?: string;
};

// A readout value whose digits scramble and settle left to right when the
// page is entered and whenever the value changes. Letters, units and
// punctuation hold still, so the readout keeps its shape.
export function Decode({ value, trigger = "route", className = "" }: DecodeProps) {
  const text = value === null || value === undefined ? "" : String(value);
  const visit = useRouteVisit();
  const rootRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);
  const previousRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const live = liveRef.current;
    const previous = previousRef.current;
    previousRef.current = text;
    if (!root || !live || !/\d/.test(text) || prefersReducedMotion()) return;
    if (previous === null ? trigger === "route" && routeVisitAge(visit) > ROUTE_ENTRY_WINDOW_MS : previous === text) return;

    const last = Math.max(1, text.length - 1);
    const settleAt = [...text].map((_, index) => SETTLE_FROM_MS + (index / last) * (SCRAMBLE_MS - SETTLE_FROM_MS));
    const start = performance.now();
    let frame = 0;
    let lastStep = -1;
    let finished = false;

    const finish = () => {
      finished = true;
      root.removeAttribute("data-phase");
      live.textContent = "";
    };

    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= SCRAMBLE_MS) {
        finish();
        return;
      }
      const step = Math.floor(elapsed / SCRAMBLE_FRAME_MS);
      if (step !== lastStep) {
        lastStep = step;
        live.textContent = [...text]
          .map((char, index) => (elapsed < settleAt[index] && /\d/.test(char) ? randomDigit() : char))
          .join("");
      }
      frame = requestAnimationFrame(tick);
    };

    root.setAttribute("data-phase", "run");
    live.textContent = text.replace(/\d/g, () => randomDigit());
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      // Let an interrupted decode replay (Strict Mode runs effects twice).
      if (!finished) previousRef.current = previous;
      finish();
    };
  }, [text, trigger, visit]);

  return (
    <span ref={rootRef} className={`sam-decode ${className}`}>
      <span className="sam-decode-final">{text}</span>
      <span ref={liveRef} className="sam-decode-live" aria-hidden />
    </span>
  );
}
