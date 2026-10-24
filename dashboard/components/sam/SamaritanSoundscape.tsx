"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  isSamaritanAmbientEnabled,
  isSamaritanInterfaceSoundEnabled,
  playSamaritanAcquire,
  playSamaritanBoot,
  playSamaritanConfirm,
  playSamaritanDataPacket,
  playSamaritanDialogSequence,
  playSamaritanDismiss,
  playSamaritanLock,
  playSamaritanPress,
  playSamaritanRatchet,
  playSamaritanRev,
  playSamaritanScanSweep,
  playSamaritanServoTick,
  playSamaritanShutdown,
  playSamaritanThreatAlert,
  playSamaritanToggle,
  playSamaritanTypeTick,
  playSamaritanVertexTick,
  setSamaritanAmbientMotion,
  startAmbient,
  stopAmbient,
  subscribeSamaritanAudioPreferences,
} from "../../lib/samaritanAudio";
import { currentUser, subscribeAuth, type RequestOutcome } from "../../lib/auth";
import { getWsClient, type WsMessage } from "../../lib/ws";

// Things the reticle can act on, and passive regions it merely passes over.
const INTERACTIVE =
  'button, a[href], input, select, textarea, summary, label[for], [role="button"], [role="tab"], [role="menuitem"], [role="menuitemradio"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"], [role="slider"], [tabindex]:not([tabindex="-1"])';
const PASSIVE = '.samaritan-card, [data-sam-target], tbody tr';
const DIALOG = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], .fixed.inset-0 > form, .fixed.inset-0 > .samaritan-card';
// Anything inside [data-sam-sound="off"] stays silent.
const SILENCED = '[data-sam-sound="off"]';
const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "password", "url", "tel", "number", ""]);

// Pointer speed (px/ms) that counts as a full-speed flick for the servo.
const FULL_SPEED = 2.4;
// Cursor travel between servo ticks, in pixels.
const TICK_DISTANCE = 220;

function elementOf(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}

function isEditable(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(element.type);
  return element instanceof HTMLElement && element.isContentEditable;
}

function pitchFor(element: Element): number {
  if (element.matches("a[href]")) return 1.08;
  if (element.matches("input, select, textarea")) return 0.92;
  if (element.matches('[role="tab"], [role="menuitem"], [role="menuitemradio"], [role="option"]')) return 1.16;
  return 1;
}

function containsDialog(node: Node): boolean {
  return node instanceof Element && (node.matches(DIALOG) || node.querySelector(DIALOG) !== null);
}

/**
 * The machine's voice. Listens to everything the interface does and answers
 * with Samaritan's synthesized sound vocabulary: servo motion under the
 * cursor, target acquisition on hover, latches and locks on press, ratchets
 * on scroll, type ticks, toggle actuators, the turbine on navigation, the
 * reticle sequence on dialogs, confirmations and threat alerts for server
 * answers, data packets for live pushes, and a low hum with an occasional
 * scan sweep while idle. Silent while muted; renders nothing.
 */
export default function SamaritanSoundscape() {
  const pathname = usePathname();
  const firstPath = useRef(true);

  // Navigation: the turbine spools up and the reticle locks onto the new view.
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    playSamaritanRev(0.5, 0.3);
    const lock = window.setTimeout(() => playSamaritanVertexTick(3, 0.5), 240);
    return () => window.clearTimeout(lock);
  }, [pathname]);

  useEffect(() => {
    let interfaceOn = isSamaritanInterfaceSoundEnabled();
    const unsubscribePrefs = subscribeSamaritanAudioPreferences(() => {
      interfaceOn = isSamaritanInterfaceSoundEnabled();
    });

    const lastAt = new Map<string, number>();
    const allow = (key: string, ms: number) => {
      const now = performance.now();
      if (now - (lastAt.get(key) ?? -Infinity) < ms) return false;
      lastAt.set(key, now);
      return true;
    };
    const silenced = (element: Element | null) => Boolean(element?.closest(SILENCED));

    // ── Cursor motion: the servo whine follows speed; travel drops ticks ──
    let lastX = 0;
    let lastY = 0;
    let lastMoveAt = 0;
    let travelled = 0;
    let smoothed = 0;
    let rest: number | undefined;
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveAt);
      const distance = lastMoveAt ? Math.hypot(event.clientX - lastX, event.clientY - lastY) : 0;
      lastX = event.clientX;
      lastY = event.clientY;
      lastMoveAt = now;
      if (dt > 250) return;
      smoothed = smoothed * 0.6 + Math.min(1, distance / dt / FULL_SPEED) * 0.4;
      if (allow("motion", 30)) setSamaritanAmbientMotion(smoothed);
      window.clearTimeout(rest);
      rest = window.setTimeout(() => {
        smoothed = 0;
        setSamaritanAmbientMotion(0);
      }, 110);
      travelled += distance;
      if (interfaceOn && travelled >= TICK_DISTANCE && allow("servo", 70)) {
        travelled = 0;
        playSamaritanServoTick(smoothed, 0.22);
      }
    };

    // ── Hover: target acquisition, once per element entered ──
    let hovered: Element | null = null;
    let hoveredPassive: Element | null = null;
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const element = elementOf(event.target);
      const target = element?.closest(INTERACTIVE) ?? null;
      if (target !== hovered) {
        hovered = target;
        if (target && interfaceOn && !silenced(target) && !(target as HTMLButtonElement).disabled && allow("acquire", 35)) {
          playSamaritanAcquire(0.28, pitchFor(target));
        }
      }
      const passive = target ? null : element?.closest(PASSIVE) ?? null;
      if (passive !== hoveredPassive) {
        hoveredPassive = passive;
        if (passive && interfaceOn && !silenced(passive) && allow("passive", 90)) playSamaritanAcquire(0.12, 0.7);
      }
    };

    // ── Press and click: the latch drops, then locks ──
    let lastPointerAt = 0;
    const onPointerDown = (event: PointerEvent) => {
      lastPointerAt = performance.now();
      const element = elementOf(event.target);
      if (!interfaceOn || silenced(element)) return;
      const target = element?.closest(INTERACTIVE);
      if (target) playSamaritanPress(0.5);
      else playSamaritanServoTick(0.15, 0.2);
    };
    const onClick = (event: MouseEvent) => {
      const element = elementOf(event.target);
      if (!interfaceOn || silenced(element)) return;
      const target = element?.closest('button, a[href], summary, [role="button"], [role="tab"], [role="menuitem"], [role="menuitemradio"], [role="option"]');
      if (target && !(target as HTMLButtonElement).disabled && allow("click", 40)) playSamaritanLock(0.3);
    };

    // ── Keyboard: decode ticks while typing, snaps while navigating ──
    const onKeyDown = (event: KeyboardEvent) => {
      if (!interfaceOn || event.metaKey || event.ctrlKey) return;
      const element = elementOf(event.target);
      if (silenced(element)) return;
      if (isEditable(element)) {
        if (event.key === "Enter" && element instanceof HTMLInputElement) {
          if (allow("enter", 120)) playSamaritanLock(0.45);
        } else if (event.key.length === 1 || event.key === "Backspace" || event.key === "Delete") {
          if (allow("type", 22)) playSamaritanTypeTick(event.key.length === 1 ? 0.55 : 0.4);
        }
        return;
      }
      if (event.key === "Tab") playSamaritanVertexTick(2, 0.45);
      else if (event.key.startsWith("Arrow")) {
        if (allow("arrow", 45)) playSamaritanVertexTick(1, 0.35);
      } else if (event.key === "Escape") playSamaritanDismiss(0.5);
      else if (event.key.length === 1 && event.key !== " " && allow("type", 22)) playSamaritanTypeTick(0.3);
    };

    // Keyboard focus moves the reticle too; pointer focus already chirped on hover.
    const onFocusIn = (event: FocusEvent) => {
      if (!interfaceOn || performance.now() - lastPointerAt < 400) return;
      const element = elementOf(event.target);
      if (element && !silenced(element) && allow("focus", 40)) playSamaritanAcquire(0.22, 1.15);
    };

    // ── Form controls: actuators, selectors, sliders ──
    const onChange = (event: Event) => {
      const element = elementOf(event.target);
      if (!interfaceOn || silenced(element)) return;
      if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
        playSamaritanToggle(element.checked);
      } else if (element instanceof HTMLSelectElement) {
        playSamaritanLock(0.35);
      } else if (element instanceof HTMLInputElement && /^(date|time|datetime-local|month|week)$/.test(element.type)) {
        playSamaritanVertexTick(3, 0.4);
      }
    };
    const onInput = (event: Event) => {
      const element = elementOf(event.target);
      if (!interfaceOn || silenced(element) || !(element instanceof HTMLInputElement) || element.type !== "range") return;
      const min = Number(element.min || 0);
      const max = Number(element.max || 100);
      const position = max > min ? (Number(element.value) - min) / (max - min) : 0.5;
      if (allow("slider", 35)) playSamaritanServoTick(position, 0.35);
    };

    // ── Scroll: one ratchet tooth per step ──
    let scrolled = 0;
    const onWheel = (event: WheelEvent) => {
      if (!interfaceOn) return;
      scrolled += event.deltaY;
      if (Math.abs(scrolled) >= 90 && allow("ratchet", 60)) {
        playSamaritanRatchet(scrolled > 0 ? 1 : -1, 0.3);
        scrolled = 0;
      }
    };

    const onCopy = () => {
      if (interfaceOn) playSamaritanDataPacket(0.4);
    };

    // ── Server answers: confirmations and threat alerts ──
    const onRequest = (event: Event) => {
      const { method, path, ok, status } = (event as CustomEvent<RequestOutcome>).detail;
      if (path.startsWith("/api/auth")) {
        if (!ok && /\/(login|register|password)$/.test(path)) playSamaritanThreatAlert(0.7);
        return;
      }
      if (method !== "GET") {
        if (ok) playSamaritanConfirm(0.55);
        else if (status >= 400) playSamaritanThreatAlert(0.8);
      } else if (!ok && (status >= 500 || status === 0) && allow("fetch-error", 5000)) {
        playSamaritanThreatAlert(0.5);
      }
    };

    // ── Live pushes from the server ──
    const offWs = getWsClient().on("*", (message: WsMessage) => {
      switch (message.type) {
        case "intervention:triggered":
          playSamaritanThreatAlert(0.9);
          break;
        case "deepwork:started":
          playSamaritanRev(0.8, 0.45);
          window.setTimeout(() => playSamaritanLock(0.9), 300);
          break;
        case "deepwork:ended":
        case "deepwork:expired":
          playSamaritanDismiss(0.7);
          break;
        case "calendar:reminder.due":
          playSamaritanScanSweep(0.5);
          window.setTimeout(() => playSamaritanLock(0.6), 600);
          break;
        case "pong":
        case "connection:established":
        case "auth:renewed":
          break;
        default:
          if (allow("packet", 3500)) playSamaritanDataPacket(0.22);
      }
    });

    // ── Dialogs: the reticle unfolds on open and de-spools on close ──
    const observer = new MutationObserver((records) => {
      let opened = false;
      let closed = false;
      for (const record of records) {
        for (const node of record.addedNodes) if (!opened && containsDialog(node)) opened = true;
        for (const node of record.removedNodes) if (!closed && containsDialog(node)) closed = true;
      }
      if (opened) playSamaritanDialogSequence(0.9);
      else if (closed) playSamaritanDismiss(0.75);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // ── Sign-in brings the core online; sign-out winds it down ──
    let signedInAs = currentUser()?.id ?? null;
    const unsubscribeAuth = subscribeAuth(() => {
      const userId = currentUser()?.id ?? null;
      if (userId === signedInAs) return;
      if (userId && !signedInAs) playSamaritanBoot(0.9);
      else if (!userId && signedInAs) playSamaritanShutdown(0.8);
      signedInAs = userId;
    });

    // ── Presence: hum while visible, a scan sweep now and then ──
    let nextPulse = performance.now() + 30_000 + Math.random() * 30_000;
    const pulse = window.setInterval(() => {
      if (document.hidden || !isSamaritanAmbientEnabled()) return;
      startAmbient();
      if (performance.now() >= nextPulse) {
        nextPulse = performance.now() + 35_000 + Math.random() * 35_000;
        playSamaritanScanSweep(0.18);
      }
    }, 1000);
    const onVisibility = () => {
      if (document.hidden) {
        setSamaritanAmbientMotion(0);
        stopAmbient();
      } else if (isSamaritanAmbientEnabled()) {
        startAmbient();
        playSamaritanScanSweep(0.22);
      }
    };

    const options = { capture: true, passive: true } as const;
    document.addEventListener("pointermove", onPointerMove, options);
    document.addEventListener("pointerover", onPointerOver, options);
    document.addEventListener("pointerdown", onPointerDown, options);
    document.addEventListener("click", onClick, options);
    document.addEventListener("keydown", onKeyDown, options);
    document.addEventListener("focusin", onFocusIn, options);
    document.addEventListener("change", onChange, options);
    document.addEventListener("input", onInput, options);
    document.addEventListener("wheel", onWheel, options);
    document.addEventListener("copy", onCopy, options);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("samaritan:request", onRequest);

    return () => {
      document.removeEventListener("pointermove", onPointerMove, options);
      document.removeEventListener("pointerover", onPointerOver, options);
      document.removeEventListener("pointerdown", onPointerDown, options);
      document.removeEventListener("click", onClick, options);
      document.removeEventListener("keydown", onKeyDown, options);
      document.removeEventListener("focusin", onFocusIn, options);
      document.removeEventListener("change", onChange, options);
      document.removeEventListener("input", onInput, options);
      document.removeEventListener("wheel", onWheel, options);
      document.removeEventListener("copy", onCopy, options);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("samaritan:request", onRequest);
      window.clearTimeout(rest);
      window.clearInterval(pulse);
      observer.disconnect();
      offWs();
      unsubscribeAuth();
      unsubscribePrefs();
      stopAmbient();
    };
  }, []);

  return null;
}
