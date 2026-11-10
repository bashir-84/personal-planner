"use client";

import { ChangeEvent, useState } from "react";
import Link from "next/link";
import { prepareImport, mergeImport, type ImportPreview } from "@/domain/taskImport";
import { loadState, saveState } from "@/storage/local";

export function ImportTasks() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [acceptWarnings, setAcceptWarnings] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const allWarnings = preview?.rows.flatMap(row => row.warnings.map(w => "#" + row.index + ": " + w)) ?? [];
  const warningsPresent = allWarnings.length > 0 || Boolean(preview?.warnings.length);
  const canApply = Boolean(preview && !preview.errors.length && preview.validCount > 0 && (!warningsPresent || acceptWarnings));
  const panel: React.CSSProperties = {
    background: "#fff", border: "1px solid #e7e9ea", borderRadius: 16, padding: 20
  };
  const button: React.CSSProperties = {
    border: "1px solid #d9dfdf", borderRadius: 10, background: "white",
    padding: "10px 16px", font: "inherit", cursor: "pointer"
  };

  const changeText = (value: string) => {
    setText(value); setPreview(null); setAcceptWarnings(false);
    setMessage(""); setSuccess(false);
  };

  async function readFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setMessage("The file is too large (maximum 2 MB).");
      return;
    }
    changeText(await file.text());
  }

  function check() {
    setPreview(prepareImport(text, loadState()));
    setAcceptWarnings(false);
    setMessage("");
    setSuccess(false);
  }

  function apply() {
    if (!canApply) return;
    try {
      const latest = loadState();
      const current = prepareImport(text, latest);
      if (current.errors.length) {
        setPreview(current);
        setAcceptWarnings(false);
        setMessage("The data has changed or contains errors. Review again.");
        return;
      }
      // Avoid committing a preview that changed in another tab.
      if (!preview || current.validCount !== preview.validCount ||
          current.duplicateCount !== preview.duplicateCount) {
        setPreview(current);
        setAcceptWarnings(false);
        setMessage("Planner data changed. Review the refreshed preview.");
        return;
      }
      const next = mergeImport(current, latest);
      saveState(next);
      setMessage("Imported " + current.validCount + " task(s). Existing tasks were kept.");
      setSuccess(true);
      setPreview(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed. Nothing was saved.");
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "32px 20px 70px", color: "#203036" }}>
      <nav style={{ marginBottom: 22 }}><Link href="/">← Planner</Link></nav>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 8 }}>Import Tasks</h1>
        <p style={{ opacity: 0.75, margin: 0 }}>
          Paste AI-generated JSON or upload a .json file. Only task titles are required.
          Missing values stay unset; a 30-minute duration is explicitly marked as provisional.
        </p>
      </header>
      <section style={{ ...panel, display: "grid", gap: 14 }}>
        <label htmlFor="import-json" style={{ fontWeight: 600 }}>JSON output</label>
        <textarea
          id="import-json" dir="ltr" spellCheck={false} rows={14}
          value={text} onChange={e => changeText(e.target.value)}
          placeholder={'{"format":"personal-planner-tasks","schema_version":"1.0.0","tasks":[{"title":"My task"}]}'}
          style={{ border: "1px solid #d9dfdf", borderRadius: 10, padding: 14,
            width: "100%", boxSizing: "border-box", resize: "vertical",
            font: "13px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace" }}
        />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input type="file" accept=".json,application/json,text/plain" aria-label="Upload JSON file" onChange={readFile} />
          <button type="button" style={{ ...button, background: "#16325a", color: "#fff" }}
            disabled={!text.trim()} onClick={check}>Validate & Preview</button>
        </div>
      </section>
      {message && <p role="status" style={{ padding: "12px 0" }}>{message}
        {success && <> <Link href="/">View tasks</Link></>}
      </p>}
      {preview && (
        <section style={{ ...panel, marginTop: 20, display: "grid", gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Preview</h2>
          <p style={{ margin: 0 }}>
            {preview.validCount} new · {preview.duplicateCount} duplicates · {preview.rows.filter(r => r.status === "invalid").length} invalid
          </p>
          {preview.errors.length > 0 && (
            <div role="alert" style={{ color: "#ad2929" }}>
              {preview.errors.map((err, i) => <p key={i}>{err}</p>)}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead><tr><th style={{ padding: 8 }}>#</th><th>Task</th><th>Status</th><th>Duration</th><th>Details</th></tr></thead>
              <tbody>
                {preview.rows.map(row =>
                  <tr key={row.index} style={{ borderTop: "1px solid #edf0f0" }}>
                    <td style={{ padding: 8 }}>{row.index}</td>
                    <td>{row.title || "—"}</td>
                    <td>{row.status}</td>
                    <td>{row.task?.duration ?? "—"}{row.task?.estimateSource === "default" ? " min (default)" : row.task ? " min" : ""}</td>
                    <td style={{ maxWidth: 450 }}>
                      {row.errors.map((err, i) => <div key={"e" + i} style={{ color: "#ad2929" }}>{err}</div>)}
                      {row.warnings.map((w, i) => <div key={"w" + i} style={{ color: "#8c6000" }}>{w}</div>)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {warningsPresent && (
            <label style={{ display: "flex", gap: 9, alignItems: "start" }}>
              <input type="checkbox" checked={acceptWarnings} onChange={e => setAcceptWarnings(e.target.checked)} />
              I reviewed the warnings. Unsupported details will be preserved in import metadata.
            </label>
          )}
          <button type="button" onClick={apply} disabled={!canApply}
            style={{ ...button, background: canApply ? "#16325a" : "#e7e9ea", color: canApply ? "#fff" : "#888", justifySelf: "start" }}>
            Import {preview.validCount} Task(s)
          </button>
        </section>
      )}
    </main>
  );
}
