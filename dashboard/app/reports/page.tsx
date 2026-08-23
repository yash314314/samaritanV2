"use client";

import { useState, useEffect } from "react";
import { FileText, Download, RefreshCw, Calendar, TrendingUp, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [activeReport, setActiveReport] = useState<any | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  useEffect(() => {
    fetchReports();
  }, [selectedPeriod]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("samaritan_token") : null;
      const url = `${API_BASE}/api/reports${selectedPeriod ? `?period=${selectedPeriod}` : ""}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setReports(data.reports);
        if (data.reports.length > 0 && !activeReport) {
          setActiveReport(data.reports[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async (period: "daily" | "weekly" | "monthly") => {
    setGenerating(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("samaritan_token") : null;
      const res = await fetch(`${API_BASE}/api/reports/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ period }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveReport(data.report);
        await fetchReports();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const exportAsJson = (report: any) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report.summaryJson, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${report.period}_report_${report.id.slice(0, 8)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-3">
            <FileText className="w-7 h-7 text-indigo-400" />
            <span>Timely Focus & Activity Reports</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Automated recurring daily, weekly, and monthly productivity summaries and exportable reports.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleGenerateReport("daily")}
            disabled={generating}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center space-x-2 transition shadow-lg shadow-indigo-600/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
            <span>{generating ? "Generating..." : "Generate Daily Report"}</span>
          </button>

          <button
            onClick={() => handleGenerateReport("weekly")}
            disabled={generating}
            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2.5 rounded-xl border border-zinc-700 flex items-center space-x-2 transition"
          >
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <span>Generate Weekly Report</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Reports List (1 Col) + Report Viewer (2 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Reports History List (1 Col) */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-white">Report History</h3>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-2.5 py-1 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg"
            >
              <option value="">All Periods</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-zinc-500">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500 space-y-2">
              <p>No generated reports found.</p>
              <button
                onClick={() => handleGenerateReport("daily")}
                className="text-xs text-indigo-400 hover:underline"
              >
                Generate First Report Now →
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {reports.map((rep) => {
                const isSelected = activeReport?.id === rep.id;
                return (
                  <div
                    key={rep.id}
                    onClick={() => setActiveReport(rep)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition space-y-1 ${
                      isSelected
                        ? "bg-indigo-500/10 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30"
                        : "bg-zinc-800/40 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-white">{rep.title}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-indigo-400 px-2 py-0.5 rounded border border-zinc-700">
                        {rep.period}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                      <span>Focus: {rep.focusHours}h</span>
                      <span>Productivity: {rep.productivityPct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Report Inspector / Active Report Summary (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {activeReport ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-6">
              <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{activeReport.title}</h2>
                  <div className="text-xs text-zinc-400 mt-1">
                    Generated: {new Date(activeReport.createdAt).toLocaleString()}
                  </div>
                </div>

                <button
                  onClick={() => exportAsJson(activeReport)}
                  className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center space-x-2 transition"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Export JSON</span>
                </button>
              </div>

              {/* Metrics Stat Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/60 space-y-1">
                  <div className="text-[11px] text-zinc-400 font-semibold uppercase flex items-center space-x-1.5">
                    <Zap className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Focus Hours</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{activeReport.focusHours} hrs</div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/60 space-y-1">
                  <div className="text-[11px] text-zinc-400 font-semibold uppercase flex items-center space-x-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Productivity Score</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-400">{activeReport.productivityPct}%</div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/60 space-y-1">
                  <div className="text-[11px] text-zinc-400 font-semibold uppercase flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Burnout Index</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-400">{activeReport.burnoutIndex} / 10</div>
                </div>
              </div>

              {/* Top Applications Breakdown */}
              {activeReport.summaryJson?.topApps && (
                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-white">Top Applications Breakdown</h3>
                  <div className="space-y-2">
                    {activeReport.summaryJson.topApps.map((app: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-zinc-800/30 border border-zinc-800 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-3">
                          <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-white">{app.appName}</span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            app.category === "productive" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-400"
                          }`}>
                            {app.category}
                          </span>
                          <span className="font-bold text-zinc-200">{app.durationMinutes} mins</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-xs text-zinc-500">
              Select a report from the history list or generate a new report.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
