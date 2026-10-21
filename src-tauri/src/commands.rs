use serde::{Deserialize, Serialize};
use std::path::PathBuf;
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
}

#[derive(Debug, Deserialize)]
struct CheckConfig {
    id: String,
    label: String,
    command: String,
    required: Option<bool>,
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
}
