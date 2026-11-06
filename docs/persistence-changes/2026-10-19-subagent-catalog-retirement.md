---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-19-subagent-catalog-retirement

English | [中文](2026-10-19-subagent-catalog-retirement.zh.md)

## Summary

Adds the subagent catalog payload version 3: a retirement record that removes one listed direct child from its parent's catalog without deleting the child Session.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-19-subagent-catalog-retirement
baseline: false
changes:
  - root: "event:subagent/catalog"
    previous: "2026-09-19-external-subagent-catalog"
    after: "d43a6ac0af51074abb2e2f5539bcee4c2324782bcfef99e64ff3a10e16ff4efa"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Reading older logs with this build: versions 0 through 2 parse unchanged, and a log without a retirement record produces exactly the same catalog view. The fold removes only identities named by a version-3 record and re-lists an identity when a later establishing record names it again. The released-format reader accepts version 3 and validates catalog membership over the current listing: a retirement removes the identity it names, and a later establishing record lists it again. Reading new logs with an older build: the older payload union rejects version 3, so the catalog projection refuses to restore instead of silently listing a retired child. Refusal, not silent misinterpretation, is the downgrade behavior, so the header version stays unchanged.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/subagent/subagent/tests: 490 passed, including the catalog retirement fold, re-establishment, and the retire Remote's live-parent, empty-id, repeat, and append-failure cases. pnpm exec vitest run packages/session/session-format-v3-to-v4/tests: 12 passed, including retirement acceptance, re-establishment, and malformed-payload rejection. pnpm exec vitest run packages/client/ui-subagent/tests: 117 passed, including the row removal control, its running and pending states, and the rejection notice.

<a id="dev-note"></a>
## Dev Note

None.
