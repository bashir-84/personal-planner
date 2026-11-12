# Settings

Settings schema version 1 is stored inside the existing local planner state. Loading an older state fills missing settings from the defaults without modifying tasks, projects, appointments, plans, completion history, or manual capacity entries.

| Setting | Default | Operational effect |
| --- | --- | --- |
| Work start / end | 09:00 / 24:00 | Free intervals, capacity, slot fitting, deadline checks, day timeline |
| Work budget | Exact `2/3` | Automatic task budget after overlapping appointments are merged |
| Active work days | All seven days | Inactive days have zero automatic capacity; a manual daily budget remains allowed with a warning |
| New task duration | 30 minutes | New tasks only |
| New deadline type / time | None / 12:00 | New task editor only; existing tasks are unchanged |
| Week starts | Saturday | Weekly navigation and planning views |
| Calendar / time zone | Persian / Asia/Tehran | Fixed read-only values because the date pipeline is currently Tehran-specific |
| Suggestion horizon | 7 days, range 1–30 | Candidate days for planning |
| Preserve manual layout | On | Reuses manual/current positions as preferences; feasibility is always recalculated |
| Show reasons | On | Controls reason text only; warnings and feasibility remain enabled |
| Show comparison | On | Controls the current-versus-proposed change list; comparison is still calculated |
| Manual capacity mode | Remaining work budget | Fixed read-only mode backed by timestamped manual entries |
| Recurrence horizon | 7 days, range 1–90 | How far recurring instances are generated; existing instances are retained |

The engine's current priority weights remain centralized in `priorityScore`: importance 12, urgency 8, hard deadline 14, deadline proximity up to 12, and last fitting day 20. They are not exposed as settings because changing them safely needs a separate scoring design and acceptance suite.

Full JSON backup includes the versioned settings and background alongside planner data. Import validates the container and core collections, shows a count preview, and replaces data only after explicit confirmation. Raw planner-state JSON from before the backup wrapper is accepted and migrated.
