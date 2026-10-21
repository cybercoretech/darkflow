# 🧱 Architecture and technology choices

## Application shape

Darkflow uses Tauri 2 for the cross-platform desktop shell, a Rust core for project inspection and filesystem/Git operations, and React in the WebView for a dense, highly styled control panel. The UI sends typed requests to narrow Rust commands. Rust owns all privileged operations and returns structured results; the frontend never receives general-purpose filesystem or shell access.

The workflow boundary is deliberately explicit:

```text
Project + darkflow.conf + DARKFLOW.md
                ↓
      task / constraints / criteria
                ↓
 isolated worktree + agent proposal
                ↓
 exact configured checks + telemetry
                ↓
 diff / output / scope / risk review
                ↓ explicit apply
       original working tree only
```

The change-provider interface should support Codex CLI first and allow other local providers later. It must never run directly against the original worktree. The app should capture the baseline commit and working-tree state, then refuse application if the destination changed before review.

The prototype currently reaches through the request-record stage and the first worktree boundary: it captures commit/status, creates a detached worktree at the captured commit, persists its manifest under app data, and allows explicit cleanup. It does not yet invoke a provider, run checks, produce a patch, or apply one.

## Why Tauri + React

Tauri provides OS-level desktop integration with a Rust backend while rendering the UI in the platform WebView. UI design flexibility is high: standard HTML, CSS, SVG, WebGL/canvas, React, and web accessibility tooling are available. Tailwind handles the project design tokens and responsive layout; Motion for React handles restrained transitions; Radix primitives supply accessible dialogs, selects, checkboxes, and tabs. These are the unstyled primitives behind the shadcn/ui approach, so components can use a custom Darkflow identity rather than a generic theme.

OS access is available through Rust and explicitly enabled Tauri plugins: project-folder selection, scoped filesystem operations, notifications, app data storage, and process/check management. Tauri capabilities deny dangerous plugin commands by default. Keep the frontend permission set narrow, and run checks via a dedicated Rust command with an explicit executable/argument policy rather than broad WebView shell permission. The app must show the command and working directory before execution.

On Linux, the desktop shell relies on GTK/WebKitGTK system libraries. Windows uses WebView2; macOS uses WKWebView. This keeps the app relatively small while allowing the web UI to remain highly expressive. It does mean native platform widgets are not the primary visual layer.

## Dependency choices

- **Tokio:** use Tauri's async runtime for long-running checks, file watching, and cancellation. Add direct Tokio APIs only where needed; avoid blocking the UI command thread.
- **tracing:** include from the start for structured, local operation spans and duration/error telemetry.
- **tauri-plugin-store:** not installed yet. The reviewed request record is written by a narrow Rust command into Darkflow's private app-data directory. Add Store later if recent-project and UI preference persistence needs a key/value API; keep project policy in `darkflow.conf`.
- **tauri-specta:** introduce when the command API stabilizes and generated TypeScript bindings pay for themselves. Early prototype commands can remain small, serialized DTOs; avoid coupling every UI iteration to code generation now.
- **diagprint:** integrate at the diagnostics boundary once Darkflow has concrete diagnostic types. It is a good fit for consistent actionable errors and report output; keep tracing as the runtime instrumentation layer.
- **resvg + image:** added behind the optional `asset-tools` Cargo feature for future deterministic SVG previews, thumbnails, resizing, and format fixes. They are not enabled in the default app build; the first slice keeps asset editing out of the workflow engine.
- **Taffy:** added behind `native-layout-experiment`. Do not use it for the Tauri screen layout: HTML/CSS already handles the React WebView. The feature is reserved for a Rust-rendered canvas/layout experiment if Darkflow later needs one.
- **Tailwind CSS 4:** included for styling and design tokens.
- **Motion:** included using `motion/react`; this is the current package/API name for Framer Motion.
- **Radix UI:** included as accessible unstyled primitives. A shadcn/ui-like layer can be composed locally with Darkflow-specific styling.

## Command palette and debugging

`cmdk` is the right React command layer for the global keyboard palette. Keep palette actions explicit: switch views/projects, prepare a request, inspect status, start checks, and open telemetry. Tauri's built-in WebView inspector is available during development, `@vitejs/plugin-react` supplies Vite Fast Refresh, and Rust `tracing` can provide local spans. Darkflow's telemetry view should correlate operation names, durations, and outcomes without recording source, prompts, or command arguments.

I did not add a standalone devtools event server. The current TanStack Devtools Vite plugin starts a separate server with a fixed port and no host-binding option in its public config, so it may listen beyond loopback. That is unnecessary for the initial app and could expose debug events on a local network. I also did not add `tauri-plugin-devtools`: its upstream project currently documents Tauri 1.x and a noncommercial license for the UI package, which is a poor fit for this open-source tool. Revisit a dev-only inspector if a maintained, Tauri 2-compatible option with clear licensing and loopback-only transport becomes available.

## Pure-Rust UI alternatives

### Iced

Iced is a cross-platform Rust GUI library inspired by The Elm Architecture. It models state, messages, update, and view as explicit Rust pieces, which can be appealing for predictable application logic and a fully Rust UI. Its ecosystem includes native widgets and custom styling, but building a dense, polished workbench with the same breadth of web components, animations, charts, and theme iteration requires more Rust widget work. Its current documentation describes it as experimental, so validate the exact components and platform needs before choosing it for a production product. See [Iced docs](https://docs.iced.rs/iced/index.html) and [Iced book](https://book.iced.rs/first-steps.html).

### egui

egui is a pure-Rust immediate-mode GUI that runs natively and in browsers. It is quick to prototype, simple to instrument, and particularly strong for tools, inspectors, dashboards, and visualization-heavy interfaces. Its immediate-mode model is different from a conventional retained UI, and it does not aim for a native-looking interface; a large form-rich control panel is possible but needs custom visual and accessibility work. See [egui](https://github.com/emilk/egui).

For Darkflow's branded multi-pane control panel, React + Tauri gives the strongest visual iteration and component ecosystem. Iced or egui remain valid alternatives if a strict Rust-only interface becomes more important than frontend ecosystem and pixel-level web styling.
