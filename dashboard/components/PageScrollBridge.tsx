"use client";

import { useEffect } from "react";

function canScrollVertically(element: HTMLElement, deltaY: number) {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  const scrollable = overflowY === "auto" || overflowY === "scroll";

  if (!scrollable || element.scrollHeight <= element.clientHeight + 1) {
    return false;
  }

  if (deltaY > 0) {
    return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  }

  return element.scrollTop > 1;
}

function findScrollableAncestor(target: EventTarget | null, deltaY: number) {
  let node = target instanceof HTMLElement ? target : null;

  while (node && node !== document.body) {
    if (canScrollVertically(node, deltaY)) return node;
    node = node.parentElement;
  }

  return null;
}

export default function PageScrollBridge() {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [role='dialog'], [data-scroll-lock='true']")) {
        return;
      }

      if (findScrollableAncestor(event.target, event.deltaY)) {
        return;
      }

      event.preventDefault();
      window.scrollBy({ top: event.deltaY, left: 0, behavior: "auto" });
    };

    window.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    return () => window.removeEventListener("wheel", handleWheel, { capture: true });
  }, []);

  return null;
}
