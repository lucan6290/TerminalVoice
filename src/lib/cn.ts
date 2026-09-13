// Copyright (C) 2026 lucan6290
// SPDX-License-Identifier: GPL-3.0-or-later
/** 简易 className 合并工具 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
