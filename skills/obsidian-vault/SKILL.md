---
name: obsidian-vault
description: Use when the user asks to save, capture, look up, or organize notes, plans, ideas, meeting notes, decisions, daily journal entries, or reference material — or refers to "my vault", "my notes", or "the vault". A personal Obsidian PARA vault lives at ~/Documents/Claude and is the canonical home for all such content across every session and folder.
---

# Obsidian Vault

The user keeps a personal Obsidian knowledge base at **`~/Documents/ClaudeVault`**. It is the canonical destination for notes, plans, ideas, and reference material — reachable from any working directory. Writes there are pre-approved in `~/.claude/settings.json`, so use your native Read/Write/Edit/Glob/Grep tools with absolute paths; do not prompt or hesitate.

**Capture proactively.** Beyond explicit "save this" requests, record durable knowledge as it emerges — decisions (with rationale), plans/specs, and todo lists — and keep those notes up to date (check off tasks, amend reversed decisions) without being asked. See the Knowledge capture protocol in `~/.claude/CLAUDE.md`. Be proportional: durable value yes, trivial chatter no.

## Structure (PARA + capture + slipbox)

| Folder | Put here |
| --- | --- |
| `00-Inbox/` | Anything unsorted / quick capture. **Default when unsure.** |
| `01-Projects/` | Efforts with an outcome + deadline. One subfolder per project (e.g. `01-Projects/whatsupfv/`). |
| `02-Areas/` | Ongoing responsibilities with no end date (Health, Finances, Dev, Home…). |
| `03-Resources/` | Topic reference material (snippets, tools, articles). |
| `04-Archive/` | Completed / inactive items. |
| `Notes/` | Evergreen **atomic** notes — one idea each, densely `[[linked]]`. The second-brain core. |
| `Daily/` | Daily notes named `YYYY-MM-DD.md`. Journal + task capture. |
| `Templates/` | Note templates — read one before creating a typed note so frontmatter matches. |
| `Attachments/` | Images / PDFs / binaries. |

## Rules

- **Filing:** project-specific → the matching `01-Projects/<name>/` folder; a durable standalone idea → `Notes/`; reference → `03-Resources/`; journal/today → `Daily/YYYY-MM-DD.md`; genuinely unsure → `00-Inbox/`.
- **Frontmatter:** every note starts with `---` containing `created: YYYY-MM-DD`, `type`, and `tags`. Mirror the relevant file in `Templates/`.
- **Tags encode status, not topic:** `#active` `#seedling` `#evergreen` `#someday` `#waiting`. Express topic through `[[links]]`.
- **Links over folders:** connect notes with `[[wiki-links]]`; keep folders shallow. Use the note's title (filename without `.md`) as the link target.
- **Look things up** by Grep/Glob over `~/Documents/Claude` before assuming a note doesn't exist. Check for and update an existing note rather than duplicating.
- **Dates:** use the real current date (from the session's date context), never a placeholder.
- The `whatsupfv` project has a map-of-content at `~/Documents/Claude/01-Projects/whatsupfv/whatsupfv.md` — record plans/decisions there when working in that repo.

Full conventions live in `~/Documents/ClaudeVault/README.md`.
