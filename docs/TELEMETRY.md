# 📡 Local telemetry and monitoring

Darkflow's prototype telemetry is local-only and records a small set of UI/session events, not source code. Proposal lifecycle, check outcomes, durations, provider health, and changed-line metrics below are planned metrics; they are not yet collected because the execution engine is not connected.

## Dashboard metrics

- proposals created, reviewed, applied, discarded, and blocked;
- configured checks passed/failed/skipped, duration, timeout, and exit code;
- changed-file counts and added/deleted line counts;
- provider availability and operation latency;
- current project health and last successful check run.

## Privacy rules

- Never upload project names, paths, source code, prompts, diffs, or command output by default.
- Keep detailed logs and proposal snapshots on the machine.
- Offer retention settings and a clear “clear local history” action.
- Redact credentials and home-directory paths from exportable diagnostics.
- Any future remote telemetry requires an explicit opt-in and per-project configuration.

The prototype will start with structured `tracing` spans and in-memory dashboard counters. Persistent metrics can be added after event semantics and retention are settled.
