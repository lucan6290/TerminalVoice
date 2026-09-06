# 安全策略

> 中文 | [English](docs/SECURITY.en.md)

## 支持的版本

| 版本 | 支持状态 |
|---|---|
| `main` 分支最新代码 | ✅ 支持 |
| 历史 release | ❌ 不提供安全修复 |

> 仅支持 `main` 分支上的最新代码。

## 报告漏洞

如果你发现安全漏洞（例如任意文件读写、路径穿越、权限绕过、信息泄露或命令注入），请勿在公开的 issue 中披露。

请通过 GitHub Security Advisories 私密报告：

- **GitHub Security Advisories（推荐）**：通过仓库的 Security → Advisories 页面创建私有报告
- 仓库地址：`https://github.com/OWNER/TerminalVoice/security/advisories/new`（创建仓库后替换 `OWNER`）

### 报告应包含的信息

请尽量提供以下内容，以便快速定位与修复：

- 受影响的版本或提交
- 漏洞的详细描述与影响范围
- 复现步骤或 PoC（如可提供）
- 建议的修复方案（如已有）

### 响应与披露

- 我们会在 **3 个工作日内**确认收到报告
- 修复发布前，请对漏洞细节保密（协调披露）
- 修复发布后，会在 security advisory 中公开致谢（如需匿名请注明）

## 范围

以下情况通常**不视为安全漏洞**：

- 需要物理访问或已具备目标机器权限才能利用的问题
- 影响有限的拒绝服务（DoS）
- 第三方依赖的已知漏洞（请升级依赖，而非报告）
