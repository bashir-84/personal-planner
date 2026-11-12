"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { TaskEditDialog } from "./TaskEditDialog";
import { importReadmeMarkdown } from "@/content/importReadme";
import type { PlannerState,Task } from "@/domain/types";
import { prepareImport, mergeImport, type ImportPreview } from "@/domain/taskImport";
import {emptyState} from "@/storage/local";
import {commitIndexedPlanner,loadIndexedPlanner} from "@/storage/indexed";

export function ImportTasks() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [acceptWarnings, setAcceptWarnings] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<Task>>>({});
  const [deletedKeys, setDeletedKeys] = useState<string[]>([]);
  const [plannerState,setPlannerState]=useState<PlannerState>(emptyState);
  const [storageError,setStorageError]=useState("");
  useEffect(()=>{loadIndexedPlanner().then(result=>setPlannerState(result.state)).catch(error=>setStorageError(error instanceof Error?error.message:"IndexedDB is unavailable"))},[]);

  const allWarnings = preview?.rows.flatMap(row => row.warnings.map(w => "#" + row.index + ": " + w)) ?? [];
  const warningsPresent = allWarnings.length > 0 || Boolean(preview?.warnings.length);
  const invalidEdits = preview?.rows.some(row => row.task && edits[row.sourceKey] && (!((edits[row.sourceKey].title ?? row.task.title).trim()) || !Number.isInteger(edits[row.sourceKey].duration ?? row.task.duration) || (edits[row.sourceKey].duration ?? row.task.duration) < 1)) ?? false;
  const deletedCount = preview?.rows.filter(row => row.task && deletedKeys.includes(row.sourceKey)).length ?? 0;
  const importableCount = Math.max(0, (preview?.validCount ?? 0) - deletedCount);
  const canApply = Boolean(preview && !preview.errors.length && importableCount > 0 && !invalidEdits && (!warningsPresent || acceptWarnings));
  const panel: React.CSSProperties = {
    background: "#fff", border: "1px solid #e7e9ea", borderRadius: 16, padding: 20
  };
  const button: React.CSSProperties = {
    border: "1px solid #d9dfdf", borderRadius: 10, background: "white",
    padding: "10px 16px", font: "inherit", cursor: "pointer"
  };

  const changeText = (value: string) => {
    setText(value); setPreview(null); setAcceptWarnings(false);
    setMessage(""); setSuccess(false); setEdits({}); setEditingKey(null); setDeletedKeys([]);
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
    setEdits({}); setEditingKey(null); setDeletedKeys([]);
    setPreview(prepareImport(text, plannerState));
    setAcceptWarnings(false);
    setMessage("");
    setSuccess(false);
  }

  async function apply() {
    if (!canApply) return;
    try {
      const latest = (await loadIndexedPlanner()).state;
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
      current.rows = current.rows.filter(row => !deletedKeys.includes(row.sourceKey));
      current.validCount = current.rows.filter(row => row.status === "ready" && row.task).length;
      current.duplicateCount = current.rows.filter(row => row.status === "duplicate").length;
      // Edits made in the shared task form are applied to the newly validated rows.
      // prepareImport assigns fresh IDs to projects that are not saved yet. Resolve
      // an edited preview project by name so its ID survives this second validation.
      for (const row of current.rows) {
        const edit = edits[row.sourceKey];
        if (!row.task || !edit) continue;
        const patch = { ...edit };
        if (patch.projectId) {
          const previewProject = preview?.projects.find(project => project.id === patch.projectId);
          if (previewProject) {
            const normalizedName = previewProject.name.trim().toLocaleLowerCase("fa-IR");
            const currentProject = [...current.projects, ...latest.projects].find(project =>
              project.name.trim().toLocaleLowerCase("fa-IR") === normalizedName
            );
            if (currentProject) patch.projectId = currentProject.id;
          }
        }
        row.task = { ...row.task, ...patch };
      }
      const next = mergeImport(current, latest);
      await commitIndexedPlanner(latest,next);
      setPlannerState(next);
      setMessage("Imported " + current.validCount + " task(s). Existing tasks were kept.");
      setSuccess(true);
      setPreview(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed. Nothing was saved.");
    }
  }

  const editingRow = preview?.rows.find(row => row.sourceKey === editingKey && row.task);
  const currentEditedTask = editingRow?.task ? { ...editingRow.task, ...(edits[editingRow.sourceKey] ?? {}) } : undefined;
  const editorProjects = [...plannerState.projects, ...(preview?.projects ?? [])];
  const projectName = (projectId?: string) => editorProjects.find(project => project.id === projectId)?.name ?? "—";
  const displayDeadline = (deadline?: string) => deadline
    ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(deadline))
    : "—";
  async function copyInstructions() {
    try {
      await navigator.clipboard.writeText(importReadmeMarkdown);
      setCopied(true);
    } catch {
      setCopied(false);
      setMessage("Clipboard is unavailable. Please use a secure HTTPS connection or copy the README from GitHub.");
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "32px 20px 70px", color: "#203036" }}>
      {storageError&&<p className="settingsError" role="alert">{storageError}</p>}
      <nav style={{ marginBottom: 22 }}><Link href="/">← Planner</Link></nav>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 8 }}>Import Tasks</h1>
        <p style={{ opacity: 0.75, margin: 0 }}>
          Paste AI-generated JSON or upload a .json file. Only task titles are required.
          Missing values stay unset; a 30-minute duration is explicitly marked as provisional.
        </p>
      </header>
      <section style={{ ...panel, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 18 }} aria-label="AI instructions">
        <div><strong>AI Instructions (README.md)</strong><p style={{ margin: "5px 0 0", opacity: .7, fontSize: 13 }}>Copy the full Markdown instructions and paste them into your AI with your journal.</p></div>
        <button type="button" onClick={copyInstructions} style={{ ...button, background: copied ? "#e8f4ed" : "#f3f6f7", display: "inline-flex", alignItems: "center", gap: 8 }} aria-label="Copy README Markdown">
          <Icon name={copied ? "check" : "note"} />{copied ? "Copied!" : "Copy README"}
        </button>
      </section>
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
          {invalidEdits && <p role="alert" style={{ color: "#ad2929" }}>Every task needs a title and a positive duration. Please correct your edits.</p>}
          {preview.errors.length > 0 && (
            <div role="alert" style={{ color: "#ad2929" }}>
              {preview.errors.map((err, i) => <p key={i}>{err}</p>)}
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead><tr><th style={{ padding: 8 }}>#</th><th>Task</th><th>Status</th><th>Duration</th><th>Project</th><th>Priority</th><th>Deadline</th><th>Details</th></tr></thead>
              <tbody>
                {preview.rows.map(row => {
                  const task = row.task ? { ...row.task, ...(edits[row.sourceKey] ?? {}) } : undefined;
                  const removed = deletedKeys.includes(row.sourceKey);
                  return <tr key={row.index} style={{ borderTop: "1px solid #edf0f0", opacity: removed ? .45 : 1 }}>
                    <td style={{ padding: 8 }}>{row.index}</td>
                    <td>{(edits[row.sourceKey]?.title ?? row.title) || "—"}</td>
                    <td>{removed ? "Removed" : row.status}</td>
                    <td>{task?.duration ?? "—"}{task ? (task.estimateSource === "default" ? " min (default)" : " min") : ""}</td>
                    <td>{task ? projectName(task.projectId) : "—"}</td>
                    <td>{task ? `I${task.importance ?? "—"} · U${task.urgency ?? "—"}` : "—"}</td>
                    <td>{task ? displayDeadline(task.deadline) : "—"}</td>
                    <td style={{ maxWidth: 450 }}>
                      {row.task && !removed && <button type="button" style={{...button, display:"inline-flex", alignItems:"center", gap:5, padding:"5px 9px", marginBottom:5 }} aria-label={`Edit ${row.title}`} title={`Edit ${row.title}`} onClick={()=>setEditingKey(row.sourceKey)}><Icon name="edit" /> Edit</button>}

                      {row.errors.map((err, i) => <div key={"e" + i} style={{ color: "#ad2929" }}>{err}</div>)}
                      {row.warnings.map((w, i) => <div key={"w" + i} style={{ color: "#8c6000" }}>{w}</div>)}
                    </td>
                  </tr>
                })}
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
            Import {importableCount} Task(s)
          </button>
        </section>
      )}
      {currentEditedTask && editingRow && <TaskEditDialog task={currentEditedTask} projects={editorProjects} onClose={()=>setEditingKey(null)} onChange={patch=>setEdits(previous=>({...previous,[editingRow.sourceKey]:{...(previous[editingRow.sourceKey] ?? {}),...patch}}))} onToggle={completed=>{setEdits(previous=>({...previous,[editingRow.sourceKey]:{...(previous[editingRow.sourceKey] ?? {}),completed}}));setEditingKey(null)}} onDelete={()=>{setDeletedKeys(previous=>[...previous,editingRow.sourceKey]);setEditingKey(null)}}/>}
    </main>
  );
}
