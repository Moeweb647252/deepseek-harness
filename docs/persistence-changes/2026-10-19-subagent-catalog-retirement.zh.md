---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-19-subagent-catalog-retirement

[English](2026-10-19-subagent-catalog-retirement.md) | 中文

## 概述

新增 subagent 目录载荷版本 4：一条退役记录，把某个已列出的直接子会话从父会话目录中移除，但不删除子会话本身。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-10-19-subagent-catalog-retirement
baseline: false
changes:
  - root: "event:subagent/catalog"
    previous: "2026-11-02-subagent-catalog-names"
    after: "d43a6ac0af51074abb2e2f5539bcee4c2324782bcfef99e64ff3a10e16ff4efa"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

用本版本读取旧日志：版本 0 到 3 的解析保持不变，不含退役记录的日志会得到完全相同的目录视图。折叠只会移除被版本 4 记录点名的身份，并且当后续的建立记录再次点名同一身份时会重新列出它。已发布格式的读取器接受版本 4，并按当前列表校验目录成员关系：退役会移除被点名的身份，后续建立记录会再次列出它。用旧版本读取新日志：旧的载荷联合类型会拒绝版本 4，因此目录投影会拒绝恢复，而不是静默列出已退役的 child。降级行为是拒绝而非静默误读，因此头部版本保持不变。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/subagent/subagent/tests packages/session/session-format-v3-to-v4/tests packages/client/ui-subagent/tests：1033 项通过（48 个文件），含目录退役折叠、重新列出、retire Remote 的在线 parent、空 id、重复调用与追加失败用例、退役记录的接受以及畸形载荷拒绝。pnpm run typecheck：5/5 个 gate 通过。

<a id="dev-note"></a>
## 开发备注

无。
