import type { PlannerState } from "@/domain/types";
import {
  applySyncSuccess,
  commitIndexedPlanner,
  getSyncContext,
  joinWithCloud,
  removeSyncConnection,
  setSyncError,
  startSyncConnection,
} from "../storage/indexed";
import type { SyncJoinMode, SyncOperation, SyncResponse } from "./types";
import { SYNC_ENDPOINT } from "./types";
import { writeLog } from "@/storage/logs";

let active: Promise<PlannerState> | undefined;
type Trace = (stage: string, details?: string, failed?: boolean) => void;

async function tracedFetch(
  endpoint: string, init: RequestInit, trace: Trace, stage: string,
) {
  const started = performance.now();
  const timeout = AbortSignal.timeout(30000);
  const path = new URL(endpoint).pathname;
  trace(stage + " request", `${init.method ?? "GET"} ${path}`);
  try {
    const response = await fetch(endpoint, {...init, signal: timeout});
    const ray = response.headers.get("cf-ray");
    trace(stage + " response", `HTTP ${response.status} · ${Math.round(performance.now()-started)} ms${ray && /^[a-f0-9]+-[A-Z0-9]+$/i.test(ray) ? ` · Cloudflare Ray ${ray}` : ""}`, !response.ok);
    return response;
  } catch {
    trace(stage + " transport failed", `${timeout.aborted ? "REQUEST_TIMEOUT" : "FETCH_REJECTED"} · ${Math.round(performance.now()-started)} ms · browser online: ${navigator.onLine} · no HTTP status available (network, TLS or CORS)`, true);
    throw new Error("Could not reach " + stage + ". Check the Debug Log for connection details.");
  }
}

function responseCode(body: unknown) {
  const code = (body as {error?: {code?: unknown}} | null)?.error?.code;
  return typeof code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : "UNEXPECTED_RESPONSE";
}
export function createSyncKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

async function request(
  syncKey: string,
  deviceId: string,
  cursor: number,
  operations: SyncOperation[],
  trace: Trace = (stage, details, failed) => writeLog("sync", stage, failed ? "error" : "info", details),
): Promise<SyncResponse> {
    const response = await tracedFetch(SYNC_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${syncKey}`,
      },
      body: JSON.stringify({ cursor, deviceId, operations }),
    }, trace, "Sync Worker");
  const body = (await response.json().catch(() => null)) as
    | SyncResponse
    | { ok: false; error?: { message?: string } }
    | null;
  if (!response.ok || !body || body.ok !== true) {
    trace("Sync Worker rejected response", responseCode(body), true);
    throw new Error(
      body && body.ok === false && body.error?.message
        ? body.error.message
        : `Sync request failed (${response.status})`,
    );
  }
  if (!Number.isSafeInteger(body.nextCursor) || !Array.isArray(body.appliedOperationIds) ||
    !Array.isArray(body.ignoredOperationIds) || !Array.isArray(body.changes)) {
    trace("Sync Worker invalid response", "INVALID_SYNC_RESPONSE", true);
    throw new Error("Sync returned an invalid response.");
  }
  return body;
}

async function runSync(trace: Trace) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    trace("Browser offline", "BROWSER_OFFLINE", true);
    throw new Error(
      "You are offline. Changes remain safely queued on this device.",
    );
  }
  let latest: PlannerState | undefined;
  // D1 executes each field merge independently. Small batches keep an initial
  // device upload below Worker/D1 subrequest limits and remain retry-safe.
  for (let round = 0; round < 100; round++) {
    const { connection, operations } = await getSyncContext().catch(error => {
      trace("Local queue read failed", "INDEXEDDB_READ_FAILED", true);
      throw error;
    });
    if (!connection.syncKey) {
      trace("Local connection missing", "NO_SYNC_CONNECTION", true);
      throw new Error("This device is not connected to Sync.");
    }
    const batch = operations.slice(0, 5);
    trace("Queue batch", `round ${round+1} · pending ${operations.length} · sending ${batch.length} · cursor ${connection.cursor}`);
    const response = await request(
      connection.syncKey,
      connection.deviceId,
      connection.cursor,
      batch,
      trace,
    );
    latest = await applySyncSuccess(response).catch(error => {
      trace("Local queue apply failed", "INDEXEDDB_APPLY_FAILED", true);
      throw error;
    });
    trace("Batch saved locally", `accepted ${response.appliedOperationIds.length} · ignored ${response.ignoredOperationIds.length} · downloaded ${response.changes.length} · cursor ${response.nextCursor}`);
    if (operations.length <= batch.length) {
      const current=latest;
      const google=await tracedFetch(new URL("/v1/google/events", SYNC_ENDPOINT).href,{headers:{authorization:`Bearer ${connection.syncKey}`}},trace,"Google Calendar via Worker");
      const body = await google.json().catch(() => null) as {
        appointments?: PlannerState["appointments"]; error?: {message?: string};
      } | null;
      if (!google.ok || !body) {
        trace("Google Calendar response failed", responseCode(body), true);
        throw new Error(body?.error?.message ?? `Google Calendar sync failed (${google.status}).`);
      }
      if (Array.isArray(body.appointments)) {
        const incoming = new Map(body.appointments.map(item => [item.id, item]));
        const appointments = [
          ...current.appointments.filter(item => item.source !== "google" || incoming.has(item.id)).map(item => incoming.get(item.id) ?? item),
          ...body.appointments.filter(item => !current.appointments.some(existing => existing.id === item.id)),
        ];
        const next = {...current, appointments, revision: current.revision + 1};
        await commitIndexedPlanner(current, next).catch(error => {
          trace("Local calendar save failed", "INDEXEDDB_CALENDAR_SAVE_FAILED", true);
          throw error;
        });
        trace("Google Calendar saved locally", `received ${incoming.size} events`);
        return next;
      }
      trace("Google Calendar returned no event collection");
      return current;
    }
    if (batch.length === 0) return latest;
  }
  trace("Batch limit reached", "SYNC_BATCH_LIMIT", true);
  throw new Error(
    "Some changes are still pending. Press Sync again to continue.",
  );
}
export function syncNow() {
  if (active) return active;
  const attempt = crypto.randomUUID().slice(0, 8);
  const trace: Trace = (stage, details, failed) => writeLog("sync", stage, failed ? "error" : "info", `Attempt ${attempt}${details ? " · " + details : ""}`);
  trace("Manual Sync started", `origin ${location.origin}`);
  active = runSync(trace)
    .then((state) => { trace("Manual Sync completed"); return state; })
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : "Sync failed";
      trace("Manual Sync failed", undefined, true);
      await setSyncError(message).catch(() => trace("Local error status write failed", "INDEXEDDB_STATUS_FAILED", true));
      throw error;
    })
    .finally(() => {
      active = undefined;
    });
  return active;
}

export async function startSync(current: PlannerState) {
  const key = createSyncKey();
  await startSyncConnection(key, current);
  const state = await syncNow();
  return { key, state };
}
export async function previewCloud(syncKey: string) {
  const { connection } = await getSyncContext();
  return request(syncKey.trim(), connection.deviceId, 0, []);
}
export async function joinSync(
  syncKey: string,
  mode: SyncJoinMode,
  local: PlannerState,
) {
  const key = syncKey.trim();
  if (key.length < 40) throw new Error("Sync Key is invalid.");
  const response = await previewCloud(key);
  let state = await joinWithCloud(key, response, local, mode === "merge-local");
  if (mode === "merge-local") state = await syncNow();
  return state;
}
export async function removeThisDevice() {
  await removeSyncConnection();
}
