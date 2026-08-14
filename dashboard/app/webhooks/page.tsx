"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Check,
  CircleAlert,
  CircleCheck,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  Webhook,
  X,
} from "lucide-react";

import { webhooksApi } from "@/lib/api";
import { useWsMessage, useWsState } from "@/lib/ws";

type Delivery = {
  id: string;
  event: string;
  status: "queued" | "delivering" | "retrying" | "delivered" | "failed";
  attemptCount: number;
  responseStatus: number | null;
  error: string | null;
  createdAt: string;
  deliveredAt: string | null;
  nextAttemptAt: string;
};

type Endpoint = {
  id: string;
  name: string;
  targetUrl: string;
  events: string[];
  active: boolean;
  lastDeliveryAt: string | null;
  createdAt: string;
  deliveries?: Array<Pick<Delivery, "status" | "deliveredAt" | "responseStatus" | "createdAt">>;
  _count?: { deliveries: number };
};

const eventLabels: Record<string, string> = {
  "activity.reviewed": "Activity reviewed",
  "focus_session.completed": "Focus completed",
  "focus_session.abandoned": "Focus abandoned",
  "break.completed": "Break completed",
  "break.skipped": "Break skipped",
  "project.changed": "Project changed",
  "goal.changed": "Goal changed",
  "calendar.event.changed": "Calendar changed",
  "distraction.blocked": "Distraction blocked",
};

const initialForm = { name: "", targetUrl: "", events: [] as string[], active: true };

function formatTime(value: string | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function StatusMark({ status }: { status: Delivery["status"] }) {
  if (status === "delivered") return <CircleCheck size={16} className="text-emerald-400" />;
  if (status === "failed") return <CircleAlert size={16} className="text-rose-400" />;
  if (status === "delivering") return <LoaderCircle size={16} className="animate-spin text-purple-400" />;
  return <Clock3 size={16} className={status === "retrying" ? "text-amber-400" : "text-zinc-500"} />;
}

export default function WebhooksPage() {
  const connection = useWsState();
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [events, setEvents] = useState<string[]>(Object.keys(eventLabels));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(true);
  const [copied, setCopied] = useState(false);

  const selected = endpoints.find((endpoint) => endpoint.id === selectedId) || null;

  const loadEndpoints = useCallback(async () => {
    const data = await webhooksApi.list() as Endpoint[];
    setEndpoints(data);
    setSelectedId((current) => current && data.some((endpoint) => endpoint.id === current) ? current : data[0]?.id || null);
  }, []);

  const loadDeliveries = useCallback(async (id: string) => {
    setDeliveries(await webhooksApi.deliveries(id) as Delivery[]);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      await loadEndpoints();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load webhooks");
    } finally {
      setLoading(false);
    }
  }, [loadEndpoints]);

  useEffect(() => {
    void refresh();
    webhooksApi.events().then((data) => setEvents((data as { events: string[] }).events)).catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setDeliveries([]);
      return;
    }
    void loadDeliveries(selectedId).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load deliveries"));
  }, [selectedId, loadDeliveries]);

  useWsMessage("webhook:changed", () => void refresh());
  useWsMessage<Delivery>("webhook:delivery", (delivery) => {
    void loadEndpoints();
    if (delivery.id && selectedId) void loadDeliveries(selectedId);
  });

  const summary = useMemo(() => ({
    active: endpoints.filter((endpoint) => endpoint.active).length,
    deliveries: endpoints.reduce((sum, endpoint) => sum + (endpoint._count?.deliveries || 0), 0),
    healthy: endpoints.filter((endpoint) => endpoint.deliveries?.[0]?.status === "delivered").length,
  }), [endpoints]);
  const summaryCards = [
    { label: "Active", value: summary.active, icon: Activity },
    { label: "Deliveries", value: summary.deliveries, icon: Send },
    { label: "Healthy", value: summary.healthy, icon: CircleCheck },
  ];

  function openCreate() {
    setEditingId(null);
    setForm({ ...initialForm, events: events.slice(0, 1) });
    setError(null);
    setShowForm(true);
  }

  function openEdit(endpoint: Endpoint) {
    setEditingId(endpoint.id);
    setForm({ name: endpoint.name, targetUrl: endpoint.targetUrl, events: endpoint.events, active: endpoint.active });
    setError(null);
    setShowForm(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.events.length) return setError("Select at least one event");
    setBusy("save");
    setError(null);
    try {
      if (editingId) {
        await webhooksApi.update(editingId, form);
      } else {
        const created = await webhooksApi.create(form) as Endpoint & { secret: string };
        setSecret(created.secret);
        setShowSecret(true);
        setSelectedId(created.id);
      }
      setShowForm(false);
      await loadEndpoints();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save endpoint");
    } finally {
      setBusy(null);
    }
  }

  async function runAction(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await action();
      await loadEndpoints();
      if (selectedId && key !== "delete") await loadDeliveries(selectedId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Webhook action failed");
    } finally {
      setBusy(null);
    }
  }

  async function copySecret() {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <div className="dashboard-page py-3">
      <div className="dashboard-surface flex h-full flex-col gap-3">
        <header className="flex shrink-0 items-center justify-between gap-4 px-1">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300">
              <Webhook size={18} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-zinc-100">Webhooks</h1>
              <p className="truncate text-xs text-zinc-500">Signed event delivery</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${connection.connected ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.7)]" : "bg-zinc-600"}`} />
            <button title="Refresh" onClick={() => void refresh()} className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition hover:border-purple-500/40 hover:text-purple-300">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={openCreate} className="flex h-9 items-center gap-2 rounded-lg bg-purple-600 px-3 text-sm font-medium text-white transition hover:bg-purple-500">
              <Plus size={16} /> New endpoint
            </button>
          </div>
        </header>

        {secret && (
          <section className="webhook-row-enter flex shrink-0 items-center gap-3 rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-2.5">
            <KeyRound size={16} className="shrink-0 text-purple-300" />
            <code className="min-w-0 flex-1 truncate text-xs text-purple-100">{showSecret ? secret : "*".repeat(48)}</code>
            <button title={showSecret ? "Hide secret" : "Show secret"} onClick={() => setShowSecret((value) => !value)} className="text-zinc-400 hover:text-white">
              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button title="Copy secret" onClick={() => void copySecret()} className="text-zinc-400 hover:text-white">
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            </button>
            <button title="Dismiss" onClick={() => setSecret(null)} className="text-zinc-400 hover:text-white"><X size={16} /></button>
          </section>
        )}

        {error && (
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            <CircleAlert size={15} /><span className="min-w-0 flex-1 truncate">{error}</span><button onClick={() => setError(null)}><X size={14} /></button>
          </div>
        )}

        <section className="samaritan-card grid min-h-0 flex-1 grid-rows-[auto_1fr]">
          <div className="grid shrink-0 grid-cols-3 border-b border-zinc-900">
            {summaryCards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 border-r border-zinc-900 px-4 py-3 last:border-r-0">
                <Icon size={16} className="text-purple-400" />
                <div><div className="text-lg font-semibold leading-none text-zinc-100">{value}</div><div className="mt-1 text-[11px] text-zinc-500">{label}</div></div>
              </div>
            ))}
          </div>

          <div className="grid min-h-0 grid-rows-2 lg:grid-cols-[minmax(260px,0.38fr)_minmax(0,0.62fr)] lg:grid-rows-1">
            <div className="flex min-h-0 flex-col border-b border-zinc-900 lg:border-b-0 lg:border-r">
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-900 px-4">
                <span className="text-xs font-medium uppercase text-zinc-500">Endpoints</span>
                <span className="text-xs tabular-nums text-zinc-600">{endpoints.length}</span>
              </div>
              <div className="dashboard-scroll-panel">
                {loading ? (
                  <div className="flex h-full items-center justify-center"><LoaderCircle className="animate-spin text-purple-400" size={22} /></div>
                ) : endpoints.length === 0 ? (
                  <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-zinc-500"><Webhook size={28} /><span className="text-sm">No endpoints</span></div>
                ) : endpoints.map((endpoint, index) => {
                  const latest = endpoint.deliveries?.[0];
                  return (
                    <button key={endpoint.id} onClick={() => setSelectedId(endpoint.id)} style={{ animationDelay: `${index * 35}ms` }} className={`webhook-row-enter flex w-full items-center gap-3 border-b border-zinc-900 px-4 py-3 text-left transition ${selectedId === endpoint.id ? "bg-purple-500/10" : "hover:bg-zinc-950"}`}>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${endpoint.active ? latest?.status === "failed" ? "bg-rose-400" : "bg-emerald-400" : "bg-zinc-700"}`} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm text-zinc-200">{endpoint.name}</span><span className="mt-0.5 block truncate text-[11px] text-zinc-600">{new URL(endpoint.targetUrl).host}</span></span>
                      <span className="text-[10px] tabular-nums text-zinc-600">{endpoint._count?.deliveries || 0}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex min-h-0 flex-col">
              {selected ? (
                <>
                  <div className="shrink-0 border-b border-zinc-900 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><h2 className="truncate text-sm font-semibold text-zinc-100">{selected.name}</h2><span className={`rounded px-1.5 py-0.5 text-[10px] ${selected.active ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>{selected.active ? "Active" : "Paused"}</span></div>
                        <p className="mt-1 truncate text-xs text-zinc-500">{selected.targetUrl}</p>
                      </div>
                      <button title="Send test" disabled={busy !== null} onClick={() => void runAction("test", () => webhooksApi.test(selected.id))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:border-purple-500/40 hover:text-purple-300 disabled:opacity-40">{busy === "test" ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}</button>
                      <button title="Edit endpoint" onClick={() => openEdit(selected)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:text-white"><Pencil size={15} /></button>
                      <button title={selected.active ? "Pause endpoint" : "Activate endpoint"} onClick={() => void runAction("toggle", () => webhooksApi.update(selected.id, { active: !selected.active }))} className={`relative h-8 w-12 rounded-full border transition ${selected.active ? "border-purple-500/50 bg-purple-500/30" : "border-zinc-700 bg-zinc-900"}`}><span className={`absolute left-1.5 top-1.5 h-4 w-4 rounded-full bg-white transition-transform ${selected.active ? "translate-x-4" : "translate-x-0"}`} /></button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">{selected.events.map((event) => <span key={event} className="rounded-md border border-purple-500/20 bg-purple-500/5 px-2 py-1 text-[10px] text-purple-300">{eventLabels[event] || event}</span>)}</div>
                  </div>

                  <div className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-900 px-4"><span className="text-xs font-medium uppercase text-zinc-500">Deliveries</span><span className="text-[11px] text-zinc-600">Last success {formatTime(selected.lastDeliveryAt)}</span></div>
                  <div className="dashboard-scroll-panel">
                    {deliveries.length === 0 ? <div className="flex h-full min-h-40 items-center justify-center text-sm text-zinc-600">No deliveries yet</div> : deliveries.map((delivery, index) => (
                      <div key={delivery.id} style={{ animationDelay: `${index * 25}ms` }} className="webhook-row-enter grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-zinc-900 px-4 py-3">
                        <StatusMark status={delivery.status} />
                        <div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-xs font-medium text-zinc-300">{eventLabels[delivery.event] || delivery.event}</span><span className="text-[10px] uppercase text-zinc-600">{delivery.status}</span></div><div className="mt-1 truncate text-[11px] text-zinc-600">{delivery.error || `${formatTime(delivery.createdAt)} · attempt ${delivery.attemptCount}${delivery.responseStatus ? ` · HTTP ${delivery.responseStatus}` : ""}`}</div></div>
                        {delivery.status === "failed" && <button title="Retry delivery" disabled={busy === delivery.id} onClick={() => void runAction(delivery.id, () => webhooksApi.retry(delivery.id))} className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 text-zinc-500 hover:text-purple-300">{busy === delivery.id ? <LoaderCircle size={13} className="animate-spin" /> : <RotateCcw size={13} />}</button>}
                      </div>
                    ))}
                  </div>
                  <div className="flex h-11 shrink-0 items-center justify-end gap-2 border-t border-zinc-900 px-4">
                    <button onClick={() => void runAction("rotate", async () => { const result = await webhooksApi.rotateSecret(selected.id) as { secret: string }; setSecret(result.secret); setShowSecret(true); })} className="flex h-8 items-center gap-2 rounded-lg border border-zinc-800 px-3 text-xs text-zinc-400 hover:text-white"><KeyRound size={14} /> Rotate secret</button>
                    <button onClick={() => { if (confirm(`Delete ${selected.name}?`)) void runAction("delete", () => webhooksApi.delete(selected.id)); }} className="flex h-8 items-center gap-2 rounded-lg border border-rose-500/20 px-3 text-xs text-rose-400 hover:bg-rose-500/10"><Trash2 size={14} /> Delete</button>
                  </div>
                </>
              ) : <div className="flex h-full items-center justify-center text-sm text-zinc-600">Select an endpoint</div>}
            </div>
          </div>
        </section>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
          <form onSubmit={submit} className="samaritan-card webhook-row-enter flex max-h-[min(620px,90vh)] w-full max-w-xl flex-col">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-900 px-5"><h2 className="text-sm font-semibold">{editingId ? "Edit endpoint" : "New endpoint"}</h2><button type="button" title="Close" onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white"><X size={18} /></button></div>
            <div className="dashboard-scroll-panel space-y-4 p-5">
              {error && <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"><CircleAlert size={14} />{error}</div>}
              <label className="block"><span className="mb-1.5 block text-xs text-zinc-400">Name</span><input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none transition focus:border-purple-500/60" placeholder="Automation endpoint" /></label>
              <label className="block"><span className="mb-1.5 block text-xs text-zinc-400">Target URL</span><input required type="url" value={form.targetUrl} onChange={(event) => setForm({ ...form, targetUrl: event.target.value })} className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none transition focus:border-purple-500/60" placeholder="https://example.com/webhooks" /></label>
              <fieldset><legend className="mb-2 text-xs text-zinc-400">Events</legend><div className="grid grid-cols-2 gap-2">{events.map((event) => { const checked = form.events.includes(event); return <label key={event} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-xs transition ${checked ? "border-purple-500/40 bg-purple-500/10 text-purple-200" : "border-zinc-800 text-zinc-500 hover:border-zinc-700"}`}><input type="checkbox" checked={checked} onChange={() => setForm({ ...form, events: checked ? form.events.filter((item) => item !== event) : [...form.events, event] })} className="sr-only" /><span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? "border-purple-400 bg-purple-500" : "border-zinc-700"}`}>{checked && <Check size={11} />}</span><span className="min-w-0 truncate">{eventLabels[event] || event}</span></label>; })}</div></fieldset>
            </div>
            <div className="flex h-14 shrink-0 items-center justify-end gap-2 border-t border-zinc-900 px-5"><button type="button" onClick={() => setShowForm(false)} className="h-9 rounded-lg px-3 text-sm text-zinc-400 hover:text-white">Cancel</button><button disabled={busy === "save"} className="flex h-9 items-center gap-2 rounded-lg bg-purple-600 px-4 text-sm font-medium hover:bg-purple-500 disabled:opacity-50">{busy === "save" ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} Save</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
