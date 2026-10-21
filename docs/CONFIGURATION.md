# 🧾 `darkflow.conf`

`darkflow.conf` is a versioned TOML file at the project root. It is structured policy, not prose. `DARKFLOW.md` carries human instructions and update notes.

## Initial schema

```toml
schema = "darkflow.project/v1"
name = "Example"

[workflow]
provider = "codex"
mode = "isolated-worktree"
require_clean_worktree = true
require_review_before_apply = true
allow_network = false
telemetry = "local-only"

[scope]
include = ["src/**", "tests/**"]
exclude = ["target/**", "node_modules/**", ".git/**"]
protected = [".github/workflows/**", "Cargo.lock"]

[[checks]]
id = "tests"
label = "Test suite"
command = "cargo test"
timeout_seconds = 900
required = true
```

The prototype parses project name, workflow mode, and check summaries. It does not currently enforce the scope or execute configured commands. In the planned workflow, commands will be displayed and executed only in the isolated proposal worktree. A later schema should represent executables and argument arrays separately to avoid shell parsing. Arbitrary shell text must never be interpolated with task input.

## Migration rules

- Reject unknown schema versions rather than guessing.
- Preserve the original file and report line/column when parsing fails.
- Require unique check IDs and bounded timeout values.
- Resolve paths relative to the repository root and reject paths escaping it.
- Require explicit review when a change touches protected paths.
- Add a fixture and migration note for every schema evolution.
