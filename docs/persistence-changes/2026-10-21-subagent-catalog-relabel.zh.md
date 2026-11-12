---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-21-subagent-catalog-relabel

[English](2026-10-21-subagent-catalog-relabel.md) | 中文

## 概述

新增 subagent 目录载荷版本 5：一条重贴标签记录，替换某个已列出的直接子会话的显示标签，但不改变它的身份、模式、创建时间或目录位置。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-10-21-subagent-catalog-relabel
baseline: false
changes:
  - root: "event:subagent/catalog"
    previous: "2026-10-19-subagent-catalog-retirement"
    after: "0353fdce84e57274d57f1bf370bf91d3b251e9b2728023b15fb08f8b3964cefe"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

用本版本读取旧日志：版本 0 到 4 的解析保持不变，不含重贴标签记录的日志会得到完全相同的目录视图。折叠只会把重贴标签应用在更早记录已经列出的身份上，因此对未列出身份的重贴标签不改变任何视图；退役仍然移除其身份，后续建立记录仍然会重新列出它。已发布格式的读取器接受版本 5，并把重贴标签视为与成员关系无关的记录：它既不满足也不违反唯一列出规则。用旧版本读取新日志：旧的载荷联合类型会拒绝版本 5，因此目录投影会拒绝恢复，而不是静默显示过期的标签。降级行为是拒绝而非静默误读，因此头部版本保持不变。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/subagent/subagent/tests packages/session/session-format-v3-to-v4/tests packages/client/ui-subagent/tests：1033 项通过（48 个文件），含原地重贴标签折叠、未列出身份的空操作、退役用例、重贴标签的接受、重复重贴标签与畸形载荷拒绝。pnpm run typecheck：5/5 个 gate 通过。

<a id="dev-note"></a>
## 开发备注

无。
