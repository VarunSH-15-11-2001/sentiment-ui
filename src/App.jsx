import React, { useEffect, useMemo, useState } from "react";
import { Loader2, History, Trash2, Wand2, Upload, Settings2 } from "lucide-react";

/**
 * Sentiment Frontend (single-file React component)
 * ------------------------------------------------
 * Paste this into a Vite React app's App.jsx (or use the in-chat preview).
 * It calls your FastAPI backend:
 *   - POST /analyze { text }
 *   - POST /batch   { items: [{id, text}, ...] }
 *
 * Features
 * - Text box -> sentiment with confidence bars
 * - Batch mode (multi-line), CSV download
 * - History (persisted in localStorage)
 * - Configurable API base URL (persisted)
 */

const DEFAULT_URL = (window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.API_BASE) || "https://sentiment-api-493249954211.us-west1.run.app/";

export default function SentimentApp() {
  const [apiBase, setApiBase] = useState(() => localStorage.getItem("apiBase") || DEFAULT_URL);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchResults, setBatchResults] = useState(null);
  const [batchText, setBatchText] = useState("");
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("history") || "[]"); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem("apiBase", apiBase); }, [apiBase]);
  useEffect(() => { localStorage.setItem("history", JSON.stringify(history)); }, [history]);

  const api = useMemo(() => apiBase.replace(/\/$/, ""), [apiBase]);

  const onAnalyze = async () => {
    setBusy(true); setError(""); setResult(null);
    try {
      const r = await fetch(`${api}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const data = await r.json();
      setResult(data);
      setHistory((h) => [{ ts: Date.now(), text, result: data }, ...h].slice(0, 50));
    } catch (e) {
      setError(String(e));
    } finally { setBusy(false); }
  };

  const onBatch = async () => {
    setBusy(true); setError("");
    try {
      const lines = batchText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const items = lines.map((l, i) => ({ id: String(i + 1), text: l }));
      const r = await fetch(`${api}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const data = await r.json();

      // Merge results with original text to show on screen
      const merged = data.results.map((res, idx) => ({
        id: res.id,
        text: items[idx]?.text ?? "",
        label: res.label,
        scores: res.scores,
      }));
      setBatchResults({ model: data.model, items: merged });

      // Add each item to history
      setHistory((h) => [
        ...merged.map(m => ({
          ts: Date.now(),
          text: m.text,
          result: { label: m.label, scores: m.scores, model: data.model, latency_ms: 0 }
        })),
        ...h
      ].slice(0, 50));

      // Keep data for optional CSV download
      window.__lastBatchForCsv = { items, results: data.results };
    } catch (e) {
      setError(String(e));
    } finally { setBusy(false); }
  };


  const clearHistory = () => setHistory([]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Wand2 className="w-6 h-6" />
          <h1 className="text-xl font-semibold">Sentiment Demo</h1>
          <div className="ml-auto flex items-center gap-2">
            <Settings2 className="w-4 h-4 opacity-60" />
            <input
              className="px-2 py-1 rounded border border-slate-300 text-sm w-72"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              title="API base URL"
            />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 grid md:grid-cols-3 gap-6">
        {/* Left column: input */}
        <section className="md:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <label className="block text-sm font-medium text-slate-600 mb-2">Text</label>
            <textarea
              rows={5}
              className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="Type something to analyze…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={onAnalyze}
                disabled={!text.trim() || busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white disabled:opacity-40"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Analyze
              </button>
              <button
                onClick={() => setBatchOpen(v => !v)}
                className="px-3 py-2 rounded-xl border border-slate-300"
              >{batchOpen ? "Hide batch" : "Batch mode"}</button>
            </div>

            {batchOpen && (
              <div className="mt-5 border-t pt-5">
                <label className="block text-sm font-medium text-slate-600 mb-2">Batch (one text per line)</label>
                <textarea
                  rows={6}
                  className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder={"good day\nthis is awful\nmeh"}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                />
                <div className="mt-3">
                  <button
                    onClick={onBatch}
                    disabled={!batchText.trim() || busy}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white disabled:opacity-40"
                  >
                    <Upload className="w-4 h-4" />
                    Run & Download CSV
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 bg-rose-50 text-rose-900 border border-rose-200 p-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="mt-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${result.label === 'Positive' ? 'bg-emerald-100 text-emerald-800' :
                  result.label === 'Negative' ? 'bg-rose-100 text-rose-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                  {result.label}
                </span>
                <span className="text-xs text-slate-500">{result.model}</span>
                <span className="ml-auto text-xs text-slate-500">{result.latency_ms.toFixed(1)} ms</span>
              </div>

              <div className="space-y-2">
                {result.scores.map((s) => (
                  <ConfidenceBar key={s.label} label={s.label} value={s.score} />
                ))}
              </div>
            </div>
          )}
          {/* Batch Results (on-screen) */}
          {batchResults && (
            <div className="mt-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-slate-700">Batch results</span>
                <span className="text-xs text-slate-500">
                  {batchResults.items.length} items · {batchResults.model}
                </span>
                <button
                  onClick={() => downloadCsv(window.__lastBatchForCsv)}
                  className="ml-auto text-xs px-3 py-1.5 border border-slate-300 rounded-lg"
                >
                  Download CSV
                </button>
              </div>
              <ul className="space-y-3">
                {batchResults.items.map((it) => (
                  <li key={it.id} className="border border-slate-200 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${it.label === 'Positive' ? 'bg-emerald-100 text-emerald-800' :
                            it.label === 'Negative' ? 'bg-rose-100 text-rose-800' :
                              'bg-slate-100 text-slate-800'
                          }`}
                      >
                        {it.label}
                      </span>
                      <span className="text-[11px] text-slate-500">id {it.id}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words mb-2">{it.text}</p>
                    <div className="space-y-2">
                      {it.scores.map((s) => (
                        <ConfidenceBar key={s.label} label={s.label} value={s.score} />
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </section>

        {/* Right column: history */}
        <aside>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 h-full">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4" />
              <h2 className="font-medium">History</h2>
              <button onClick={clearHistory} className="ml-auto inline-flex items-center gap-1 text-xs text-slate-600 hover:text-rose-600">
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">No items yet.</p>
            ) : (
              <ul className="space-y-3 max-h-[70vh] overflow-auto pr-1">
                {history.map((h, i) => (
                  <li key={i} className="border border-slate-200 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${h.result.label === 'Positive' ? 'bg-emerald-100 text-emerald-800' :
                        h.result.label === 'Negative' ? 'bg-rose-100 text-rose-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>{h.result.label}</span>
                      <span className="text-[11px] text-slate-500">{new Date(h.ts).toLocaleString()}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{h.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>

      <footer className="py-6 text-center text-xs text-slate-500">
        Point this at your API base URL above. First call may be slow due to model download.
      </footer>
    </div>
  );
}

function ConfidenceBar({ label, value }) {
  const pct = Math.round((value ?? 0) * 100);
  const palette = {
    Positive: "bg-emerald-500",
    Neutral: "bg-slate-500",
    Negative: "bg-rose-500",
  };
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600 mb-1">
        <span>{label}</span><span>{pct}%</span>
      </div>
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${palette[label] || 'bg-slate-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
