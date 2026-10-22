#!/usr/bin/env bash
# Build the Darkflow website into site/: the landing page (static, already in
# site/) plus the Field Manual (mdBook) into site/docs.
#
# mdBook copies every non-Markdown file under its source folder into the
# output, so the book is built from a staging copy that holds only the docs,
# never the repository root (node_modules, src-tauri, dist...).
set -euo pipefail
cd "$(dirname "$0")/.."
STAGE=build/book-src
rm -rf "$STAGE" site/docs
mkdir -p "$STAGE/docs"
cp book/SUMMARY.md README.md DARKFLOW.md WORKLIST.md CONTRIBUTING.md CHANGELOG.md "$STAGE/"
cp docs/*.md "$STAGE/docs/"
# Links to repository files that aren't chapters (darkflow.conf, brand/...) would
# break on the website; point them at the file on GitHub instead.
python3 - "$STAGE" <<'PY'
import pathlib, re, sys
stage = pathlib.Path(sys.argv[1])
repo = pathlib.Path(".").resolve()
blob = "https://github.com/cybercoretech/darkflow/blob/main/"
for md in stage.rglob("*.md"):
    rel_dir = md.parent.relative_to(stage)
    def fix(m):
        text, target = m.group(1), m.group(2)
        path = target.split("#")[0]
        if not path or re.match(r"^[a-z]+:", path) or path.startswith("/") or path.endswith(".md"):
            return m.group(0)
        repo_path = (repo / rel_dir / path).resolve()
        return f"[{text}]({blob}{repo_path.relative_to(repo)})" if repo_path.exists() else m.group(0)
    md.write_text(re.sub(r"\[([^\]]*)\]\(([^)\s]+)\)", fix, md.read_text()))
PY
mdbook build
# additional-css lands at site/docs/site/theme/; its fonts resolve to ../assets/.
mkdir -p site/docs/site
cp -r site/assets site/docs/site/assets
echo "built site/ (landing) and site/docs/ (Field Manual)"
