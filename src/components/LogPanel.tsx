"use client";

import {useEffect, useState} from "react";
import {clearLogs, readLogs, type PlannerLog} from "@/storage/logs";

export function LogPanel() {
  const [logs, setLogs] = useState<PlannerLog[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("technical");
  useEffect(() => {
    const load = () => setLogs(readLogs());
    load();
    window.addEventListener("planner-debug-log", load);
    return () => window.removeEventListener("planner-debug-log", load);
  }, []);

  const technical = logs.filter(log => log.area !== "planner");
  const visible = filter === "all" ? logs : filter === "errors"
    ? technical.filter(log => log.level === "error") : technical;
  function download() {
    const blob = new Blob([JSON.stringify(technical, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "personal-planner-debug.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return <fieldset className="syncPanel" data-no-activity-log>
    <legend>Activity &amp; debug log</legend>
    <div className="syncActions">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide Debug Log" : "Show Debug Log"}</button>
      <button type="button" onClick={download} disabled={!technical.length}>Export debug log</button>
      <button type="button" onClick={clearLogs} disabled={!logs.length}>Clear log</button>
    </div>
    {open && <>
      <label>Show
        <select value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="technical">Technical events</option>
          <option value="errors">Errors only</option>
          <option value="all">All activity</option>
        </select>
      </label>
      <small>Export includes technical events. Sync traces record counts, timings and error codes without keys, tokens or event contents.</small>
      <div className="settingsReadOnly" style={{display: "grid", maxHeight: "22rem", overflow: "auto", overflowWrap: "anywhere"}}>
        {visible.length ? visible.map(log => <span key={log.id}>
          <b>{log.level.toUpperCase()} · {log.area}</b> · {new Date(log.at).toLocaleString()} · {log.message}
          {log.details && <> · {log.details}</>}
        </span>) : <span>No matching events recorded.</span>}
      </div>
    </>}
  </fieldset>;
}
