// Copyright (C) 2026 lucan6290
// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
