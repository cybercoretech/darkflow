import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import * as Checkbox from "@radix-ui/react-checkbox";
import { motion } from "motion/react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, BookOpen, Check, ChevronDown, CircleHelp,
  Clock3, FileCode2, Files, FolderOpen, Gauge, GitBranch, History,
  LayoutDashboard, ListChecks, LockKeyhole, Plus, Radio, Search, Settings2, ShieldCheck,
  Sparkles, TerminalSquare, Workflow, X,
} from "lucide-react";

type CheckSummary = { id: string; label: string; command: string; required: boolean };
type ProjectSnapshot = {
  root: string; name: string; configFound: boolean; workflowMode: string;
  checks: CheckSummary[]; gitBranch: string | null; changedFiles: number;
};
type NavKey = "overview" | "proposals" | "telemetry" | "project";
type Packet = { id: string; projectRoot: string; task: string; criteria: string; paths: string; provider: string; network: boolean; createdAt: string; saved?: boolean };
type ProposalWorkspace = { id: string; projectRoot: string; worktreePath: string; baseCommit: string; baseBranch: string | null; originalChangedFiles: number; createdAtMs: number };
type SessionEvent = { time: string; timestamp: number; kind: string; tone: string; message: string; tag: string };

const demoProject: ProjectSnapshot = {
  root: "/home/raven/Devspace/Cybercore/tooling/darkflow", name: "Darkflow", configFound: true,
  workflowMode: "isolated-worktree", gitBranch: "main", changedFiles: 0,
  checks: [
    { id: "frontend-build", label: "Frontend typecheck + production build", command: "npm run check", required: true },
    { id: "rust-tests", label: "Rust tests", command: "cargo test --manifest-path src-tauri/Cargo.toml", required: true },
    { id: "diff-hygiene", label: "Whitespace and conflict-marker check", command: "git diff --check", required: true },
  ],
};
const emptyProject: ProjectSnapshot = { root: "", name: "Select a project", configFound: false, workflowMode: "isolated-worktree", checks: [], gitBranch: null, changedFiles: 0 };
const navItems: { key: NavKey; label: string; icon: typeof LayoutDashboard; shortcut?: string }[] = [
  { key: "overview", label: "Command deck", icon: LayoutDashboard, shortcut: "⌘1" },
  { key: "proposals", label: "Change proposals", icon: Workflow, shortcut: "⌘2" },
  { key: "telemetry", label: "Telemetry", icon: Activity, shortcut: "⌘3" },
  { key: "project", label: "Project profile", icon: Settings2, shortcut: "⌘4" },
];

function App() {
  const [page, setPage] = useState<NavKey>("overview");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [projectPath, setProjectPath] = useState("");
  const [task, setTask] = useState("");
  const [criteria, setCriteria] = useState("");
  const [paths, setPaths] = useState("src/**, tests/**");
  const [provider, setProvider] = useState("Codex CLI");
  const [network, setNetwork] = useState(false);
  const [packet, setPacket] = useState<Packet | null>(null);
  const [proposalWorkspaces, setProposalWorkspaces] = useState<ProposalWorkspace[]>([]);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [desktop, setDesktop] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [eventRows, setEventRows] = useState<SessionEvent[]>(() => {
    const now = Date.now();
    return [{ time: new Date(now).toLocaleTimeString([], { hour12: false }), timestamp: now, kind: "SESSION", tone: "cyan", message: "Darkflow local interface session started", tag: "LOCAL" }];
  });

  useEffect(() => {
    setDesktop("__TAURI_INTERNALS__" in window);
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setPaletteOpen((value) => !value);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault(); createPacket();
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [task, criteria, paths]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    void invoke<ProposalWorkspace[]>("list_proposal_workspaces")
      .then(setProposalWorkspaces)
      .catch((error) => setNotice(`Could not load proposal worktrees: ${String(error)}`));
  }, []);

  const current = project || (desktop ? emptyProject : demoProject);
  const chartHeights = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => 0);
    const now = Date.now();
    for (const event of eventRows) {
      const age = now - event.timestamp;
      if (age >= 0 && age < 15 * 60_000) {
        const bucket = Math.min(23, 23 - Math.floor(age / (15 * 60_000 / 24)));
        buckets[bucket] += 1;
      }
    }
    return buckets.map((count) => count ? Math.min(100, 18 + count * 26) : 3);
  }, [eventRows]);

  function recordEvent(kind: string, tone: string, message: string, tag: string) {
    const now = Date.now();
    setEventRows((rows) => [{ time: new Date(now).toLocaleTimeString([], { hour12: false }), timestamp: now, kind, tone, message, tag }, ...rows].slice(0, 100));
    setLastRefresh(new Date(now));
  }

  async function chooseProject() {
    try {
      const selected = await open({ directory: true, multiple: false, title: "Select a project repository" });
      if (typeof selected === "string") await inspect(selected);
    } catch (error) { setNotice(`Folder picker unavailable: ${String(error)}`); }
  }

  async function inspect(path = projectPath) {
    if (!path.trim()) { setNotice("Choose or enter a project root first."); return; }
    try {
      if (desktop) {
        const result = await invoke<ProjectSnapshot>("inspect_project", { root: path.trim() });
        setProject(result); setProjectPath(result.root); setNotice(`Project inspected · ${result.checks.length} configured checks`);
        recordEvent("PROJECT", result.configFound ? "green" : "amber", result.configFound ? `Loaded ${result.name} profile · ${result.checks.length} checks` : `Inspected ${result.name} · darkflow.conf not found`, result.configFound ? "READ" : "WARN");
      } else {
        setProject({ ...demoProject, root: path.trim(), name: path.split("/").filter(Boolean).at(-1) || "Project" });
        setNotice("Preview mode · project inspection is available in the desktop runtime.");
        recordEvent("PREVIEW", "amber", "Browser preview selected a sample project profile", "DEMO");
      }
      setLastRefresh(new Date());
    } catch (error) { setNotice(String(error)); recordEvent("PROJECT", "amber", "Project inspection failed", "ERROR"); }
  }

  function createPacket() {
    if (!task.trim()) { setNotice("Add a task goal before building a review packet."); return; }
    if (desktop && !project) { setNotice("Inspect a project root before preparing its request."); setPage("project"); return; }
    const request = { id: crypto.randomUUID(), projectRoot: current.root, task: task.trim(), criteria: criteria.trim(), paths: paths.trim(), provider, network, createdAt: new Date().toISOString(), saved: false };
    setPacket(request);
    setPage("proposals"); setNotice("Request packet ready for review · nothing has been written to the project.");
    recordEvent("REQUEST", "cyan", "Change request prepared for review", "REVIEW");
  }

  async function savePacket() {
    if (!packet) return;
    try {
      const payload = { id: packet.id, projectRoot: packet.projectRoot, task: packet.task, acceptanceCriteria: packet.criteria, allowedPaths: packet.paths, provider: packet.provider, allowNetwork: packet.network, createdAt: packet.createdAt };
      if (desktop) await invoke("save_request_packet", { packet: payload });
      else window.localStorage.setItem(`darkflow.request.${packet.id}`, JSON.stringify(payload));
      setPacket({ ...packet, saved: true });
      setNotice("Reviewed request saved to Darkflow’s local app data. Project source is unchanged.");
      recordEvent("REQUEST", "green", "Reviewed request record saved locally", "SAVED");
    } catch (error) { setNotice(`Could not save request: ${String(error)}`); recordEvent("REQUEST", "amber", "Local request save failed", "ERROR"); }
  }

  async function createWorkspace() {
    if (!packet || !packet.saved || !desktop) return;
    setWorkspaceBusy(true);
    try {
      const workspace = await invoke<ProposalWorkspace>("create_proposal_workspace", { projectRoot: packet.projectRoot, requestId: packet.id });
      setProposalWorkspaces((items) => [...items.filter((item) => item.id !== workspace.id), workspace]);
      setNotice(`Isolated baseline created at ${workspace.baseCommit.slice(0, 12)}. No agent or project checks were run.`);
      recordEvent("WORKTREE", "green", "Detached proposal worktree created at captured HEAD", "READY");
    } catch (error) {
      setNotice(String(error));
      recordEvent("WORKTREE", "amber", "Proposal worktree preparation failed", "BLOCKED");
    } finally { setWorkspaceBusy(false); }
  }

  async function discardWorkspace(workspace: ProposalWorkspace) {
    if (!window.confirm(`Discard the isolated proposal worktree for ${workspace.id.slice(0, 8)}? Any files created inside that disposable worktree will be removed.`)) return;
    try {
      await invoke("discard_proposal_workspace", { proposalId: workspace.id });
      setProposalWorkspaces((items) => items.filter((item) => item.id !== workspace.id));
      setNotice("Proposal worktree and its local manifest were removed. The source project was unchanged.");
      recordEvent("WORKTREE", "cyan", "Isolated proposal worktree discarded", "CLEANED");
    } catch (error) {
      setNotice(String(error));
      recordEvent("WORKTREE", "amber", "Proposal worktree cleanup failed", "ERROR");
    }
  }

  const activeNav = navItems.find((item) => item.key === page)!;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><div className="brand-mark"><span>DF</span><i /></div><div><strong>DARKFLOW</strong><small>CHANGE CONTROL SYSTEM</small></div></div>
      <div className="workspace-switcher"><div className="workspace-dot">C</div><div><small>ACTIVE WORKSPACE</small><strong>CYBERCORE SYSTEMS</strong></div><ChevronDown size={14} /></div>
      <div className="side-label">CONTROL SURFACE</div>
      <nav className="nav-list" aria-label="Main navigation">{navItems.map((item) => <button key={item.key} className={`nav-item ${page === item.key ? "selected" : ""}`} onClick={() => setPage(item.key)}><item.icon size={17} /><span>{item.label}</span>{page === item.key && <i />}</button>)}</nav>
      <div className="side-label project-label">PROJECT CHANNEL</div>
      <button className="project-link" onClick={() => setPage("project")}><div className="project-emblem"><FileCode2 size={15} /></div><span>{current.name}</span><span className="online-dot" /></button>
      <button className="add-project" onClick={chooseProject}><Plus size={15} /> Add project</button>
      <div className="sidebar-bottom"><div className="local-seal"><LockKeyhole size={15} /><span>LOCAL ONLY</span><i /></div><div className="profile-mini"><div className="avatar">CC</div><div><strong>Operator</strong><small>WORKSPACE ADMIN</small></div><Settings2 size={15} /></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="crumb"><span>WORKSPACE</span><b>/</b><strong>{activeNav.label.toUpperCase()}</strong></div><div className="top-actions"><div className="system-status"><i /> {desktop ? "NATIVE BRIDGE READY" : "BROWSER PREVIEW / SAMPLE"}</div><button className="icon-button" aria-label="Notifications"><Bell size={17} /><i /></button><button className="palette-trigger" onClick={() => setPaletteOpen(true)}><Search size={15} /><span>Quick command</span><kbd>⌘ K</kbd></button></div></header>

      <section className="page-content">
        <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-pulse" /> DARKFLOW / LOCAL CHANGE ORCHESTRATION</div><h1>{page === "overview" ? <>CONTROL <em>DECK</em></> : page === "proposals" ? <>CHANGE <em>PROPOSALS</em></> : page === "telemetry" ? <>SYSTEM <em>TELEMETRY</em></> : <>PROJECT <em>PROFILE</em></>}</h1><p>{page === "overview" ? "Shape the change. Inspect the evidence. Apply only what you approve." : page === "proposals" ? "Every request, diff, and verification result stays visible." : page === "telemetry" ? "Local workflow health, measured without shipping your source." : "Tune the rules Darkflow uses for this repository."}</p></div><div className="heading-actions"><span className="live-chip"><Radio size={13} /> LOCAL TELEMETRY</span><button className="secondary-button" onClick={() => inspect()}><Activity size={14} /> REFRESH STATUS</button></div></div>

        {notice && <motion.div className="notice-line" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></motion.div>}

        <div className="stats-grid">
          <StatCard icon={Workflow} label="PROPOSALS THIS SESSION" value={packet ? "01" : "00"} trend="CONTROLLED" tone="cyan" note="No changes applied" />
          <StatCard icon={ListChecks} label="PROJECT CHECKS" value={String(current.checks.length).padStart(2, "0")} trend={current.configFound ? "CONFIGURED" : "NEEDS CONFIG"} tone={current.configFound ? "green" : "amber"} note="Required checks from profile" />
          <StatCard icon={Files} label="WORKTREE CHANGES" value={current.root ? String(current.changedFiles).padStart(2, "0") : "—"} trend={!current.root ? "NO PROJECT" : current.changedFiles ? "REVIEW BASELINE" : "CLEAN BASELINE"} tone={!current.root ? "cyan" : current.changedFiles ? "amber" : "green"} note={current.root ? current.gitBranch ? `Branch ${current.gitBranch}` : "Branch not detected" : "Select project to inspect"} />
          <StatCard icon={Gauge} label="APPLY GATE" value="LOCKED" trend="REVIEW REQUIRED" tone="violet" note="Explicit approval before apply" />
        </div>

        <div className="work-grid">
          <section className="panel mission-panel">
            <div className="panel-head"><div className="panel-title"><span className="panel-icon cyan"><Sparkles size={16} /></span><div><h2>BUILD A CHANGE PACKET</h2><small>DESCRIBE THE GOAL AND REVIEW SCOPE</small></div></div><span className="step-count">01 <i>/</i> 04</span></div>
            <div className="panel-body">
              <label className="field-label" htmlFor="task-goal">TASK GOAL <span>REQUIRED</span></label>
              <textarea id="task-goal" rows={3} placeholder="Describe the change you want Darkflow to prepare…" value={task} onChange={(event) => setTask(event.target.value)} />
              <label className="field-label" htmlFor="criteria">ACCEPTANCE CRITERIA <span>OPTIONAL · ONE PER LINE</span></label>
              <textarea id="criteria" className="criteria-input" rows={2} placeholder="What must be true when this work is done?" value={criteria} onChange={(event) => setCriteria(event.target.value)} />
              <div className="field-row"><div className="field-grow"><label className="field-label" htmlFor="scope">ALLOWED PATH SCOPE</label><input id="scope" value={paths} onChange={(event) => setPaths(event.target.value)} /></div><div className="field-fixed"><label className="field-label" htmlFor="provider">CHANGE PROVIDER</label><select id="provider" value={provider} onChange={(event) => setProvider(event.target.value)}><option>Codex CLI</option><option>Manual patch</option><option>Provider adapter</option></select></div></div>
              <div className="guard-row"><div className="guard-copy"><span className="guard-icon"><ShieldCheck size={16} /></span><div><strong>Isolated baseline mode</strong><small>Create a detached worktree without changing the original project.</small></div></div><label className="switch-wrap"><input type="checkbox" checked readOnly aria-label="Isolated worktree enabled" /><span className="switch" /></label></div>
              <div className="guard-row network-row"><div className="guard-copy"><span className="guard-icon muted"><Radio size={16} /></span><div><strong>Request network access</strong><small>Preference only · no agent runner exists, so this is not enforced yet.</small></div></div><Checkbox.Root checked={network} onCheckedChange={(checked) => setNetwork(checked === true)} className="radix-switch" aria-label="Request network access"><Checkbox.Indicator><Check size={11} /></Checkbox.Indicator></Checkbox.Root></div>
              <div className="form-foot"><span><LockKeyhole size={13} /> No auto-apply · no commit · no push</span><button className="primary-button" onClick={createPacket}><Sparkles size={15} /> PREPARE REVIEW PACKET <span>⌘ ↵</span></button></div>
            </div>
          </section>

          <section className="panel profile-panel">
            <div className="panel-head"><div className="panel-title"><span className="panel-icon green"><FolderOpen size={16} /></span><div><h2>PROJECT PROFILE</h2><small>CONFIG-DRIVEN WORKSPACE</small></div></div><button className="icon-button small" onClick={() => setPage("project")} aria-label="Project settings"><Settings2 size={15} /></button></div>
            <div className="project-summary"><div className="project-orbit"><div><FileCode2 size={24} /></div><i /><i /><i /></div><div className="project-name">{current.name}{current.root && <span className="verified"><Check size={11} /></span>}</div><div className="project-path" title={current.root}>{current.root || "Choose a repository folder to load its profile"}</div></div>
            <div className="profile-meta"><div><small>POLICY FILE</small><strong>{current.configFound ? "darkflow.conf" : "NOT FOUND"}</strong></div><div><small>WORKFLOW MODE</small><strong>{current.workflowMode}</strong></div><div><small>BRANCH</small><strong><GitBranch size={12} /> {current.gitBranch || "—"}</strong></div></div>
            <div className="checks-heading"><div><strong>CONFIGURED CHECKS</strong><span>{current.checks.length} TASKS</span></div><button onClick={() => setPage("project")}>EDIT PROFILE ↗</button></div>
            <div className="check-list">{current.checks.slice(0, 3).map((check, index) => <div className="check-row" key={check.id}><span className={`check-index ${index === 0 ? "active" : ""}`}>{String(index + 1).padStart(2, "0")}</span><div><strong>{check.label}</strong><code>{check.command}</code></div><span className="check-required">{check.required ? "REQ" : "OPT"}</span></div>)}{current.checks.length === 0 && <div className="empty-checks"><CircleHelp size={15} /> Select a project containing darkflow.conf</div>}</div>
            <button className="outline-action" onClick={chooseProject}><FolderOpen size={14} /> CHANGE PROJECT ROOT</button>
          </section>
        </div>

        <div className="lower-grid">
          <section className="panel activity-panel"><div className="panel-head compact"><div className="panel-title"><span className="panel-icon violet"><Activity size={16} /></span><div><h2>WORKFLOW SIGNALS</h2><small>LOCAL EVENT STREAM · THIS SESSION</small></div></div><button className="text-button" onClick={() => setPage("telemetry")}>VIEW TELEMETRY ↗</button></div><div className="activity-list">{eventRows.slice(0, 5).map((event) => <div className="event-row" key={event.timestamp}><time>{event.time}</time><span className={`event-kind ${event.tone}`}>{event.kind}</span><p>{event.message}</p><span className={`event-tag ${event.tone}`}>{event.tag}</span></div>)}</div><div className="activity-foot"><span><i /> LOCAL EVENTS ONLY</span><span>UPDATED {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div></section>
          <section className="panel integrity-panel"><div className="panel-head compact"><div className="panel-title"><span className="panel-icon amber"><LockKeyhole size={16} /></span><div><h2>REVIEW INTEGRITY</h2><small>CHANGE SAFETY ENFORCEMENT</small></div></div><span className="integrity-score">100<span>%</span></span></div><div className="integrity-meter"><i /></div><div className="integrity-items"><div><Check size={13} /><span>Diff required before apply</span></div><div><Check size={13} /><span>Stale baseline blocks apply</span></div><div><Check size={13} /><span>Project telemetry stays local</span></div></div><div className="integrity-foot"><ShieldCheck size={14} /> SAFETY PROFILE ACTIVE</div></section>
        </div>

        {page === "proposals" && <>
          <section className="panel proposal-detail"><div className="panel-head"><div className="panel-title"><span className="panel-icon amber"><History size={16} /></span><div><h2>PROPOSAL QUEUE</h2><small>REQUEST PACKETS · ISOLATED BASELINES · REVIEW EVIDENCE</small></div></div><span className="status-pending">{packet ? packet.saved ? "1 SAVED" : "1 REVIEW" : proposalWorkspaces.length ? `${proposalWorkspaces.length} WORKTREES` : "NO PROPOSALS"}</span></div>{packet ? <div className="packet-card"><div className="packet-top"><span className="packet-id">DF-{packet.id.slice(0, 8).toUpperCase()}</span><span>CREATED {new Date(packet.createdAt).toLocaleString()}</span><span className={`status-pending ${packet.saved ? "saved" : ""}`}>{packet.saved ? "SAVED LOCAL" : "READY TO SAVE"}</span></div><h3>{packet.task}</h3><div className="packet-details"><div><small>ACCEPTANCE CRITERIA</small><p>{packet.criteria || "No criteria entered"}</p></div><div><small>ALLOWED SCOPE</small><code>{packet.paths}</code></div><div><small>PROVIDER</small><p>{packet.provider} · {packet.network ? "network enabled" : "network disabled"}</p></div></div><div className="engine-notice"><TerminalSquare size={17} /><div><strong>{proposalWorkspaces.some((workspace) => workspace.id === packet.id) ? "ISOLATED BASELINE READY · NO CODE GENERATED" : "REQUEST RECORD · NO CODE GENERATED"}</strong><p>{proposalWorkspaces.some((workspace) => workspace.id === packet.id) ? "A detached worktree was created at the captured commit. Darkflow has not invoked an agent, run project checks, or changed the original tree." : "Review and save this request before preparing its isolated baseline. No agent, project checks, diff generation, or patch apply are connected yet."}</p></div></div><div className="packet-actions"><button className="secondary-button" onClick={() => setPage("overview")}>EDIT REQUEST</button><button className="secondary-button" onClick={() => void createWorkspace()} disabled={!packet.saved || !desktop || workspaceBusy || proposalWorkspaces.some((workspace) => workspace.id === packet.id)}>{workspaceBusy ? "PREPARING BASELINE…" : proposalWorkspaces.some((workspace) => workspace.id === packet.id) ? "BASELINE PREPARED" : "CREATE ISOLATED BASELINE"}</button><button className="primary-button" onClick={() => void savePacket()} disabled={packet.saved}>{packet.saved ? <Check size={14} /> : <LockKeyhole size={14} />}{packet.saved ? "SAVED TO LOCAL HISTORY" : "SAVE REVIEWED REQUEST"}</button></div>{!desktop && <p className="preview-hint">Use the installed desktop app to create a real Git worktree. Browser preview cannot access your filesystem.</p>}</div> : <div className="empty-state"><Workflow size={25} /><strong>Nothing in the queue yet</strong><p>Create a request packet from the command deck to begin.</p><button className="secondary-button" onClick={() => setPage("overview")}>OPEN COMMAND DECK</button></div>}</section>
          <section className="panel worktree-history"><div className="panel-head"><div className="panel-title"><span className="panel-icon green"><GitBranch size={16} /></span><div><h2>ISOLATED PROPOSAL WORKTREES</h2><small>LOCAL APP DATA · DETACHED COMMITS</small></div></div><span className="status-pending">{proposalWorkspaces.length} ACTIVE</span></div>{proposalWorkspaces.length ? <div className="workspace-list">{proposalWorkspaces.map((workspace) => <article className="workspace-row" key={workspace.id}><div className="workspace-copy"><strong>DF-{workspace.id.slice(0, 8).toUpperCase()} · {workspace.baseBranch || "DETACHED SOURCE"}</strong><code>BASE {workspace.baseCommit.slice(0, 12)} · {workspace.originalChangedFiles} ORIGINAL PATH ENTRIES</code><code className="workspace-path">{workspace.worktreePath}</code>{workspace.originalChangedFiles > 0 && <p className="workspace-warning">The source tree had uncommitted changes. This worktree starts from committed HEAD and does not include them.</p>}</div><button className="secondary-button workspace-discard" onClick={() => void discardWorkspace(workspace)}><X size={13} /> DISCARD</button></article>)}</div> : <div className="empty-worktrees"><FolderOpen size={18} /><span>No isolated worktrees are active. They remain listed here across app restarts so you can inspect or discard them.</span></div>}</section>
        </>}

        {page === "telemetry" && <section className="panel telemetry-detail"><div className="panel-head"><div className="panel-title"><span className="panel-icon cyan"><Activity size={16} /></span><div><h2>LOCAL TELEMETRY MONITOR</h2><small>NO REMOTE EXPORT CONFIGURED</small></div></div><span className="live-chip"><Radio size={13} /> SESSION LIVE</span></div><div className="telemetry-cards"><div><small>SESSION EVENTS</small><strong>{String(eventRows.length).padStart(2, "0")}</strong><span>Recorded in this session</span></div><div><small>CHECK SUCCESS RATE</small><strong>—</strong><span>No checks run yet</span></div><div><small>AVG. CHECK DURATION</small><strong>—</strong><span>Awaiting first run</span></div><div><small>CHANGED FILES</small><strong>{current.root ? String(current.changedFiles).padStart(2, "0") : "—"}</strong><span>{current.root ? "Current project snapshot" : "Select a project first"}</span></div></div><div className="telemetry-chart"><div className="chart-copy"><strong>WORKFLOW ACTIVITY</strong><span>LOCAL EVENTS PER TIME SLICE · LAST 15 MIN</span></div><div className="chart-bars">{chartHeights.map((height, index) => <i key={index} style={{ height: `${height}%`, opacity: .25 + height / 140 }} />)}</div><div className="chart-times"><span>15 MIN AGO</span><span>NOW</span></div></div><div className="privacy-callout"><LockKeyhole size={16} /><div><strong>LOCAL-FIRST TELEMETRY</strong><p>Counts and durations describe Darkflow operations. Source, task prompts, diffs, and raw command output are not collected as telemetry.</p></div></div></section>}

        {page === "project" && <section className="panel project-detail"><div className="panel-head"><div className="panel-title"><span className="panel-icon green"><Settings2 size={16} /></span><div><h2>PROJECT PROFILE CONFIGURATION</h2><small>PROJECT-OWNED POLICY · darkflow.conf</small></div></div><button className="secondary-button" onClick={chooseProject}><FolderOpen size={14} /> SELECT ROOT</button></div><div className="root-entry"><label className="field-label" htmlFor="project-root">PROJECT ROOT</label><div><input id="project-root" placeholder="/path/to/repository" value={projectPath || current.root} onChange={(event) => setProjectPath(event.target.value)} onKeyDown={(event) => event.key === "Enter" && inspect()} /><button className="primary-button" onClick={() => inspect()}>INSPECT PROJECT</button></div></div><div className="profile-readout"><div className="readout-head"><span>CONFIG READOUT</span><span className={current.configFound ? "readout-pass" : "readout-warn"}>{current.configFound ? "VALIDATED" : "MISSING CONFIG"}</span></div><pre>{`schema: darkflow.project/v1\nproject: ${current.name}\npolicy: ${current.configFound ? "darkflow.conf" : "not found"}\nworkflow: ${current.workflowMode}\nprovider: codex\nmode: isolated-worktree\nnetwork: disabled by default\ntelemetry: local-only\nchecks: ${current.checks.length}\napply: explicit review required`}</pre></div><div className="doc-links"><a href="https://github.com/cybercoretech/darkflow" target="_blank" rel="noreferrer"><BookOpen size={14} /> DARKFLOW REPOSITORY ↗</a><span><Clock3 size={13} /> Last inspected {lastRefresh.toLocaleTimeString()}</span></div></section>}

        <footer className="page-footer"><span>© CYBERCORE SYSTEMS <b>·</b> DARKFLOW 0.1.0</span><span><i /> {desktop ? "TAURI NATIVE BRIDGE CONNECTED" : "BROWSER PREVIEW MODE"}</span><span>BUILD CLEAN · LOCAL FIRST</span></footer>
      </section>
    </main>

    <Command.Dialog open={paletteOpen} onOpenChange={setPaletteOpen} label="Darkflow command palette" className="command-dialog">
      <div className="command-box"><div className="command-search"><Search size={17} /><Command.Input autoFocus placeholder="Search commands, projects, and views…" /><kbd>ESC</kbd></div><Command.List><Command.Empty>No matching command found.</Command.Empty><Command.Group heading="NAVIGATION">{navItems.map((item) => <Command.Item key={item.key} onSelect={() => { setPage(item.key); setPaletteOpen(false); }}><item.icon size={16} />{item.label}<span>{item.shortcut}</span></Command.Item>)}</Command.Group><Command.Group heading="WORKFLOW"><Command.Item onSelect={() => { setPage("overview"); setPaletteOpen(false); document.getElementById("task-goal")?.focus(); }}><Sparkles size={16} />Start a change request<span>⌘ ↵</span></Command.Item><Command.Item onSelect={() => { void inspect(); setPaletteOpen(false); }}><Activity size={16} />Refresh project status<span>↻</span></Command.Item><Command.Item onSelect={() => { void chooseProject(); setPaletteOpen(false); }}><FolderOpen size={16} />Open another project<span>⌘ O</span></Command.Item></Command.Group></Command.List><div className="command-foot"><span><kbd>↑</kbd><kbd>↓</kbd> NAVIGATE</span><span><kbd>↵</kbd> RUN COMMAND</span><span>DARKFLOW COMMAND BUS</span></div></div>
    </Command.Dialog>
  </div>;
}

function StatCard({ icon: Icon, label, value, trend, tone, note }: { icon: typeof Activity; label: string; value: string; trend: string; tone: string; note: string }) {
  return <motion.article className={`stat-card ${tone}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22 }}><div className="stat-top"><span>{label}</span><Icon size={16} /></div><div className="stat-main"><strong>{value}</strong><span className="stat-trend">{tone === "green" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{trend}</span></div><div className="stat-note">{note}</div><div className="stat-line"><i /></div></motion.article>;
}

export default App;
