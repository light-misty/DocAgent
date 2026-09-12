use serde::{Deserialize, Serialize};
use std::fmt;

/// 权限动作(三态决策)
/// 对应 OpenCode 的 allow/deny/ask
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum PermissionAction {
    /// 允许:直接执行,无需用户确认
    Allow,
    /// 拒绝:阻止执行,返回错误给 LLM
    Deny,
    /// 询问:弹出对话框,等待用户审批
    #[default]
    Ask,
}

impl fmt::Display for PermissionAction {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PermissionAction::Allow => write!(f, "allow"),
            PermissionAction::Deny => write!(f, "deny"),
            PermissionAction::Ask => write!(f, "ask"),
        }
    }
}

impl PermissionAction {
    /// 从字符串解析权限动作
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "allow" => Some(Self::Allow),
            "deny" => Some(Self::Deny),
            "ask" => Some(Self::Ask),
            _ => None,
        }
    }
}

/// 权限类型(对应工具类别)
/// 参照 OpenCode 的 12 类权限项
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionType {
    /// 通配:匹配所有工具
    Wildcard,
    /// 读取文件:read(支持行号范围,合并自原 read_lines)
    Read,
    /// 编辑文件:edit, write, apply_patch, remove, rename
    /// 说明:参照 OpenCode 官方模型,edit 权限类别统一覆盖 edit/write/apply_patch 三个文件修改工具
    Edit,
    /// 通配符搜索:glob
    Glob,
    /// 正则搜索:grep, search
    Grep,
    /// 列出目录:list
    List,
    /// 执行 Shell 命令:bash
    Bash,
    /// 执行 PowerShell 命令:powershell
    /// 注意:变体名写作 Powershell 而非 PowerShell,否则 serde 的 snake_case 会产出
    /// "power_shell",与前端类型和 Display 三方不一致
    Powershell,
    /// 写入并执行脚本:write_script
    WriteScript,
    /// 子 Agent 调用:task
    Task,
    /// Skill 加载
    Skill,
    /// 网页抓取:webfetch
    WebFetch,
    /// 网络搜索:websearch
    WebSearch,
    /// 外部目录访问:工作区外的路径
    ExternalDirectory,
    /// Doom loop 检测:连续 3 次相同调用
    DoomLoop,
    /// 文档处理:docx, xlsx, pptx, pdf
    /// v1.1 新增:用于 Document 模式下的文档 Handler 权限控制
    Document,
    /// 询问用户:question(向用户提问以获取澄清信息)
    /// 参照 OpenCode 官方模型,question 是独立权限类别
    Question,
}

impl fmt::Display for PermissionType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PermissionType::Wildcard => write!(f, "*"),
            PermissionType::Read => write!(f, "read"),
            PermissionType::Edit => write!(f, "edit"),
            PermissionType::Glob => write!(f, "glob"),
            PermissionType::Grep => write!(f, "grep"),
            PermissionType::List => write!(f, "list"),
            PermissionType::Bash => write!(f, "bash"),
            PermissionType::Powershell => write!(f, "powershell"),
            PermissionType::WriteScript => write!(f, "write_script"),
            PermissionType::Task => write!(f, "task"),
            PermissionType::Skill => write!(f, "skill"),
            PermissionType::WebFetch => write!(f, "webfetch"),
            PermissionType::WebSearch => write!(f, "websearch"),
            PermissionType::ExternalDirectory => write!(f, "external_directory"),
            PermissionType::DoomLoop => write!(f, "doom_loop"),
            PermissionType::Document => write!(f, "document"),
            PermissionType::Question => write!(f, "question"),
        }
    }
}

impl PermissionType {
    /// 从字符串解析权限类型
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "*" | "wildcard" => Some(Self::Wildcard),
            "read" => Some(Self::Read),
            "edit" => Some(Self::Edit),
            "glob" => Some(Self::Glob),
            "grep" => Some(Self::Grep),
            "list" => Some(Self::List),
            "bash" => Some(Self::Bash),
            "powershell" | "pwsh" | "power_shell" => Some(Self::Powershell),
            "write_script" => Some(Self::WriteScript),
            "task" => Some(Self::Task),
            "skill" => Some(Self::Skill),
            "webfetch" | "web_fetch" => Some(Self::WebFetch),
            "websearch" | "web_search" => Some(Self::WebSearch),
            "external_directory" => Some(Self::ExternalDirectory),
            "doom_loop" => Some(Self::DoomLoop),
            "document" => Some(Self::Document),
            "question" => Some(Self::Question),
            _ => None,
        }
    }

    /// 根据工具名推断权限类型
    /// 用于将工具调用映射到权限检查
    pub fn from_tool_name(tool_name: &str) -> Self {
        match tool_name {
            "read" | "hash" | "exists" | "file_info" => Self::Read,
            "edit" | "write" | "apply_patch" | "remove" | "rename" | "copy" | "mkdir" => Self::Edit,
            "remove_dir" => Self::Edit,
            "glob" => Self::Glob,
            "grep" | "search" => Self::Grep,
            "list" => Self::List,
            "bash" => Self::Bash,
            "powershell" => Self::Powershell,
            "write_script" => Self::WriteScript,
            "task" => Self::Task,
            "webfetch" => Self::WebFetch,
            "websearch" => Self::WebSearch,
            // question 工具映射到 Question 权限类型(独立类别)
            "question" => Self::Question,
            // v1.1: 文档 Handler 映射到 Document 权限类型
            "docx" | "xlsx" | "pptx" | "pdf" => Self::Document,
            // T3.08: skill 工具映射到 Skill 权限类型
            "skill" => Self::Skill,
            // T3.08: source_code 工具映射到 Read 权限类型(只读搜索)
            "source_code" => Self::Read,
            _ => Self::Wildcard,
        }
    }

    /// 判断该权限类型是否为修改类(在 Plan 模式下应被拒绝)
    /// Plan 模式只允许只读操作
    /// v1.1: 新增 Document 类型(文档 Handler 可生成/修改文档)
    pub fn is_modification(&self) -> bool {
        matches!(
            self,
            PermissionType::Edit
                | PermissionType::Bash
                | PermissionType::Powershell
                | PermissionType::WriteScript
                | PermissionType::Task
                | PermissionType::WebFetch
                | PermissionType::WebSearch
                | PermissionType::Document
        )
    }

    /// 返回用于错误消息的工具类别名称
    pub fn category_name(&self) -> &'static str {
        match self {
            PermissionType::Edit => "edit",
            PermissionType::Bash => "bash",
            PermissionType::Powershell => "powershell",
            PermissionType::WriteScript => "write_script",
            PermissionType::Task => "task",
            PermissionType::WebFetch => "webfetch",
            PermissionType::WebSearch => "websearch",
            PermissionType::Document => "document",
            _ => "modification",
        }
    }
}

/// 权限规则作用域
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum RuleScope {
    /// 全局规则:对所有项目生效
    #[default]
    Global,
    /// 项目规则:对指定工作区生效
    Project,
    /// 会话临时规则:仅当前会话生效
    Session,
}

/// 用户审批回复
/// 对应 OpenCode 的 once/reject
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PermissionResponse {
    /// 仅本次允许:下次相同操作仍需询问
    Once,
    /// 拒绝本次操作
    Reject,
}

impl PermissionResponse {
    /// 从字符串解析用户回复（用于 permission_respond 命令）
    /// 接受 "once" / "reject"（大小写不敏感）
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "once" => Some(Self::Once),
            "reject" => Some(Self::Reject),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// powershell 权限类型必须在 Display / serde / from_str 三方保持同一字符串
    /// 原因：规则写库用 Display（permission_repo.rs），读库用 from_str，
    /// 前端与 HTTP 接口用 serde；任一方不一致会让用户规则静默退化为 Wildcard
    #[test]
    fn test_powershell_permission_type_name_consistency() {
        assert_eq!(PermissionType::Powershell.to_string(), "powershell");
        assert_eq!(
            serde_json::to_string(&PermissionType::Powershell).unwrap(),
            "\"powershell\""
        );
        assert_eq!(
            serde_json::from_str::<PermissionType>("\"powershell\"").unwrap(),
            PermissionType::Powershell
        );
        assert_eq!(
            PermissionType::from_str("powershell"),
            Some(PermissionType::Powershell)
        );
    }

    /// 常见别名也应能解析，便于用户手写规则
    #[test]
    fn test_powershell_permission_type_aliases() {
        assert_eq!(
            PermissionType::from_str("pwsh"),
            Some(PermissionType::Powershell)
        );
        assert_eq!(
            PermissionType::from_str("PowerShell"),
            Some(PermissionType::Powershell)
        );
    }

    /// 写库(Display) -> 读库(from_str) 必须无损往返
    #[test]
    fn test_powershell_permission_type_roundtrip_through_db_string() {
        let stored = PermissionType::Powershell.to_string();
        assert_eq!(
            PermissionType::from_str(&stored),
            Some(PermissionType::Powershell)
        );
    }

    #[test]
    fn test_powershell_permission_type_mapping() {
        assert_eq!(
            PermissionType::from_tool_name("powershell"),
            PermissionType::Powershell
        );
        // bash 与 powershell 是两个独立权限类别，不可互相串用
        assert_eq!(PermissionType::from_tool_name("bash"), PermissionType::Bash);
        // 执行命令属修改类操作，Plan 模式下应被拒绝
        assert!(PermissionType::Powershell.is_modification());
        assert_eq!(PermissionType::Powershell.category_name(), "powershell");
    }
}
