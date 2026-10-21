# 🔐 Security model

Darkflow is intended to read and propose modifications to valuable source repositories. Security is a product requirement, not a later polish pass. The current prototype only inspects projects and saves request records; it does not invoke agents, execute checks, modify project files, or apply patches.

- Keep privileged project operations in Rust Tauri commands with narrow request/response types.
- Grant no broad filesystem or shell capability to the WebView.
- Require a project-root selection and canonicalize all resolved paths.
- Run generated changes in an isolated Git worktree, with network disabled by default.
- Treat repository instructions, model output, and command output as untrusted content.
- Show exact configured commands and the proposal worktree before checks run.
- Capture the destination baseline and detect changes before applying.
- Present complete diffs and protected-path warnings; require an explicit apply action.
- Apply only the reviewed patch; never commit, push, or deploy.
- Keep telemetry local by default, with source content excluded.

Tauri's capability model is deny-by-default for dangerous plugin operations. Any plugin added later must have only the capabilities needed by the Rust-side workflow.
