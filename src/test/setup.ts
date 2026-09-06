import "@testing-library/jest-dom/vitest";
import { setLang } from "../lib/i18n";

// 测试默认语言固定为中文，保证组件断言文案与 i18n 字典 zh 一致
setLang("zh-CN");
