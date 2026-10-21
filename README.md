# 🌊 Darkflow 🛠️

**A local, inspectable change-control workbench for software projects.** Darkflow is being built so teams can describe a change, prepare it in an isolated worktree, run project-specific checks, inspect every diff, and explicitly apply the reviewed result.

Darkflow is intended to make AI-assisted project work auditable and reusable. It does not treat a model's answer as a patch to trust blindly: the proposal, touched paths, exact checks, outputs, and final diff remain visible before changes reach the original working tree.

## 🧰 Project files

| File | Purpose |
|---|---|
| [`darkflow.conf`](./darkflow.conf) | Structured project policy: scope, provider, workflow mode, checks, permissions, telemetry. |
| [`DARKFLOW.md`](./DARKFLOW.md) | Human-facing workflow, review guarantees, monitoring behavior, and update guidance. |
| `src-tauri/` | Rust desktop shell and privileged project operations. |
| `src/` | React control panel and telemetry views. |

## 🚦 Current prototype

The first control-panel slice provides a project dashboard, task and acceptance-criteria inputs, allowed-path entry, provider and network controls, project inspection, a reviewed request packet, local request saving, and session-local telemetry. The Rust backend can inspect a selected project, parse `darkflow.conf`, read Git branch/status, and save request packets into Darkflow's private app-data directory.

The execution engine is not connected yet. Darkflow does not create isolated worktrees, invoke an agent, execute project checks, calculate or display diffs, or apply patches. The screen describes that intended lifecycle, but this prototype cannot generate or apply source changes. See [`WORKLIST.md`](WORKLIST.md) and [the roadmap](docs/ROADMAP.md) for the remaining implementation gates.

## 🛠️ Development

Requirements: Rust toolchain, Node.js/npm, and Tauri's platform prerequisites. On Linux, Tauri uses the system WebKitGTK and GTK development libraries. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for OS access and UI-framework decisions.

```sh
npm install
npm run dev
```

To build the desktop app after the Tauri CLI is installed:

```sh
npm run tauri dev
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
```

## 🔐 Safety contract

- The current prototype does not edit project files or run configured commands.
- Before execution is implemented, isolate proposals in disposable Git worktrees and keep network access disabled by default.
- Keep project operations in narrow Rust commands; never grant the WebView broad shell access.
- The future apply operation must require a reviewed, current diff and must never commit, push, or deploy.
- Protect `.github/workflows/**`, lockfiles, and configured paths unless the user explicitly includes them in the reviewed change.

## 🧪 Checks

Each project config can declare checks and scope. The prototype parses check definitions but does not execute them or report check outcomes. Command, working directory, timing, exit status, and bounded output capture must be implemented before a failed-check gate can be meaningful.

## 📚 Docs

- [Architecture and framework decisions](docs/ARCHITECTURE.md)
- [Implementation worklist](WORKLIST.md)
- [Contributor workflow and commit format](CONTRIBUTING.md)
- [Logo and image directions](brand/logo-directions.html)
- [Configuration format](docs/CONFIGURATION.md)
- [Local telemetry and privacy](docs/TELEMETRY.md)
- [Security model](docs/SECURITY.md)
- [Roadmap](docs/ROADMAP.md)

## 🔗 Project

[GitHub: cybercoretech/darkflow](https://github.com/cybercoretech/darkflow)
