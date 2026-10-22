// Server-safe half of lib/motion.ts: app/layout.tsx (a server component)
// renders this script into <head>.

// Set on <html> before first paint so the prerendered page stays hidden until
// hydration can play the route entry sequence over it (components/sam/
// RouteStage.tsx removes it). The script gives up after 1.5 s, so a slow or
// failed hydration never leaves the page hidden.
export const BOOT_ATTRIBUTE = "data-sam-boot";

export function bootScript() {
  return `(function(){try{var d=document.documentElement;if(matchMedia("(prefers-reduced-motion: reduce)").matches||/^\\/widget/.test(location.pathname))return;d.setAttribute("${BOOT_ATTRIBUTE}","");setTimeout(function(){d.removeAttribute("${BOOT_ATTRIBUTE}")},1500);}catch(e){}})();`;
}
