-- Google Calendar connection metadata. Existing planner and sync data is untouched.
CREATE TABLE IF NOT EXISTS google_connections (
  owner_id TEXT PRIMARY KEY REFERENCES sync_owners(owner_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'disconnected',
  email TEXT,
  encrypted_refresh_token TEXT,
  token_iv TEXT,
  connected_at TEXT,
  last_sync_at TEXT,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS google_oauth_states (
  state TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES sync_owners(owner_id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS google_oauth_states_expiry ON google_oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS google_calendars (
  owner_id TEXT NOT NULL REFERENCES sync_owners(owner_id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  writable INTEGER NOT NULL DEFAULT 0,
  selected_input INTEGER NOT NULL DEFAULT 0,
  selected_output INTEGER NOT NULL DEFAULT 0,
  sync_token TEXT,
  PRIMARY KEY (owner_id, calendar_id)
);

CREATE TABLE IF NOT EXISTS google_event_links (
  owner_id TEXT NOT NULL REFERENCES sync_owners(owner_id) ON DELETE CASCADE,
  planner_appointment_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  etag TEXT,
  google_updated TEXT,
  base_json TEXT,
  deleted_at TEXT,
  PRIMARY KEY (owner_id, planner_appointment_id),
  UNIQUE (owner_id, calendar_id, event_id)
);
