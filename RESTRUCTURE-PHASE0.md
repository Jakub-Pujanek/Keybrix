# RESTRUCTURE PHASE 0 - FROZEN DECISIONS

## 1. Scope

Phase 0 freezes implementation decisions for file-based macros and block registry before runtime migration.
No behavior changes are introduced in this phase.

## 2. Frozen Macro File Format v1

Each macro is stored in one JSON file in user data macros directory.

Required fields:
1. id: stable UUID-like identifier, immutable for macro lifetime.
2. name: editable display name shown on dashboard.
3. slug: normalized name used for file naming.
4. shortcut: start shortcut string.
5. isActive: activation toggle state.
6. status: current runtime state.
7. blocksJson: editor document with nodes and zoom.
8. createdAt: ISO datetime.
9. updatedAt: ISO datetime.
10. version: fixed value 1 for this format.

Example:

{
  "version": 1,
  "id": "macro-my-first",
  "name": "My First Macro",
  "slug": "my-first-macro",
  "shortcut": "CTRL+SHIFT+M",
  "isActive": false,
  "status": "IDLE",
  "blocksJson": {
    "zoom": 1,
    "nodes": []
  },
  "createdAt": "2026-04-08T10:00:00.000Z",
  "updatedAt": "2026-04-08T10:00:00.000Z"
}

## 3. Frozen Macros Index Format v1

Path: userData/macros/index.json

Required fields:
1. version: fixed value 1.
2. macros: array of entries.

Each entry:
1. id
2. slug
3. fileName
4. updatedAt

Example:

{
  "version": 1,
  "macros": [
    {
      "id": "macro-my-first",
      "slug": "my-first-macro",
      "fileName": "my-first-macro.json",
      "updatedAt": "2026-04-08T10:00:00.000Z"
    }
  ]
}

## 4. Frozen Slug Rules

1. Input source: macro name.
2. Lowercase.
3. Unicode normalization to remove diacritics.
4. Replace non alphanumeric characters with dash.
5. Collapse consecutive dashes.
6. Trim leading and trailing dashes.
7. Empty result fallback: macro.
8. Collision handling: append numeric suffix starting at -2.

Cross-platform constraints:
1. Forbidden Windows names are not allowed: con, prn, aux, nul, com1..com9, lpt1..lpt9.
2. Case-insensitive collision checks must be applied.
3. Maximum filename length target: 120 chars before .json.

## 5. Frozen Rename Policy

When macro name changes:
1. Keep id unchanged.
2. Compute new slug.
3. Resolve collisions.
4. Write updated macro content to temp file.
5. Rename temp file to target file.
6. Update index entry fileName and slug.
7. Remove old file only after index write succeeds.

Failure policy:
1. If any step fails, keep old file and old index unchanged.
2. Emit structured error log with correlation id.

## 6. Frozen My First Macro Policy

1. Stable id: macro-my-first.
2. Ensure-by-id during startup.
3. If missing, create full macro file with valid blocksJson.
4. Never overwrite if already exists.

## 7. Rollback Checklist

If migration rollout must be reverted:
1. Disable file-based macro store feature flag.
2. Stop rename and create file operations.
3. Keep existing macro files unchanged.
4. Rehydrate in-memory model from last known valid main store macros snapshot.
5. Preserve settings, logs, stats, audit stores.
6. Keep userData/macros backup directory for manual recovery.
7. Run integrity command to compare index entries against existing files.
8. Emit audit event: MIGRATION_ROLLBACK_EXECUTED.

## 8. Acceptance Gate for Phase 0

1. Macro file format v1 frozen.
2. Index format v1 frozen.
3. Slug rules frozen with collision and cross-platform safeguards.
4. Rename transaction policy frozen.
5. My First Macro ensure policy frozen.
6. Rollback checklist documented.
