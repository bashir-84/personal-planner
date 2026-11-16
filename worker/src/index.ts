import { incomingWins } from "./version";

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta?: unknown;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}
type Env = {
  PLANNER_DB: D1Database;
  SYNC_PEPPER: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_TOKEN_ENCRYPTION_KEY: string;
};
type Operation = {
  operationId: string;
  deviceId: string;
  entityType: string;
  entityId: string;
  patch: Record<string, unknown>;
  clientUpdatedAt: string;
};
type FieldRow = {
  entity_type: string;
  entity_id: string;
  field_name: string;
  value_json: string;
  client_updated_at: string;
  operation_id: string;
  server_sequence: number;
};
type VersionRow = {
  field_name: string;
  client_updated_at: string;
  operation_id: string;
};
const allowedOrigins = new Set([
  "https://bashiramri.ir",
  "https://bashir-84.github.io",
  "http://localhost:3000",
  "http://localhost:3100",
]);
const entityTypes = new Set([
  "task",
  "project",
  "appointment",
  "dailyCapacity",
  "confirmed",
  "settings",
]);

function cors(origin: string | null): Record<string, string> {
  return origin && allowedOrigins.has(origin)
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": "authorization, content-type",
        "access-control-allow-methods": "POST, GET, OPTIONS",
        "access-control-max-age": "86400",
        vary: "Origin",
      }
    : {};
}
function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}
function failure(
  code: string,
  message: string,
  status: number,
  headers: HeadersInit = {},
) {
  return json({ ok: false, error: { code, message } }, status, headers);
}
function validText(value: unknown, max: number) {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}
function normalizeOperation(
  value: unknown,
  requestDeviceId: string,
): Operation | undefined {
  if (!value || typeof value !== "object") return;
  const item = value as Partial<Operation>;
  if (
    !validText(item.operationId, 128) ||
    !validText(item.deviceId, 128) ||
    item.deviceId !== requestDeviceId ||
    !validText(item.entityType, 40) ||
    !entityTypes.has(item.entityType!) ||
    !validText(item.entityId, 256) ||
    !item.patch ||
    typeof item.patch !== "object" ||
    Array.isArray(item.patch) ||
    Object.keys(item.patch).length > 200 ||
    !validText(item.clientUpdatedAt, 40)
  )
    return;
  const date = new Date(item.clientUpdatedAt!);
  if (Number.isNaN(date.getTime())) return;
  return {
    operationId: item.operationId!,
    deviceId: item.deviceId!,
    entityType: item.entityType!,
    entityId: item.entityId!,
    patch: item.patch as Record<string, unknown>,
    clientUpdatedAt: date.toISOString(),
  };
}
async function ownerId(key: string, pepper: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(key),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
async function sequence(db: D1Database, owner: string) {
  const row = await db
    .prepare(
      "UPDATE sync_cursors SET last_sequence = last_sequence + 1 WHERE owner_id = ? RETURNING last_sequence",
    )
    .bind(owner)
    .first<{ last_sequence: number }>();
  if (!row) throw new Error("Cursor allocation failed");
  return row.last_sequence;
}
function entityKey(type: string, id: string) {
  return `${type}\u0000${id}`;
}
async function fullChange(
  db: D1Database,
  owner: string,
  type: string,
  id: string,
) {
  const result = await db
    .prepare(
      "SELECT entity_type, entity_id, field_name, value_json, client_updated_at, operation_id, server_sequence FROM sync_field_versions WHERE owner_id = ? AND entity_type = ? AND entity_id = ? ORDER BY field_name",
    )
    .bind(owner, type, id)
    .all<FieldRow>();
  const rows = result.results ?? [];
  if (!rows.length) return null;
  const patch: Record<string, unknown> = {},
    versions: Record<string, { clientUpdatedAt: string; operationId: string }> =
      {};
  let highest = 0;
  for (const row of rows) {
    patch[row.field_name] = JSON.parse(row.value_json);
    versions[row.field_name] = {
      clientUpdatedAt: row.client_updated_at,
      operationId: row.operation_id,
    };
    highest = Math.max(highest, row.server_sequence);
  }
  return { entityType: type, entityId: id, patch, versions, sequence: highest };
}
async function currentVersions(db: D1Database, owner: string, item: Operation) {
  const fields = Object.keys(item.patch).filter((field) => field.length <= 160);
  if (!fields.length)
    return new Map<string, { clientUpdatedAt: string; operationId: string }>();
  const placeholders = fields.map(() => "?").join(",");
  const result = await db
    .prepare(
      `SELECT field_name, client_updated_at, operation_id FROM sync_field_versions WHERE owner_id = ? AND entity_type = ? AND entity_id = ? AND field_name IN (${placeholders})`,
    )
    .bind(owner, item.entityType, item.entityId, ...fields)
    .all<VersionRow>();
  return new Map(
    (result.results ?? []).map(
      (row) =>
        [
          row.field_name,
          {
            clientUpdatedAt: row.client_updated_at,
            operationId: row.operation_id,
          },
        ] as const,
    ),
  );
}

async function sync(request: Request, env: Env, headers: HeadersInit) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return failure("UNAUTHORIZED", "A Sync Key is required.", 401, headers);
  const key = authorization.slice(7).trim();
  if (key.length < 40 || key.length > 512)
    return failure(
      "INVALID_SYNC_KEY",
      "The Sync Key is invalid.",
      401,
      headers,
    );
  if (Number(request.headers.get("content-length") ?? 0) > 1_000_000)
    return failure(
      "PAYLOAD_TOO_LARGE",
      "Sync payload is too large.",
      413,
      headers,
    );
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return failure(
      "INVALID_JSON",
      "Request body must be valid JSON.",
      400,
      headers,
    );
  }
  if (!input || typeof input !== "object")
    return failure("INVALID_REQUEST", "Invalid sync request.", 400, headers);
  const body = input as {
    cursor?: unknown;
    deviceId?: unknown;
    operations?: unknown;
  };
  if (
    !Number.isInteger(body.cursor) ||
    Number(body.cursor) < 0 ||
    !validText(body.deviceId, 128) ||
    !Array.isArray(body.operations) ||
    body.operations.length > 500
  )
    return failure(
      "INVALID_REQUEST",
      "cursor, deviceId or operations are invalid.",
      400,
      headers,
    );
  const operations = body.operations.map((value) =>
    normalizeOperation(value, String(body.deviceId)),
  );
  if (operations.some((value) => !value))
    return failure(
      "INVALID_OPERATION",
      "One or more operations are invalid.",
      400,
      headers,
    );
  const owner = await ownerId(key, env.SYNC_PEPPER);
  const now = new Date().toISOString();
  const db = env.PLANNER_DB;
  await db
    .prepare(
      "INSERT OR IGNORE INTO sync_owners (owner_id, created_at) VALUES (?, ?)",
    )
    .bind(owner, now)
    .run();
  await db
    .prepare(
      "INSERT OR IGNORE INTO sync_cursors (owner_id, last_sequence) VALUES (?, 0)",
    )
    .bind(owner)
    .run();
  const applied: string[] = [],
    ignored: string[] = [],
    touched = new Set<string>();
  for (const item of operations as Operation[]) {
    const prior = await db
      .prepare(
        "SELECT server_sequence FROM sync_operations WHERE owner_id = ? AND operation_id = ?",
      )
      .bind(owner, item.operationId)
      .first<{ server_sequence: number }>();
    if (prior) {
      const won = await db
        .prepare(
          "SELECT 1 AS found FROM sync_field_versions WHERE owner_id = ? AND operation_id = ? LIMIT 1",
        )
        .bind(owner, item.operationId)
        .first();
      (won ? applied : ignored).push(item.operationId);
      for (const field of Object.keys(item.patch))
        touched.add(entityKey(item.entityType, item.entityId));
      continue;
    }
    const versions = await currentVersions(db, owner, item);
    const winners = Object.entries(item.patch)
      .filter(([field]) => field.length <= 160)
      .filter(([field]) =>
        incomingWins(
          {
            clientUpdatedAt: item.clientUpdatedAt,
            operationId: item.operationId,
          },
          versions.get(field),
        ),
      );
    let seq: number;
    if (winners.length) {
      seq = await sequence(db, owner);
      const operationRecord = db
        .prepare(
          "INSERT INTO sync_operations (owner_id, operation_id, entity_type, entity_id, patch_json, client_updated_at, server_sequence, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          owner,
          item.operationId,
          item.entityType,
          item.entityId,
          JSON.stringify(item.patch),
          item.clientUpdatedAt,
          seq,
          now,
        );
      await db.batch([
        ...winners.map(([field, value]) =>
          db
            .prepare(
              "INSERT INTO sync_field_versions (owner_id, entity_type, entity_id, field_name, value_json, client_updated_at, operation_id, server_sequence, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id, entity_type, entity_id, field_name) DO UPDATE SET value_json=excluded.value_json, client_updated_at=excluded.client_updated_at, operation_id=excluded.operation_id, server_sequence=excluded.server_sequence, updated_at=excluded.updated_at",
            )
            .bind(
              owner,
              item.entityType,
              item.entityId,
              field,
              JSON.stringify(value),
              item.clientUpdatedAt,
              item.operationId,
              seq,
              now,
            ),
        ),
        operationRecord,
      ]);
      applied.push(item.operationId);
    } else {
      const cursor = await db
        .prepare("SELECT last_sequence FROM sync_cursors WHERE owner_id = ?")
        .bind(owner)
        .first<{ last_sequence: number }>();
      seq = cursor?.last_sequence ?? 0;
      await db
        .prepare(
          "INSERT INTO sync_operations (owner_id, operation_id, entity_type, entity_id, patch_json, client_updated_at, server_sequence, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          owner,
          item.operationId,
          item.entityType,
          item.entityId,
          JSON.stringify(item.patch),
          item.clientUpdatedAt,
          seq,
          now,
        )
        .run();
      ignored.push(item.operationId);
    }
    touched.add(entityKey(item.entityType, item.entityId));
  }
  const changed = await db
    .prepare(
      "SELECT DISTINCT entity_type, entity_id FROM sync_field_versions WHERE owner_id = ? AND server_sequence > ? ORDER BY server_sequence LIMIT 5000",
    )
    .bind(owner, body.cursor)
    .all<{ entity_type: string; entity_id: string }>();
  for (const row of changed.results ?? [])
    touched.add(entityKey(row.entity_type, row.entity_id));
  const changes = [];
  for (const value of touched) {
    const [type, id] = value.split("\u0000");
    const change = await fullChange(db, owner, type, id);
    if (change) changes.push(change);
  }
  changes.sort(
    (a, b) =>
      a.sequence - b.sequence ||
      a.entityType.localeCompare(b.entityType) ||
      a.entityId.localeCompare(b.entityId),
  );
  const cursor = await db
    .prepare("SELECT last_sequence FROM sync_cursors WHERE owner_id = ?")
    .bind(owner)
    .first<{ last_sequence: number }>();
  return json(
    {
      ok: true,
      nextCursor: cursor?.last_sequence ?? 0,
      appliedOperationIds: applied,
      ignoredOperationIds: ignored,
      changes,
      serverTime: now,
    },
    200,
    headers,
  );
}

async function googleOwner(request: Request, env: Env, headers: HeadersInit) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return {
      error: failure("UNAUTHORIZED", "A Sync Key is required.", 401, headers),
    };
  const key = authorization.slice(7).trim();
  if (key.length < 40)
    return {
      error: failure(
        "INVALID_SYNC_KEY",
        "The Sync Key is invalid.",
        401,
        headers,
      ),
    };
  return { owner: await ownerId(key, env.SYNC_PEPPER) };
}
async function tokenKey(env: Env) {
  const raw = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(env.GOOGLE_TOKEN_ENCRYPTION_KEY),
  );
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (text: string) =>
  Uint8Array.from(atob(text), (value) => value.charCodeAt(0));
async function encryptToken(value: string, env: Env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await tokenKey(env),
    new TextEncoder().encode(value),
  );
  return { cipher: encode(new Uint8Array(encrypted)), iv: encode(iv) };
}
async function googleStart(request: Request, env: Env, headers: HeadersInit) {
  const auth = await googleOwner(request, env, headers);
  if (auth.error) return auth.error;
  const owner = auth.owner!;
  const state = crypto.randomUUID() + crypto.randomUUID();
  const now = new Date(),
    expires = new Date(now.getTime() + 10 * 60_000).toISOString();
  await env.PLANNER_DB.prepare(
    "INSERT INTO sync_owners (owner_id, created_at) VALUES (?, ?) ON CONFLICT(owner_id) DO NOTHING",
  )
    .bind(owner, now.toISOString())
    .run();
  await env.PLANNER_DB.prepare(
    "INSERT INTO google_oauth_states (state, owner_id, expires_at) VALUES (?, ?, ?)",
  )
    .bind(state, owner, expires)
    .run();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri:
      "https://personal-planner-sync.bashiramri84.workers.dev/v1/google/callback",
    response_type: "code",
    scope:
      "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return json(
    {
      ok: true,
      authorizeUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    },
    200,
    headers,
  );
}
async function googleCallback(request: Request, env: Env) {
  const url = new URL(request.url),
    code = url.searchParams.get("code"),
    state = url.searchParams.get("state");
  const doneUrl = "https://bashiramri.ir/personal-planner/?google=";
  if (!code || !state) return Response.redirect(doneUrl + "failed", 302);
  const row = await env.PLANNER_DB.prepare(
    "SELECT owner_id, expires_at, consumed_at FROM google_oauth_states WHERE state = ?",
  )
    .bind(state)
    .first<{
      owner_id: string;
      expires_at: string;
      consumed_at: string | null;
    }>();
  if (!row || row.consumed_at || new Date(row.expires_at) <= new Date())
    return Response.redirect(doneUrl + "failed", 302);
  await env.PLANNER_DB.prepare(
    "UPDATE google_oauth_states SET consumed_at = ? WHERE state = ? AND consumed_at IS NULL",
  )
    .bind(new Date().toISOString(), state)
    .run();
  const form = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri:
      "https://personal-planner-sync.bashiramri84.workers.dev/v1/google/callback",
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const token = (await response.json()) as { refresh_token?: string };
  if (!response.ok || !token.refresh_token)
    return Response.redirect(doneUrl + "failed", 302);
  const secured = await encryptToken(token.refresh_token, env);
  await env.PLANNER_DB.prepare(
    "INSERT INTO google_connections (owner_id,status,encrypted_refresh_token,token_iv,connected_at,last_error) VALUES (?, 'connected', ?, ?, ?, NULL) ON CONFLICT(owner_id) DO UPDATE SET status='connected',encrypted_refresh_token=excluded.encrypted_refresh_token,token_iv=excluded.token_iv,connected_at=excluded.connected_at,last_error=NULL",
  )
    .bind(row.owner_id, secured.cipher, secured.iv, new Date().toISOString())
    .run();
  return Response.redirect(doneUrl + "connected", 302);
}
async function googleStatus(request: Request, env: Env, headers: HeadersInit) {
  const auth = await googleOwner(request, env, headers);
  if (auth.error) return auth.error;
  const row = await env.PLANNER_DB.prepare(
    "SELECT status, connected_at, last_sync_at, last_error FROM google_connections WHERE owner_id = ?",
  )
    .bind(auth.owner!)
    .first();
  return json(
    { ok: true, connection: row ?? { status: "disconnected" } },
    200,
    headers,
  );
}
async function decryptToken(cipher: string, iv: string, env: Env) {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decode(iv) },
    await tokenKey(env),
    decode(cipher),
  );
  return new TextDecoder().decode(plain);
}
async function googleAccess(owner: string, env: Env) {
  const row = await env.PLANNER_DB.prepare(
    "SELECT encrypted_refresh_token, token_iv FROM google_connections WHERE owner_id=? AND status='connected'",
  )
    .bind(owner)
    .first<{ encrypted_refresh_token: string; token_iv: string }>();
  if (!row) throw new Error("Google Calendar is not connected.");
  const form = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: await decryptToken(
      row.encrypted_refresh_token,
      row.token_iv,
      env,
    ),
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const data = (await response.json()) as { access_token?: string };
  if (!response.ok || !data.access_token)
    throw new Error("Google authorization needs to be reconnected.");
  return data.access_token;
}
async function googleCalendars(
  request: Request,
  env: Env,
  headers: HeadersInit,
) {
  const auth = await googleOwner(request, env, headers);
  if (auth.error) return auth.error;
  const owner = auth.owner!,
    token = await googleAccess(owner, env);
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    { headers: { authorization: `Bearer ${token}` } },
  );
  const data = (await response.json()) as {
    items?: { id: string; summary: string; accessRole?: string }[];
  };
  if (!response.ok) throw new Error("Google calendars could not be read.");
  for (const calendar of data.items ?? [])
    await env.PLANNER_DB.prepare(
      "INSERT INTO google_calendars (owner_id,calendar_id,summary,writable) VALUES (?,?,?,?) ON CONFLICT(owner_id,calendar_id) DO UPDATE SET summary=excluded.summary,writable=excluded.writable",
    )
      .bind(
        owner,
        calendar.id,
        calendar.summary,
        ["owner", "writer"].includes(calendar.accessRole ?? "") ? 1 : 0,
      )
      .run();
  return json({ ok: true, calendars: data.items ?? [] }, 200, headers);
}

async function googleEvents(request: Request, env: Env, headers: HeadersInit) {
  const auth = await googleOwner(request, env, headers);
  if (auth.error) return auth.error;
  const owner = auth.owner!, token = await googleAccess(owner, env);
  const rows = await env.PLANNER_DB.prepare("SELECT calendar_id, writable FROM google_calendars WHERE owner_id=? ORDER BY selected_input DESC, summary").bind(owner).all<{calendar_id:string;writable:number}>();
  const appointments: unknown[] = [];
  for (const calendar of rows.results ?? []) {
    const query = new URLSearchParams({singleEvents:"true",showDeleted:"false",maxResults:"2500",timeMin:new Date(Date.now()-90*86400000).toISOString(),timeMax:new Date(Date.now()+365*86400000).toISOString()});
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.calendar_id)}/events?${query}`, {headers:{authorization:`Bearer ${token}`}});
    const data = await response.json() as {items?:any[]}; if (!response.ok) continue;
    for (const event of data.items ?? []) {const allDay=Boolean(event.start?.date);const start=allDay?new Date(`${event.start.date}T00:00:00`):new Date(event.start.dateTime);const end=allDay?new Date(`${event.end.date}T00:00:00`):new Date(event.end.dateTime);const day=allDay?event.start.date:new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran"}).format(start);const minute=(date:Date)=>{const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Tehran",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(date);return Number(p.find(x=>x.type==="hour")?.value)*60+Number(p.find(x=>x.type==="minute")?.value)};appointments.push({id:`google:${calendar.calendar_id}:${event.id}`,title:event.summary||"(Untitled)",day,start:allDay?0:minute(start),end:allDay?1440:minute(end),blocking:!allDay&&event.transparency!=="transparent",description:event.description,location:event.location,allDay,source:"google",googleCalendarId:calendar.calendar_id,googleEventId:event.id,googleUpdated:event.updated,googleUrl:event.htmlLink,readOnly:!calendar.writable});}
  }
  await env.PLANNER_DB.prepare("UPDATE google_connections SET last_sync_at=?,last_error=NULL WHERE owner_id=?").bind(new Date().toISOString(),owner).run();
  return json({ok:true,appointments},200,headers);
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url),
      origin = request.headers.get("origin"),
      headers = cors(origin);
    if (origin && !allowedOrigins.has(origin))
      return failure(
        "ORIGIN_NOT_ALLOWED",
        "This origin is not allowed.",
        403,
        headers,
      );
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method === "GET" && url.pathname === "/health")
      return json(
        { service: "personal-planner-sync", status: "ready", schema: 1 },
        200,
        headers,
      );
    if (request.method === "GET" && url.pathname === "/v1/google/callback")
      try {
        return await googleCallback(request, env);
      } catch {
        return Response.redirect(
          "https://bashiramri.ir/personal-planner/?google=failed",
          302,
        );
      }
    if (request.method === "POST" && url.pathname === "/v1/google/start")
      try {
        return await googleStart(request, env, headers);
      } catch {
        return failure(
          "GOOGLE_START_FAILED",
          "Google connection could not be started.",
          500,
          headers,
        );
      }
    if (request.method === "GET" && url.pathname === "/v1/google/status")
      try {
        return await googleStatus(request, env, headers);
      } catch {
        return failure(
          "GOOGLE_STATUS_FAILED",
          "Google connection status could not be read.",
          500,
          headers,
        );
      }
    if (request.method === "GET" && url.pathname === "/v1/google/calendars")
      try {
        return await googleCalendars(request, env, headers);
      } catch {
        return failure(
          "GOOGLE_CALENDARS_FAILED",
          "Google calendars could not be read. Reconnect if access expired.",
          500,
          headers,
        );
      }
      if (request.method === "GET" && url.pathname === "/v1/google/events")
        try { return await googleEvents(request, env, headers); }
        catch { return failure("GOOGLE_EVENTS_FAILED", "Google events could not be read. Reconnect if access expired.", 500, headers); }
    if (request.method === "POST" && url.pathname === "/v1/sync")
      try {
        return await sync(request, env, headers);
      } catch {
        return failure(
          "INTERNAL_ERROR",
          "Sync could not be completed.",
          500,
          headers,
        );
      }
    return failure("NOT_FOUND", "Endpoint not found.", 404, headers);
  },
};
