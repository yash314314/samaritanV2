"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  ROUTE_ENTRY_WINDOW_MS,
  RouteVisitContext,
  createRouteVisit,
  endBoot,
  prefersReducedMotion,
  routeVisitAge,
} from "../../lib/motion";
import { BOOT_ATTRIBUTE } from "../../lib/motionBoot";

// Panels start acquiring after the title has begun to resolve, 35 ms apart,
// and the last one starts at most 300 ms after the first.
const ACQUIRE_BASE_MS = 150;
const ACQUIRE_STEP_MS = 35;
const ACQUIRE_SPREAD_MS = 300;
// On a hard load, wait at most this long for the page title to hydrate
// before revealing the page.
const BOOT_WAIT_MS = 600;
const TAB_SLIDE_MS = 200;
const EASE = "cubic-bezier(0.2, 0, 0, 1)";
// Framed panels, and the hairline-ruled sections of the overview.
const PANEL_SELECTOR = ".samaritan-card, .sam-rule";

// Corner brackets (the panel's ::after, drawn in app/motion.css) snap in
// from 6 px outside in three steps, then lock permanently onto the frame.
const BRACKET_FRAMES: Keyframe[] = [
  { inset: "-7px", opacity: 0, offset: 0, easing: "steps(1, end)" },
  { inset: "-7px", opacity: 1, offset: 0.06, easing: "steps(3, end)" },
  { inset: "-1px", opacity: 1, offset: 0.4 },
  { inset: "-1px", opacity: 1, offset: 1 },
];

/*
 * One panel's entry, played with the Web Animations API so nothing is written
 * to React-owned DOM: a hard load may run this before React has hydrated the
 * page, and attributes added there would not match the server HTML.
 */
function acquirePanel(panel: HTMLElement, delay: number): Animation[] {
  const timing = { delay, fill: "backwards" as const };
  const animations: Animation[] = [];
  if (panel.classList.contains("sam-rule")) {
    // The rule draws left to right with a bright leading edge.
    animations.push(panel.animate([{ "--sam-draw": "0%" }, { "--sam-draw": "106%" }], { ...timing, duration: 420, easing: EASE }));
  } else {
    // The frame stays dark until the brackets land on it.
    animations.push(panel.animate([{ borderColor: "transparent", offset: 0 }, { borderColor: "transparent", offset: 0.4 }], { ...timing, duration: 340 }));
    if (!/\bmax-h-/.test(panel.className)) {
      animations.push(panel.animate(BRACKET_FRAMES, { ...timing, duration: 340, pseudoElement: "::after" }));
    }
  }
  for (const child of Array.from(panel.children)) {
    animations.push(child.animate([{ opacity: 0, offset: 0 }], { ...timing, delay: delay + 120, duration: 200 }));
  }
  return animations;
}

// Moves a hairline from the previously selected tab to the new one, then
// hands over to the tab's own underline.
function slideTab(list: Element, previous: HTMLElement) {
  const from = previous.getBoundingClientRect();
  const fromStyle = getComputedStyle(previous);
  requestAnimationFrame(() => {
    const current = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!current || current === previous) return;
    const style = getComputedStyle(current);
    const border = parseFloat(style.borderBottomWidth) || 0;
    const underlined = style.textDecorationLine.includes("underline");
    if (!border && !underlined) return;

    const measure = (tab: HTMLElement, tabStyle: CSSStyleDeclaration, rect: DOMRect) => {
      if (border) return { left: rect.left, top: rect.bottom - border, width: rect.width };
      const range = document.createRange();
      range.selectNodeContents(tab);
      const text = range.getBoundingClientRect();
      const offset = parseFloat(tabStyle.textUnderlineOffset) || 2;
      return { left: text.left, top: text.bottom + offset - 2, width: text.width };
    };
    const start = measure(previous, fromStyle, from);
    const end = measure(current, style, current.getBoundingClientRect());

    const line = document.createElement("div");
    line.className = "sam-tab-slider";
    line.style.height = `${border || 1}px`;
    line.style.background = border ? style.borderBottomColor : style.color;
    document.body.appendChild(line);
    current.setAttribute("data-sam-tab-arriving", "");
    const animation = line.animate(
      [
        { left: `${start.left}px`, top: `${start.top}px`, width: `${start.width}px` },
        { left: `${end.left}px`, top: `${end.top}px`, width: `${end.width}px` },
      ],
      { duration: TAB_SLIDE_MS, easing: EASE, fill: "forwards" }
    );
    const done = () => {
      line.remove();
      current.removeAttribute("data-sam-tab-arriving");
    };
    animation.onfinish = done;
    animation.oncancel = done;
  });
}

// Wipes the fill across a segmented option the moment it is chosen.
function wipeSegment(segment: Element, previous: Element | null) {
  requestAnimationFrame(() => {
    const current = segment.querySelector<HTMLElement>(':scope > button:is([aria-pressed="true"], [aria-selected="true"])');
    if (!current || current === previous) return;
    current.setAttribute("data-sam-wipe", "");
    const done = () => current.removeAttribute("data-sam-wipe");
    current.addEventListener("animationend", done, { once: true });
    window.setTimeout(done, 400);
  });
}

/*
 * Wraps the routed page. On every route change it plays the entry sequence:
 * panels (.samaritan-card, .sam-rule sections) present when the route mounts,
 * or mounted while it is still entering, "acquire" one after another: corner
 * brackets lock onto a frame and its hairline appears, or a rule draws left to
 * right, and the contents fade in. Each panel plays once per visit, so later
 * re-renders and data refreshes never replay it. Also drives the tab and
 * segment feedback.
 */
export default function RouteStage({ className = "", children }: { className?: string; children: ReactNode }) {
  const pathname = usePathname() || "/";
  const visit = useMemo(() => createRouteVisit(pathname), [pathname]);
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const age = routeVisitAge(visit);
    if (prefersReducedMotion() || age > ROUTE_ENTRY_WINDOW_MS) {
      endBoot();
      return;
    }

    const seen = new WeakSet<Element>();
    const running = new Set<Animation>();
    let observer: MutationObserver | null = null;
    let windowTimer = 0;
    let bootFrame = 0;
    let closed = false;

    const acquire = (base: number) => {
      let index = 0;
      root.querySelectorAll<HTMLElement>(PANEL_SELECTOR).forEach((panel) => {
        if (seen.has(panel)) return;
        seen.add(panel);
        // Modal panels have their own entrance; nested panels ride along
        // with their parent.
        if (panel.closest('.fixed, [role="dialog"]')) return;
        const parent = panel.parentElement?.closest(PANEL_SELECTOR);
        if (parent && root.contains(parent)) return;
        const delay = base + Math.min(index * ACQUIRE_STEP_MS, ACQUIRE_SPREAD_MS);
        index += 1;
        for (const animation of acquirePanel(panel, delay)) {
          running.add(animation);
          animation.finished.then(
            () => settle(animation),
            () => settle(animation)
          );
        }
      });
    };

    // The entering state (which gives panels their bracket layer) ends once
    // the window has closed and the last panel has landed.
    const settle = (animation: Animation) => {
      running.delete(animation);
      if (closed && running.size === 0) root.removeAttribute("data-sam-entering");
    };

    const begin = () => {
      acquire(ACQUIRE_BASE_MS);
      endBoot();
      observer = new MutationObserver(() => acquire(0));
      observer.observe(root, { childList: true, subtree: true });
      windowTimer = window.setTimeout(() => {
        closed = true;
        observer?.disconnect();
        if (running.size === 0) root.removeAttribute("data-sam-entering");
      }, Math.max(0, ROUTE_ENTRY_WINDOW_MS - age));
    };

    root.setAttribute("data-sam-entering", "");
    // A hard load hydrates the page after this component; keep the boot
    // cover on until the title can decode, so it never flashes in full.
    const titlePending = () => !!root.querySelector("h1 .sam-decode:not([data-hydrated])");
    if (document.documentElement.hasAttribute(BOOT_ATTRIBUTE) && titlePending()) {
      const waitFrom = performance.now();
      const wait = () => {
        if (titlePending() && performance.now() - waitFrom < BOOT_WAIT_MS) {
          bootFrame = requestAnimationFrame(wait);
          return;
        }
        begin();
      };
      bootFrame = requestAnimationFrame(wait);
    } else {
      begin();
    }

    return () => {
      cancelAnimationFrame(bootFrame);
      window.clearTimeout(windowTimer);
      observer?.disconnect();
      running.forEach((animation) => animation.cancel());
      running.clear();
      root.removeAttribute("data-sam-entering");
    };
  }, [visit]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    // Capture phase: the previous selection is read before React handles the
    // click and moves it.
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const option = target?.closest("button, [role='tab']");
      if (!option) return;
      const segment = option.parentElement?.classList.contains("sam-segment") ? option.parentElement : null;
      if (segment) {
        wipeSegment(segment, segment.querySelector(':scope > button:is([aria-pressed="true"], [aria-selected="true"])'));
        return;
      }
      if (option.getAttribute("role") !== "tab") return;
      const list = option.closest('[role="tablist"]');
      const previous = list?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (list && previous && previous !== option) slideTab(list, previous);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <RouteVisitContext.Provider value={visit}>
      <div ref={rootRef} className={`sam-route ${className}`}>
        {children}
      </div>
    </RouteVisitContext.Provider>
  );
}
