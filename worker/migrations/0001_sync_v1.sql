-- Additive, idempotent baseline for the existing personal-planner-sync database.
-- No table or user data is removed.
CREATE TABLE IF NOT EXISTS sync_owners (
  owner_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_cursors (
  owner_id TEXT PRIMARY KEY,
  sequence INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (owner_id) REFERENCES sync_owners(owner_id)
);

CREATE TABLE IF NOT EXISTS sync_operations (
  owner_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  patch_json TEXT NOT NULL,
  client_updated_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  sequence INTEGER,
  status TEXT NOT NULL,
  PRIMARY KEY (owner_id, operation_id)
);

CREATE INDEX IF NOT EXISTS sync_operations_owner_sequence ON sync_operations(owner_id, sequence);

CREATE TABLE IF NOT EXISTS sync_field_versions (
  owner_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  value_json TEXT NOT NULL,
  client_updated_at TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  PRIMARY KEY (owner_id, entity_type, entity_id, field_name)
);

CREATE INDEX IF NOT EXISTS sync_field_versions_owner_sequence ON sync_field_versions(owner_id, sequence);
