//! 语音技能模块
//!
//! 预设多种语音输入模板，每种模板通过 system prompt 修改 LLM 的行为，
//! 实现英文输出、清单格式、汇报格式、听写模板等场景化输出。

use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceSkill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub prompt: String,
}

/// 返回所有预设技能列表。
pub fn list_skills() -> Vec<VoiceSkill> {
    vec![
        VoiceSkill {
            id: "english".to_string(),
            name: "英文输出".to_string(),
            description: "将中文语音内容翻译为英文输出".to_string(),
            prompt: "你是语音转写翻译器。将用户的语音转写内容翻译为自然、准确的英文。只返回英文译文，不要解释，不要添加引号或 Markdown 代码块。".to_string(),
        },
        VoiceSkill {
            id: "list".to_string(),
            name: "清单模式".to_string(),
            description: "将语音内容整理为条目清单".to_string(),
            prompt: "你是语音转写整理器。将用户的语音转写内容整理为清晰的条目清单。每条以「• 」开头，提取关键信息，删除冗余语气词。只返回清单正文，不要解释。".to_string(),
        },
        VoiceSkill {
            id: "report".to_string(),
            name: "汇报格式".to_string(),
            description: "将语音内容整理为工作汇报格式".to_string(),
            prompt: "你是语音转写整理器。将用户的语音转写内容整理为结构化的工作汇报格式，包含「工作进展」「存在问题」「下一步计划」等小节（根据内容自动判断适用哪些）。只返回汇报正文，不要解释。".to_string(),
        },
        VoiceSkill {
            id: "dictation".to_string(),
            name: "听写模板".to_string(),
            description: "原样输出语音内容，仅修正错别字".to_string(),
            prompt: "你是语音转写整理器。严格保留用户的原始内容和语气，仅修正语音识别中的错别字、同音误识别和标点。不改变用词，不删减内容，不优化表达。只返回修正后的正文，不要解释。".to_string(),
        },
    ]
}

/// 根据 ID 查找技能。
pub fn find_skill(id: &str) -> Option<VoiceSkill> {
    list_skills().into_iter().find(|s| s.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_skills_returns_expected_entries() {
        let skills = list_skills();
        assert!(skills.len() >= 4);
        assert!(skills.iter().any(|s| s.id == "english"));
        assert!(skills.iter().any(|s| s.id == "list"));
        assert!(skills.iter().any(|s| s.id == "report"));
        assert!(skills.iter().any(|s| s.id == "dictation"));
    }

    #[test]
    fn find_skill_returns_correct_entry() {
        let skill = find_skill("english").expect("should find english skill");
        assert_eq!(skill.name, "英文输出");
        assert!(!skill.prompt.is_empty());
    }

    #[test]
    fn find_skill_returns_none_for_unknown() {
        assert!(find_skill("nonexistent").is_none());
    }

    #[test]
    fn all_skills_have_non_empty_prompt() {
        for skill in list_skills() {
            assert!(!skill.prompt.is_empty(), "skill {} has empty prompt", skill.id);
        }
    }
}
