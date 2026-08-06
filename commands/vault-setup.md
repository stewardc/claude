---
description: Find or create the user's Obsidian vault, scaffold it, and wire it into every Claude Code session
---

# Vault setup

Set up the Obsidian vault for this machine. Re-running this is safe, and is also how the
user switches to a different vault.

Work through these steps in order. Report as you go; don't dump a wall of text at the end.

## 1. Resolve

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-vault.js" --all
```

This prints `{ vaultPath, source, platform, candidates }`. `--all` forces a full scan, so
`candidates` lists every vault found even when one was already configured.

## 2. Confirm the vault with the user

- **One candidate** → show the path and ask the user to confirm it.
- **Several candidates** → list them and ask which one. Default to the one marked
  `"open": true` (the vault Obsidian currently has open) and say that's why.
- **No candidates** → offer to create one. Ask for a location (suggest
  `~/Documents/Obsidian`), then create the directory plus an empty `.obsidian/`
  subdirectory inside it — that marker is what identifies a vault. Tell the user to open
  it in Obsidian once so Obsidian registers it too.

Do not skip this confirmation, even when there is only one obvious candidate. Never pick
silently.

## 3 & 4. Scaffold folders, templates, and policy

With `<vault>` confirmed, run:

```bash
node -e "const {scaffoldVault}=require('${CLAUDE_PLUGIN_ROOT}/scripts/lib/scaffold.js');console.log(JSON.stringify(scaffoldVault(process.argv[1]),null,2))" "<vault>"
```

This is strictly additive and idempotent:

- Creates any missing folders: `00-Inbox`, `01-Projects`, `02-Areas`, `03-Resources`,
  `04-Archive`, `Notes`, `Daily`, `Templates`, `Attachments`.
- Copies the six note templates into `Templates/`, **skipping any that already exist**.
- Writes `CLAUDE.md` at the vault root — the filing policy the skill reads — but **skips
  it entirely if one already exists**, since it is user-owned from that point on.

It never modifies or deletes existing content. Report its `created` and `skipped` lists.

## 5. Offer write permission

Plugins can't grant tool permissions, so without an allowlist entry every vault write
prompts the user.

**Ask first** — never do this silently. If the user agrees, add these two rules to the
`permissions.allow` array in `~/.claude/settings.json`, scoped to the vault and nothing
broader:

```
Write(//<vault>/**)
Edit(//<vault>/**)
```

Note the double leading slash — that's the form Claude Code expects for an absolute path.
Read the file, add only rules that aren't already present, and preserve all other
settings. If the user declines, say that writes will prompt each time, and move on.

## 6. Cache the result

```bash
node -e "const {writeConfig}=require('${CLAUDE_PLUGIN_ROOT}/scripts/lib/config.js');console.log(writeConfig({vaultPath:process.argv[1],platform:process.argv[2],configuredOn:process.argv[3]}))" "<vault>" "<platform>" "<today's real date, YYYY-MM-DD>"
```

Use the `platform` value from step 1 and the session's real current date. This writes
`~/.claude/obsidian-vault.json`, which is the only file the SessionStart hook reads.

## 7. Summarize

Print a short summary:

- the vault path, and how it was found
- what was created, and what was skipped because it already existed
- whether permission rules were added
- that the vault takes effect in the **next** session (the hook runs at session start),
  and that the user can edit the vault's `CLAUDE.md` to change how Claude files things
