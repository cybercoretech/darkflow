use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::Manager;
use tracing::info;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSnapshot {
    pub root: String,
    pub name: String,
    pub config_found: bool,
    pub workflow_mode: String,
    pub checks: Vec<CheckSummary>,
    pub git_branch: Option<String>,
    pub changed_files: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckSummary {
    pub id: String,
    pub label: String,
    pub command: String,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeRequest {
    pub id: String,
    pub project_root: String,
    pub task: String,
    pub acceptance_criteria: String,
    pub allowed_paths: String,
    pub provider: String,
    pub allow_network: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
struct ProjectConfig {
    name: Option<String>,
    workflow: Option<WorkflowConfig>,
    checks: Option<Vec<CheckConfig>>,
}

#[derive(Debug, Deserialize)]
struct WorkflowConfig {
    mode: Option<String>,
    require_clean_worktree: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct CheckConfig {
    id: String,
    label: String,
    command: String,
    required: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalWorkspace {
    pub id: String,
    pub project_root: String,
    pub worktree_path: String,
    pub base_commit: String,
    pub base_branch: Option<String>,
    pub original_changed_files: usize,
    pub created_at_ms: u128,
}

#[tauri::command]
pub async fn inspect_project(root: String) -> Result<ProjectSnapshot, String> {
    let root_path = PathBuf::from(&root)
        .canonicalize()
        .map_err(|error| format!("Cannot open project folder: {error}"))?;
    if !root_path.is_dir() {
        return Err("Selected project path is not a directory".into());
    }

    let config_path = root_path.join("darkflow.conf");
    let config_found = config_path.is_file();
    let config = if config_found {
        let text = tokio::fs::read_to_string(&config_path)
            .await
            .map_err(|error| format!("Could not read darkflow.conf: {error}"))?;
        Some(
            toml::from_str::<ProjectConfig>(&text)
                .map_err(|error| format!("darkflow.conf is invalid: {error}"))?,
        )
    } else {
        None
    };

    let (git_branch, changed_files) = git_snapshot(&root_path).await;
    let checks = config
        .as_ref()
        .and_then(|config| config.checks.as_ref())
        .into_iter()
        .flatten()
        .map(|check| CheckSummary {
            id: check.id.clone(),
            label: check.label.clone(),
            command: check.command.clone(),
            required: check.required.unwrap_or(true),
        })
        .collect();

    let snapshot = ProjectSnapshot {
        root: root_path.display().to_string(),
        name: config
            .as_ref()
            .and_then(|config| config.name.clone())
            .or_else(|| {
                root_path
                    .file_name()
                    .map(|name| name.to_string_lossy().into_owned())
            })
            .unwrap_or_else(|| "Project".into()),
        config_found,
        workflow_mode: config
            .and_then(|config| config.workflow.and_then(|workflow| workflow.mode))
            .unwrap_or_else(|| "isolated-worktree".into()),
        checks,
        git_branch,
        changed_files,
    };
    info!(project = %snapshot.name, changed_files = snapshot.changed_files, "project inspected");
    Ok(snapshot)
}

#[tauri::command]
pub async fn save_request_packet(
    app: tauri::AppHandle,
    packet: ChangeRequest,
) -> Result<String, String> {
    let id = Uuid::parse_str(&packet.id)
        .map_err(|_| "Request ID is invalid".to_owned())?
        .hyphenated()
        .to_string();
    if packet.task.trim().is_empty() {
        return Err("A request needs a task goal".into());
    }
    let requests_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not locate Darkflow app data: {error}"))?
        .join("requests");
    tokio::fs::create_dir_all(&requests_dir)
        .await
        .map_err(|error| format!("Could not create local request history: {error}"))?;
    let path = requests_dir.join(format!("{id}.json"));
    let contents = serde_json::to_vec_pretty(&packet)
        .map_err(|error| format!("Could not encode request packet: {error}"))?;
    tokio::fs::write(&path, contents)
        .await
        .map_err(|error| format!("Could not save request packet: {error}"))?;
    info!(request_id = %id, "request packet saved locally");
    Ok(path.display().to_string())
}

#[tauri::command]
pub async fn create_proposal_workspace(
    app: tauri::AppHandle,
    project_root: String,
    request_id: String,
) -> Result<ProposalWorkspace, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not locate Darkflow app data: {error}"))?;
    prepare_workspace(&app_data, Path::new(&project_root), &request_id).await
}

#[tauri::command]
pub async fn discard_proposal_workspace(
    app: tauri::AppHandle,
    proposal_id: String,
) -> Result<(), String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not locate Darkflow app data: {error}"))?;
    discard_workspace(&app_data, &proposal_id).await
}

#[tauri::command]
pub async fn list_proposal_workspaces(
    app: tauri::AppHandle,
) -> Result<Vec<ProposalWorkspace>, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not locate Darkflow app data: {error}"))?;
    list_workspaces(&app_data).await
}

async fn list_workspaces(app_data: &Path) -> Result<Vec<ProposalWorkspace>, String> {
    let app_data = ensure_app_data(app_data).await?;
    let proposals_dir = app_data.join("proposals");
    if !tokio::fs::try_exists(&proposals_dir)
        .await
        .map_err(|error| format!("Could not inspect proposal history: {error}"))?
    {
        return Ok(Vec::new());
    }
    let mut entries = tokio::fs::read_dir(proposals_dir)
        .await
        .map_err(|error| format!("Could not read proposal history: {error}"))?;
    let worktrees_root = app_data.join("worktrees");
    let worktrees_root = if tokio::fs::try_exists(&worktrees_root)
        .await
        .map_err(|error| format!("Could not inspect proposal worktrees: {error}"))?
    {
        Some(
            worktrees_root
                .canonicalize()
                .map_err(|error| format!("Could not resolve proposal worktrees: {error}"))?,
        )
    } else {
        None
    };
    let mut proposals = Vec::new();
    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|error| format!("Could not read proposal history: {error}"))?
    {
        if !entry
            .file_type()
            .await
            .map_err(|error| format!("Could not inspect proposal record: {error}"))?
            .is_file()
        {
            continue;
        }
        let entry_path = entry.path();
        if entry_path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let Some(stem) = entry_path.file_stem().and_then(|value| value.to_str()) else {
            continue;
        };
        let Ok(id) = Uuid::parse_str(stem) else {
            continue;
        };
        let id = id.hyphenated().to_string();
        let contents = tokio::fs::read(&entry_path)
            .await
            .map_err(|error| format!("Could not read proposal record: {error}"))?;
        let proposal: ProposalWorkspace = serde_json::from_slice(&contents)
            .map_err(|error| format!("Proposal record {id} is invalid: {error}"))?;
        let Some(worktrees_root) = worktrees_root.as_ref() else {
            continue;
        };
        let expected_path = worktrees_root.join(&id);
        let Ok(actual_path) = PathBuf::from(&proposal.worktree_path).canonicalize() else {
            continue;
        };
        if proposal.id == id
            && actual_path == expected_path
            && actual_path.starts_with(worktrees_root)
            && Path::new(&proposal.project_root).is_dir()
        {
            proposals.push(proposal);
        }
    }
    proposals.sort_by_key(|proposal| proposal.created_at_ms);
    Ok(proposals)
}

async fn prepare_workspace(
    app_data: &Path,
    project_root: &Path,
    request_id: &str,
) -> Result<ProposalWorkspace, String> {
    let id = Uuid::parse_str(request_id)
        .map_err(|_| "Request ID is invalid".to_owned())?
        .hyphenated()
        .to_string();
    let root = project_root
        .canonicalize()
        .map_err(|error| format!("Cannot open project folder: {error}"))?;
    if !root.is_dir() {
        return Err("Selected project path is not a directory".into());
    }

    let top_level = git_output(&root, ["rev-parse", "--show-toplevel"])
        .await
        .map_err(|error| format!("Selected folder is not an available Git worktree: {error}"))?;
    let repo_root = PathBuf::from(top_level.trim())
        .canonicalize()
        .map_err(|error| format!("Cannot resolve the Git worktree root: {error}"))?;
    if root != repo_root {
        return Err("Select the Git repository root, not a subfolder".into());
    }

    let config_path = root.join("darkflow.conf");
    let config = if config_path.is_file() {
        let text = tokio::fs::read_to_string(&config_path)
            .await
            .map_err(|error| format!("Could not read darkflow.conf: {error}"))?;
        Some(
            toml::from_str::<ProjectConfig>(&text)
                .map_err(|error| format!("darkflow.conf is invalid: {error}"))?,
        )
    } else {
        None
    };
    let workflow = config.as_ref().and_then(|value| value.workflow.as_ref());
    if workflow
        .and_then(|value| value.mode.as_deref())
        .unwrap_or("isolated-worktree")
        != "isolated-worktree"
    {
        return Err("This proposal engine supports only isolated-worktree mode".into());
    }
    let require_clean = workflow
        .and_then(|value| value.require_clean_worktree)
        .unwrap_or(true);

    let status = git_bytes(
        &root,
        ["status", "--porcelain", "-z", "--untracked-files=all"],
    )
    .await
    .map_err(|error| format!("Could not capture the project's Git status: {error}"))?;
    let changed_files = status
        .split(|byte| *byte == 0)
        .filter(|part| !part.is_empty())
        .count();
    if require_clean && changed_files > 0 {
        return Err(format!(
            "Project worktree has {changed_files} uncommitted path entries; commit or stash them, or explicitly set workflow.require_clean_worktree = false"
        ));
    }

    let base_commit = git_output(&root, ["rev-parse", "--verify", "HEAD"])
        .await
        .map_err(|error| format!("Could not capture the project's HEAD commit: {error}"))?
        .trim()
        .to_owned();
    let base_branch = git_output(&root, ["branch", "--show-current"])
        .await
        .ok()
        .map(|branch| branch.trim().to_owned())
        .filter(|branch| !branch.is_empty());

    let app_data = ensure_app_data(app_data).await?;
    let worktrees_root = app_data.join("worktrees");
    tokio::fs::create_dir_all(&worktrees_root)
        .await
        .map_err(|error| format!("Could not create proposal storage: {error}"))?;
    let worktrees_root = worktrees_root
        .canonicalize()
        .map_err(|error| format!("Could not resolve proposal storage: {error}"))?;
    let worktree_path = worktrees_root.join(&id);
    if tokio::fs::try_exists(&worktree_path)
        .await
        .map_err(|error| format!("Could not inspect proposal path: {error}"))?
    {
        return Err("A proposal worktree already exists for this request".into());
    }

    let output = tokio::process::Command::new("git")
        .arg("worktree")
        .arg("add")
        .arg("--detach")
        .arg(&worktree_path)
        .arg(&base_commit)
        .current_dir(&root)
        .output()
        .await
        .map_err(|error| format!("Could not start Git worktree creation: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "Git could not create the proposal worktree: {}",
            command_error(&output.stderr)
        ));
    }

    let current_head = git_output(&root, ["rev-parse", "--verify", "HEAD"]).await;
    let current_status = git_bytes(
        &root,
        ["status", "--porcelain", "-z", "--untracked-files=all"],
    )
    .await;
    if current_head.as_deref().map(str::trim) != Ok(base_commit.as_str())
        || current_status.as_deref() != Ok(status.as_slice())
    {
        let _ = remove_git_worktree(&root, &worktree_path).await;
        return Err("Project HEAD or worktree status changed while the baseline was being prepared; inspect the project and try again".into());
    }

    let worktree_path = match worktree_path.canonicalize() {
        Ok(path) if path.starts_with(&worktrees_root) && path != worktrees_root => path,
        Ok(path) => {
            let _ = remove_git_worktree(&root, &path).await;
            return Err("Git created a worktree outside Darkflow's proposal storage".into());
        }
        Err(error) => {
            let _ = remove_git_worktree(&root, &worktree_path).await;
            return Err(format!("Could not verify the created worktree: {error}"));
        }
    };

    let prepared_head = git_output(&worktree_path, ["rev-parse", "--verify", "HEAD"]).await;
    let detached = git_output(&worktree_path, ["symbolic-ref", "--quiet", "HEAD"]).await;
    if prepared_head.as_deref().map(str::trim) != Ok(base_commit.as_str()) || detached.is_ok() {
        let _ = remove_git_worktree(&root, &worktree_path).await;
        return Err("Git did not create the proposal at the captured detached baseline".into());
    }

    let workspace = ProposalWorkspace {
        id: id.clone(),
        project_root: root.display().to_string(),
        worktree_path: worktree_path.display().to_string(),
        base_commit,
        base_branch,
        original_changed_files: changed_files,
        created_at_ms: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
    };
    let proposals_dir = app_data.join("proposals");
    if let Err(error) = tokio::fs::create_dir_all(&proposals_dir).await {
        let _ = remove_git_worktree(&root, &worktree_path).await;
        return Err(format!("Could not create proposal history: {error}"));
    }
    let manifest_path = proposals_dir.join(format!("{id}.json"));
    let contents = match serde_json::to_vec_pretty(&workspace) {
        Ok(contents) => contents,
        Err(error) => {
            let _ = remove_git_worktree(&root, &worktree_path).await;
            return Err(format!("Could not encode proposal record: {error}"));
        }
    };
    let temporary_manifest = manifest_path.with_extension("json.tmp");
    if let Err(error) = tokio::fs::write(&temporary_manifest, contents).await {
        let _ = remove_git_worktree(&root, &worktree_path).await;
        return Err(format!("Could not save proposal record: {error}"));
    }
    if let Err(error) = tokio::fs::rename(&temporary_manifest, &manifest_path).await {
        let _ = tokio::fs::remove_file(&temporary_manifest).await;
        let _ = remove_git_worktree(&root, &worktree_path).await;
        return Err(format!("Could not finalize proposal record: {error}"));
    }
    info!(proposal_id = %id, base = %workspace.base_commit, "isolated proposal worktree created");
    Ok(workspace)
}

async fn discard_workspace(app_data: &Path, proposal_id: &str) -> Result<(), String> {
    let id = Uuid::parse_str(proposal_id)
        .map_err(|_| "Proposal ID is invalid".to_owned())?
        .hyphenated()
        .to_string();
    let app_data = ensure_app_data(app_data).await?;
    let manifest_path = app_data.join("proposals").join(format!("{id}.json"));
    let contents = tokio::fs::read(&manifest_path)
        .await
        .map_err(|error| format!("Could not read proposal record: {error}"))?;
    let workspace: ProposalWorkspace = serde_json::from_slice(&contents)
        .map_err(|error| format!("Proposal record is invalid: {error}"))?;
    if workspace.id != id {
        return Err("Proposal record ID does not match its storage key".into());
    }
    let worktrees_root = app_data
        .join("worktrees")
        .canonicalize()
        .map_err(|error| format!("Could not resolve proposal storage: {error}"))?;
    let worktree_path = PathBuf::from(&workspace.worktree_path)
        .canonicalize()
        .map_err(|error| format!("Proposal worktree is unavailable: {error}"))?;
    if worktree_path != worktrees_root.join(&id) || !worktree_path.starts_with(&worktrees_root) {
        return Err("Proposal record points outside its assigned worktree".into());
    }
    let project_root = PathBuf::from(&workspace.project_root)
        .canonicalize()
        .map_err(|error| format!("Original Git repository is unavailable: {error}"))?;
    remove_git_worktree(&project_root, &worktree_path).await?;
    tokio::fs::remove_file(&manifest_path)
        .await
        .map_err(|error| {
            format!("Worktree removed, but proposal record cleanup failed: {error}")
        })?;
    info!(proposal_id = %id, "isolated proposal worktree discarded");
    Ok(())
}

async fn ensure_app_data(app_data: &Path) -> Result<PathBuf, String> {
    tokio::fs::create_dir_all(app_data)
        .await
        .map_err(|error| format!("Could not create Darkflow app data: {error}"))?;
    app_data
        .canonicalize()
        .map_err(|error| format!("Could not resolve Darkflow app data: {error}"))
}

async fn git_output<const N: usize>(root: &Path, args: [&str; N]) -> Result<String, String> {
    let output = tokio::process::Command::new("git")
        .args(args)
        .current_dir(root)
        .output()
        .await
        .map_err(|error| format!("Could not start Git: {error}"))?;
    if !output.status.success() {
        return Err(command_error(&output.stderr));
    }
    String::from_utf8(output.stdout).map_err(|error| format!("Git returned invalid UTF-8: {error}"))
}

async fn git_bytes<const N: usize>(root: &Path, args: [&str; N]) -> Result<Vec<u8>, String> {
    let output = tokio::process::Command::new("git")
        .args(args)
        .current_dir(root)
        .output()
        .await
        .map_err(|error| format!("Could not start Git: {error}"))?;
    if !output.status.success() {
        return Err(command_error(&output.stderr));
    }
    Ok(output.stdout)
}

async fn remove_git_worktree(root: &Path, path: &Path) -> Result<(), String> {
    let output = tokio::process::Command::new("git")
        .arg("worktree")
        .arg("remove")
        .arg("--force")
        .arg(path)
        .current_dir(root)
        .output()
        .await
        .map_err(|error| format!("Could not start Git worktree cleanup: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "Git could not remove the proposal worktree: {}",
            command_error(&output.stderr)
        ));
    }
    Ok(())
}

fn command_error(stderr: &[u8]) -> String {
    String::from_utf8_lossy(stderr)
        .trim()
        .chars()
        .take(512)
        .collect()
}

async fn git_snapshot(root: &std::path::Path) -> (Option<String>, usize) {
    let branch = tokio::process::Command::new("git")
        .args(["branch", "--show-current"])
        .current_dir(root)
        .output()
        .await
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|branch| branch.trim().to_owned())
        .filter(|branch| !branch.is_empty());

    let changed = tokio::process::Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(root)
        .output()
        .await
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|status| status.lines().count())
        .unwrap_or(0);
    (branch, changed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_config_parses_checks_and_workflow() {
        let config: ProjectConfig = toml::from_str(
            r#"
name = "demo"
[workflow]
mode = "isolated-worktree"
[[checks]]
id = "unit"
label = "Unit tests"
command = "cargo test"
required = true
"#,
        )
        .expect("valid config");
        assert_eq!(config.name.as_deref(), Some("demo"));
        assert_eq!(
            config.workflow.unwrap().mode.as_deref(),
            Some("isolated-worktree")
        );
        assert_eq!(config.checks.unwrap()[0].id, "unit");
    }

    #[test]
    fn repository_darkflow_config_is_valid() {
        let config: ProjectConfig = toml::from_str(include_str!("../../darkflow.conf"))
            .expect("the repository's darkflow.conf should parse");
        assert_eq!(config.name.as_deref(), Some("Darkflow"));
        assert_eq!(config.checks.as_ref().map(Vec::len), Some(3));
    }

    struct TestTree(PathBuf);

    impl TestTree {
        fn new(label: &str) -> Self {
            let path = std::env::temp_dir()
                .join(format!("darkflow-{label}-{}", Uuid::now_v7().hyphenated()));
            std::fs::create_dir_all(&path).expect("create test directory");
            Self(path)
        }
    }

    impl Drop for TestTree {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn init_test_repo(path: &Path) {
        git_test(path, &["init", "-q"]);
        std::fs::write(path.join("README.md"), "baseline\n").expect("write test file");
        git_test(path, &["add", "README.md"]);
        git_test(
            path,
            &[
                "-c",
                "user.name=Darkflow Test",
                "-c",
                "user.email=darkflow-test@example.invalid",
                "commit",
                "-qm",
                "baseline",
            ],
        );
    }

    fn git_test(path: &Path, args: &[&str]) {
        let output = std::process::Command::new("git")
            .args(args)
            .current_dir(path)
            .output()
            .expect("start test git command");
        assert!(
            output.status.success(),
            "git {:?} failed: {}",
            args,
            String::from_utf8_lossy(&output.stderr)
        );
    }

    #[tokio::test]
    async fn proposal_worktree_is_detached_and_discardable() {
        let repo = TestTree::new("repo");
        let app_data = TestTree::new("appdata");
        init_test_repo(&repo.0);
        let request_id = Uuid::now_v7().to_string();

        let proposal = prepare_workspace(&app_data.0, &repo.0, &request_id)
            .await
            .expect("create proposal worktree");
        assert_eq!(proposal.original_changed_files, 0);
        assert!(Path::new(&proposal.worktree_path).is_dir());
        let listed = list_workspaces(&app_data.0)
            .await
            .expect("list persisted proposal worktree");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, proposal.id);
        assert_eq!(
            git_output(Path::new(&proposal.worktree_path), ["rev-parse", "HEAD"])
                .await
                .expect("read worktree HEAD")
                .trim(),
            proposal.base_commit
        );
        assert_eq!(
            git_output(
                Path::new(&proposal.worktree_path),
                ["symbolic-ref", "-q", "HEAD"]
            )
            .await
            .expect_err("proposal should be detached"),
            ""
        );

        discard_workspace(&app_data.0, &proposal.id)
            .await
            .expect("discard proposal worktree");
        assert!(!Path::new(&proposal.worktree_path).exists());
        assert!(
            !app_data
                .0
                .join("proposals")
                .join(format!("{}.json", proposal.id))
                .exists()
        );
    }

    #[tokio::test]
    async fn dirty_project_is_blocked_by_default_and_allowed_only_by_config() {
        let repo = TestTree::new("dirty-repo");
        let app_data = TestTree::new("dirty-appdata");
        init_test_repo(&repo.0);
        std::fs::write(repo.0.join("unsaved.txt"), "keep this in the source tree\n")
            .expect("create dirty file");
        let request_id = Uuid::now_v7().to_string();

        let error = prepare_workspace(&app_data.0, &repo.0, &request_id)
            .await
            .expect_err("dirty tree must be rejected by default");
        assert!(error.contains("uncommitted path entries"));
        assert!(!app_data.0.join("worktrees").join(&request_id).exists());

        std::fs::write(
            repo.0.join("darkflow.conf"),
            "schema = \"darkflow.project/v1\"\n[workflow]\nrequire_clean_worktree = false\n",
        )
        .expect("write explicit dirty-tree policy");
        let proposal = prepare_workspace(&app_data.0, &repo.0, &request_id)
            .await
            .expect("explicitly allow committed-HEAD baseline");
        assert!(proposal.original_changed_files > 0);
        assert!(
            !Path::new(&proposal.worktree_path)
                .join("unsaved.txt")
                .exists()
        );
        discard_workspace(&app_data.0, &proposal.id)
            .await
            .expect("discard proposal worktree");
    }

    #[tokio::test]
    async fn project_subfolder_is_not_accepted_as_root() {
        let repo = TestTree::new("subfolder-repo");
        let app_data = TestTree::new("subfolder-appdata");
        init_test_repo(&repo.0);
        let subfolder = repo.0.join("src");
        std::fs::create_dir(&subfolder).expect("create subfolder");

        let error = prepare_workspace(&app_data.0, &subfolder, &Uuid::now_v7().to_string())
            .await
            .expect_err("must require repository root");
        assert!(error.contains("repository root"));
    }
}
