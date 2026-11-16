"use client";
import { useEffect, useState } from "react";
import { getSyncContext } from "@/storage/indexed";
const endpoint = "https://personal-planner-sync.bashiramri84.workers.dev";
type Status = { status?: string };
type Calendar = { id: string; summary: string; accessRole?: string };
export function GoogleCalendarPanel() {
  const [status, setStatus] = useState<Status>();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function request(path: string, method = "GET") {
    const { connection } = await getSyncContext();
    if (!connection.syncKey)
      throw new Error(
        "Start or join device Sync before connecting Google Calendar.",
      );
    const response = await fetch(`${endpoint}${path}`, {
      method,
      headers: { authorization: `Bearer ${connection.syncKey}` },
    });
    const body = await response.json();
    if (!response.ok || !body.ok)
      throw new Error(
        body?.error?.message ?? "Google Calendar request failed.",
      );
    return body;
  }
  async function refresh() {
    try {
      const body = await request("/v1/google/status");
      setStatus(body.connection);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not read Google Calendar status.",
      );
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function connect() {
    setBusy(true);
    try {
      const body = await request("/v1/google/start", "POST");
      window.location.assign(body.authorizeUrl);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not start Google connection.",
      );
      setBusy(false);
    }
  }
  async function loadCalendars() {
    setBusy(true);
    try {
      const body = await request("/v1/google/calendars");
      setCalendars(body.calendars);
      setMessage(
        body.calendars.length
          ? "Calendars loaded."
          : "No calendars were returned.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load calendars.",
      );
    } finally {
      setBusy(false);
    }
  }
  const connected = status?.status === "connected";
  return (
    <fieldset className="syncPanel">
      <legend>Google Calendar</legend>
      <p>
        {connected
          ? "Connected. Load calendars to view the calendars available to this account."
          : "Connect device Sync first, then connect one Google account for every linked device."}
      </p>
      {message && <p className="settingsError">{message}</p>}
      <div className="syncActions">
        <button type="button" disabled={busy} onClick={connect}>
          {busy
            ? "Opening Google…"
            : connected
              ? "Reconnect Google Calendar"
              : "Connect Google Calendar"}
        </button>
        {connected && (
          <button type="button" disabled={busy} onClick={loadCalendars}>
            Load calendars
          </button>
        )}
        <button type="button" onClick={() => void refresh()}>
          Refresh status
        </button>
      </div>
      {calendars.length > 0 && (
        <div className="settingsReadOnly">
          {calendars.map((calendar) => (
            <span key={calendar.id}>
              {calendar.summary}
              <b>
                {["owner", "writer"].includes(calendar.accessRole ?? "")
                  ? " · writable"
                  : " · read-only"}
              </b>
            </span>
          ))}
        </div>
      )}
    </fieldset>
  );
}
