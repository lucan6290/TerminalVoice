# AGENTS.md — src/test/ 测试配置

> Vitest 全局测试配置，不含业务代码。

## 文件

| 文件 | 职责 |
| :--- | :--- |
| [setup.ts](setup.ts) | Vitest setup，引入 `@testing-library/jest-dom/vitest`（扩展断言 matcher） |

## 约定

- 测试运行环境为 **jsdom**（见 [vitest.config.ts](../../vitest.config.ts)），`globals: true`（无需手动 import `describe/it/expect`）。
- setup 文件已通过 `vitest.config.ts` 的 `setupFiles` 自动加载，**不要在每个测试文件里重复引入 jest-dom**。
- 测试文件与源文件同目录，命名 `*.test.ts` / `*.test.tsx`（如 `components/PreviewPopup.test.tsx`、`stores/appStore.test.ts`）。
- 组件测试用 `@testing-library/react` + `@testing-library/user-event`。

## 新增测试

- 新增测试直接放在被测模块旁，不要堆在本目录。
- 本目录只放全局 setup 类配置，不新增业务测试。
