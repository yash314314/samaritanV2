// Activity the API has not accepted yet: the server was unreachable, the
// device was signed out, or the server failed. Kept on disk so a restart or a
// sign-in gap loses nothing, and replayed oldest first. Replays are safe to
// repeat: every activity carries its own id and the API upserts by it.
const Store = require("electron-store");

const store = new Store({ name: "activity-outbox" });
// About three days of continuous tracking; beyond that the oldest entries go.
const MAX_ITEMS = 5000;

let flushing = null;

function items() {
  const list = store.get("items");
  return Array.isArray(list) ? list : [];
}

function enqueue(payload) {
  const list = items();
  const index = list.findIndex((entry) => entry.id && entry.id === payload.id);
  // The same session is sent repeatedly as it grows; keep only its latest state.
  if (index !== -1) list[index] = payload;
  else list.push(payload);
  if (list.length > MAX_ITEMS) list.splice(0, list.length - MAX_ITEMS);
  store.set("items", list);
}

/**
 * Sends queued payloads in order with `send`, which resolves "sent" (drop it),
 * "rejected" (the server refused it for good; drop it) or "retry" (stop and
 * keep the rest for later). Concurrent calls share one pass.
 */
function flush(send) {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    for (;;) {
      const list = items();
      if (list.length === 0) break;
      const outcome = await send(list[0]).catch(() => "retry");
      if (outcome === "retry") break;
      const remaining = items();
      if (remaining.length && remaining[0].id === list[0].id) remaining.shift();
      store.set("items", remaining);
      if (outcome === "sent") sent += 1;
    }
    if (sent) console.log(`[Outbox] Delivered ${sent} queued activit${sent === 1 ? "y" : "ies"}; ${items().length} left`);
    return sent;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

module.exports = { enqueue, flush, size: () => items().length };
