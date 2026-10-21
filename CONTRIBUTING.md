# 🤝 Contributing to Darkflow

## 🧭 Change workflow

1. Read `README.md`, `DARKFLOW.md`, `docs/ARCHITECTURE.md`, and `docs/SECURITY.md` before changing workflow or permission boundaries.
2. Keep project policy in `darkflow.conf`; keep human process and update notes in `DARKFLOW.md`.
3. Update `WORKLIST.md`, `docs/ROADMAP.md`, and the relevant README, Wiki page, and Blackbox Notes entry when implementation status changes.
4. Never describe a planned workflow as implemented. Current Darkflow does not yet generate or apply project code.
5. Run the relevant checks and report any unavailable platform or packaging check precisely.
6. Stage only the files for this change. Preserve unrelated edits in the shared Wiki and notes repositories.

## 🧪 Local checks

```sh
npm run check
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --features asset-tools,native-layout-experiment
git diff --check
```

Build the Linux Debian/RPM packages with `npm run tauri -- build --bundles deb,rpm` when changing desktop integration or release packaging.

## 📝 Commit messages

Use a specific subject and a body that records what changed, why it changed, the checks that passed, and anything that remains unverified. End each commit with the project attribution line, a blank line, and the co-author trailer exactly as shown:

```text
👻 Code & Design by Darkstardevx 🤖 Generated with Claude Code

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
