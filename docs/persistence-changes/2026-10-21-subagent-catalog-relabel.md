---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-21-subagent-catalog-relabel

English | [中文](2026-10-21-subagent-catalog-relabel.zh.md)

## Summary

Adds the subagent catalog payload version 5: a relabel record that replaces the display label of one listed direct child without changing its identity, mode, creation time, or catalog position.

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
    after: "0353fdce84e57274d57f1bf370bf91d3b251e9b2728023b15fb08f8b3964cefe"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Reading older logs with this build: versions 0 through 4 parse unchanged, and a log without a relabel record produces exactly the same catalog view. The fold applies a relabel only to an identity an earlier record already listed, so a relabel for an unlisted identity changes no view; a retirement still removes its identity, and a later establishing record still re-lists it. The released-format reader accepts version 5 and treats a relabel as a membership-neutral record: it neither satisfies nor violates the single-listing rule. Reading new logs with an older build: the older payload union rejects version 5, so the catalog projection refuses to restore instead of silently showing a stale label. Refusal, not silent misinterpretation, is the downgrade behavior, so the header version stays unchanged.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/subagent/subagent/tests packages/session/session-format-v3-to-v4/tests packages/client/ui-subagent/tests: 1033 passed (48 files), including the in-place relabel fold, the unlisted-identity no-op, retirement cases, relabel acceptance, repeated relabels, and malformed-payload rejection. pnpm run typecheck: 5/5 gates passed.

<a id="dev-note"></a>
## Dev Note

None.
