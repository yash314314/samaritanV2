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

/** Queues `payload` for `ownerId`, the account it was recorded under (null when unknown). */
function enqueue(payload, ownerId = null) {
  const entry = { ...payload, ownerId };
  const list = items();
  const index = list.findIndex((queued) => queued.id && queued.id === entry.id);
  // The same session is sent repeatedly as it grows; keep only its latest state.
  if (index !== -1) list[index] = entry;
  else list.push(entry);
  if (list.length > MAX_ITEMS) list.splice(0, list.length - MAX_ITEMS);
  store.set("items", list);
}

/**
 * Sends, oldest first, the queued payloads that belong to `ownerId` (or to no
 * known account) with `send`, which resolves "sent" (drop it), "rejected" (the
 * server refused it for good; drop it) or "retry" (stop and keep the rest).
 * Another account's activity stays queued until that account signs in again.
 * Concurrent calls share one pass.
 */
function flush(send, ownerId) {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    const deliverable = (entry) => !entry.ownerId || entry.ownerId === ownerId;
    for (;;) {
      const next = items().find(deliverable);
      if (!next || !ownerId) break;
      const { ownerId: _owner, ...payload } = next;
      const outcome = await send(payload).catch(() => "retry");
      if (outcome === "retry") break;
      const remaining = items();
      const index = remaining.findIndex((entry) => entry.id === next.id && deliverable(entry));
      if (index !== -1) remaining.splice(index, 1);
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
