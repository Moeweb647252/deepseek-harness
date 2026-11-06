---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-21-subagent-catalog-relabel

English | [中文](2026-10-21-subagent-catalog-relabel.zh.md)

## Summary

Adds the subagent catalog payload version 4: a relabel record that replaces the display label of one listed direct child without changing its identity, mode, creation time, or catalog position.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-21-subagent-catalog-relabel
baseline: false
changes:
  - root: "event:subagent/catalog"
    previous: "2026-10-19-subagent-catalog-retirement"
    after: "c3450da33692ce941c79fd3044248800d56eebcf714f87233106fd4d51243c17"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Reading older logs with this build: versions 0 through 3 parse unchanged, and a log without a relabel record produces exactly the same catalog view. The fold applies a relabel only to an identity an earlier record already listed, so a relabel for an unlisted identity changes no view; a retirement still removes its identity, and a later establishing record still re-lists it. The released-format reader accepts version 4 and treats a relabel as a membership-neutral record: it neither satisfies nor violates the single-listing rule. Reading new logs with an older build: the older payload union rejects version 4, so the catalog projection refuses to restore instead of silently showing a stale label. Refusal, not silent misinterpretation, is the downgrade behavior, so the header version stays unchanged.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/subagent/subagent/tests: 490 passed, including the in-place relabel fold, the unlisted-identity no-op, and the retirement cases. pnpm exec vitest run packages/session/session-format-v3-to-v4/tests: 12 passed, including relabel acceptance, repeated relabels, and malformed-payload rejection. pnpm exec vitest run packages/client/ui-subagent/tests: 117 passed, including the sidebar chat title preferring the parent catalog label over the child descriptor label.

<a id="dev-note"></a>
## Dev Note

None.
