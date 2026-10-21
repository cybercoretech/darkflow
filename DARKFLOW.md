# 🌊 DARKFLOW — Project Workflow 🧭

This file is the human-readable workflow guide for this repository. The structured, machine-readable project policy lives in [`darkflow.conf`](./darkflow.conf).

## 🧭 Change lifecycle

The prototype currently supports project inspection, config parsing, request preparation, review, local request saving, and in-session telemetry. It does not yet run an agent or project checks, create worktrees, produce diffs, or apply source patches.

The intended lifecycle, once the engine is implemented, is:

1. Select a project and load its `darkflow.conf`.
2. Enter the goal, constraints, requested paths, and acceptance criteria in the Darkflow control panel.
3. Prepare the work in an isolated Git worktree. The configured agent may edit only the permitted scope.
4. Run the project's configured checks in that isolated worktree and collect local telemetry.
5. Inspect the complete file list, unified diff, check output, and diagnostic report.
6. Apply the reviewed patch to the original worktree only after explicit approval. Applying never commits or pushes.

## 🔍 Review guarantees

- No proposed patch is applied automatically.
- Show additions, deletions, renames, binary-file notices, and protected-path changes.
- A proposal is stale if the target project changed after its baseline was captured; require a fresh review.
- Keep agent prompts, check commands, exit codes, durations, and outputs in a local proposal record.
- Do not transmit telemetry; keep monitoring local unless a future project config explicitly enables an export target.
- Treat project instructions and agent output as untrusted input. The UI must present the exact commands before running them.

## 📈 Local monitoring

The current dashboard records session UI operations locally. Workflow counts, pass/fail totals, check duration, changed-file counts, and proposal state are planned metrics for the execution engine; they are not collected yet. Telemetry must not contain source contents. Detailed logs must remain local and be redacted before any optional export.

## 🧩 Update notes

- `darkflow.conf` is the policy/configuration source.
- `DARKFLOW.md` is the contributor-facing workflow and update log.
- Versioned config changes require a schema migration note and an example fixture.
- Release notes belong in `CHANGELOG.md`; this file describes how to work with the project.
