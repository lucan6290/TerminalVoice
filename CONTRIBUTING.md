# 贡献指南

感谢对 TerminalVoice 的贡献！请遵循以下规范。

## 提交规范

- 格式：`类型: 简要描述`（中文描述），单次提交只含一个功能/一个修复
- 类型前缀：

| 类型 | 说明 |
|---|---|
| `feat:` | 新功能 |
| `fix:` | 修复 bug |
| `docs:` | 文档 |
| `refactor:` | 重构 |
| `perf:` | 性能优化 |
| `test:` | 测试 |
| `build:` / `ci:` | 构建 / CI |
| `chore:` | 依赖、杂项 |

> 版本发布提交用 `release: vX.Y.Z`，不纳入 CHANGELOG 分类。

## 开发流程

1. Fork 并 clone 仓库
2. 创建功能分支
3. 本地开发：`pnpm install` → `pnpm tauri dev`
4. 提交前运行质量检查：
   - 前端类型检查与构建：`pnpm build`
   - 前端测试：`pnpm test`
   - Rust 测试：`cargo test`（在 `src-tauri/` 目录下）
5. 提交 PR，说明变更内容

## 技术栈参考

- 前端：React 19 + TypeScript 5.7 + Tailwind CSS v4 + Vite 8
- 后端：Rust（Tauri v2）
- 数据库：SQLite
- 测试：Vitest 3（前端）+ Rust 内置 `#[cfg(test)]`（后端）
- 详细结构见 [AGENTS.md](AGENTS.md) 与 [docs/CODE_MAP.md](docs/CODE_MAP.md)

## 报告问题

- **Bug 报告**：说明环境（Windows 版本 / TerminalVoice 版本）、复现步骤、预期与实际行为
- **功能请求**：说明使用场景与预期效果

## 代码规范

- 遵循项目已有的代码风格与 lint 规则
- 前端使用 Tailwind CSS v4 原子类，className 合并通过 `src/lib/cn.ts`
- Rust 端遵循 rustfmt 规范
- 任何涉及 IPC/状态机/共享类型的变更必须同步更新文档（见 AGENTS.md「文档实时同步规则」）
- 提交前通过全部测试

## 行为准则

参与本项目请遵守 [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)。
