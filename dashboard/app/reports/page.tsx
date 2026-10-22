"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/sam/PageHeader";
import { Decode } from "@/components/sam/Decode";
import SamLoading from "@/components/sam/SamLoading";
import { Download, RefreshCw, TrendingUp, Zap, AlertTriangle } from "lucide-react";

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
    <div className="dashboard-page flex flex-col gap-4 text-zinc-100">
      {/* Header & Controls */}
      <PageHeader
        title="Reports"
        description="Daily, weekly and monthly summaries of focus and activity, ready to export."
        actions={
          <>
            <button type="button" onClick={() => handleGenerateReport("daily")} disabled={generating} className="sam-button" data-variant="primary">
              <RefreshCw className={`h-3 w-3 ${generating ? "animate-spin" : ""}`} strokeWidth={1.5} />
              {generating ? "Generating" : "Generate daily report"}
            </button>
            <button type="button" onClick={() => handleGenerateReport("weekly")} disabled={generating} className="sam-button">
              Generate weekly report
            </button>
          </>
        }
      />

      {/* Main Grid: Reports List (Left) + Report Viewer (Right) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Reports History List */}
        <div className="samaritan-card flex flex-col p-4 space-y-3 lg:col-span-4 xl:col-span-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-zinc-400">Report History</h3>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="sam-select w-auto px-2 py-0.5 text-xs"
            >
              <option value="">All Periods</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {loading ? (
            <SamLoading compact label="Loading reports" />
          ) : reports.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500 space-y-2">
              <p>No generated reports found.</p>
              <button
                onClick={() => handleGenerateReport("daily")}
                className="text-xs text-red-500 hover:underline"
              >
                Generate First Report Now →
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 dashboard-scroll-panel flex-1 pr-1 max-h-[680px]">
              {reports.map((rep) => {
                const isSelected = activeReport?.id === rep.id;
                return (
                  <div
                    key={rep.id}
                    onClick={() => setActiveReport(rep)}
                    className={`p-3 border text-left cursor-pointer transition space-y-1 ${
                      isSelected
                        ? "bg-red-500/10 border-red-500/50"
                        : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-200">{rep.title}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-900 text-red-400 px-1.5 py-0.5 rounded border border-zinc-800">
                        {rep.period}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 flex items-center justify-between font-mono">
                      <span>Focus: {rep.focusHours}h</span>
                      <span>Productivity: {rep.productivityPct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Report Inspector / Active Report Summary */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {activeReport ? (
            <div className="samaritan-card p-5 space-y-5">
              <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white">{activeReport.title}</h2>
                  <div className="text-xs text-zinc-500 mt-0.5 font-mono">
                    Generated: {new Date(activeReport.createdAt).toLocaleString()}
                  </div>
                </div>

                <button
                  onClick={() => exportAsJson(activeReport)}
                  className="sam-button"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>Export JSON</span>
                </button>
              </div>

              {/* Metrics Stat Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider flex items-center space-x-1.5">
                    <Zap className="w-3.5 h-3.5 text-red-500" />
                    <span>Focus Hours</span>
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    <Decode value={`${activeReport.focusHours} hrs`} />
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider flex items-center space-x-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-zinc-300" />
                    <span>Productivity Score</span>
                  </div>
                  <div className="text-2xl font-bold text-zinc-100 font-mono">
                    <Decode value={`${activeReport.productivityPct}%`} />
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <span>Burnout Index</span>
                  </div>
                  <div className="text-2xl font-bold text-red-400 font-mono">
                    <Decode value={`${activeReport.burnoutIndex} / 10`} />
                  </div>
                </div>
              </div>

              {/* Top Applications Breakdown */}
              {activeReport.summaryJson?.topApps && (
                <div className="space-y-2.5">
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-zinc-400">Top Applications Breakdown</h3>
                  <div className="space-y-1.5">
                    {activeReport.summaryJson.topApps.map((app: any, idx: number) => (
                      <div key={idx} className="p-2.5 bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-3">
                          <span className="w-5 h-5 bg-zinc-900 text-zinc-300 border border-zinc-800 flex items-center justify-center font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-zinc-200">{app.appName}</span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            app.category === "productive" ? "bg-zinc-800 text-zinc-100 border border-zinc-700" : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}>
                            {app.category}
                          </span>
                          <span className="font-mono text-zinc-300">{app.durationMinutes} mins</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="samaritan-card border border-dashed border-zinc-800 p-12 text-center text-xs text-zinc-500">
              Select a report from the history list or generate a new report.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
