---
name: obsidian-vault
description: Use whenever a session produces a plan, a decision, a spec, or a todo list — including every exit from plan mode, and including work done inside a code repo, where these belong in the vault rather than in the repo. Use without being asked; do not wait for "save this". Also use when saving, capturing, looking up, or organizing notes, ideas, meeting notes, journal entries, or reference material, or when the user refers to "my vault", "my notes", or "the vault".
---

# Obsidian Vault

The user keeps a personal Obsidian knowledge base. It is the canonical destination for
notes, plans, decisions, and reference material, reachable from any working directory.

## Find the vault

1. **The SessionStart context.** This plugin's hook injects an `<obsidian-vault>` block
   naming the vault path at the start of every session. Use that path.
2. **If that context is absent** (hooks disabled, or a different harness), run:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-vault.js"`
   and use the `vaultPath` from the JSON it prints.
3. **If that yields `null`**, tell the user to run `/vault-setup`. Never guess a path and
   never create a vault somewhere hopeful.

Use absolute paths with your normal Read/Write/Edit/Glob/Grep tools. If writes prompt for
permission every time, `/vault-setup` can add a vault-scoped allowlist rule.

## Read the vault's own rules first

**`CLAUDE.md` at the vault root is the authority on filing.** It defines the folder
layout, tag and frontmatter conventions, and where project work is logged. Read it before
your first write in a session. The rules below are the defaults it was seeded with — when
it disagrees with them, it wins.

## Plans belong in the vault, not the repo

The most common way this skill gets missed: a planning session happens inside a code
repo, and the plan is written to `docs/plans/` or `PLAN.md` there because that's the
reflex. **Working in a repo is not a reason to file a plan in it.** Map the repo to its
project folder and write the plan there instead.

This applies to every plan-mode exit, every design doc, and every "here's how we'll do
it" write-up — whether or not the user asked for it to be saved.

Write a plan into the repo only when the user asked for an in-repo artifact: a committed
design doc, an RFC, a README, something the team will review in the diff. When a plan
genuinely belongs in both places, the vault note is canonical and the repo copy links
back to it.

## Capture proactively

Beyond explicit "save this" requests, record durable knowledge **as it emerges, without
being asked**:

- **Decisions** — an architectural or project choice *and its rationale*. Append to the
  project note's decisions log as `- YYYY-MM-DD — <decision> — <why>`.
- **Plans and specs** — write or update a note under the project's folder and link it
  from the project note.
- **Todo lists** — mirror actionable items into the project note's task list, and keep
  the checkbox state current: check items off there as they complete during the session.
- **Open questions and learnings** — context worth surviving the session.

**Be proportional.** Durable value yes; trivial chit-chat, one-off shell commands, and
transient debugging no. When genuinely torn about something durable, capture it briefly
rather than lose it.

**Be quiet about it.** This is part of the work, not a ceremony. One line — "logged that
decision to the vault" — is enough.

## Task Summary at the top of task-bearing notes

Any note whose body is organised into tasks — plans and specs with `## Task 1 — …`
headings, or a note with several task sections — carries a `## Task Summary` checklist as
its **first heading**, immediately before `## Goal` (or before whatever the first content
heading is, right after the title/date block):

```markdown
## Task Summary

- [x] Task 1 — Point compose files at `$IMAGE_TAG`
- [ ] Task 6 — Manual verification
```

- One checkbox per task section, in document order, using that section's heading text.
- A task is `[x]` only when every checkbox inside it is checked; anything partial stays
  `[ ]`. Note partial progress with a trailing `— in progress`, not a half-check.
- **Task headings keep their own status markers** (`## Task 5 — … ✅ DONE`,
  `⚠️ IN PROGRESS`) — the summary duplicates that state, it doesn't replace it. A reader
  partway down the note must be able to see whether the task they're reading is done
  without scrolling back to the top. Only the summary's own lines omit the marker, since
  the checkbox already carries it there.
- **Keep it in sync.** Whenever you check off a checkbox inside a task section, update the
  summary in the same edit. When you add, remove, or retitle a task, mirror it.
- Add the summary the first time you touch an existing task-bearing note that lacks one.
- Single-task notes and plain `## Tasks` checklists don't need it — the list is already
  the summary.

## Filing

Match content to the role of a folder, not to a literal name — the vault's `CLAUDE.md`
supplies the actual mapping. Typical roles:

| Role | Goes to |
| --- | --- |
| Belongs to a project with a finish line | that project's folder; create it and a project note if absent |
| A durable standalone idea | the evergreen/atomic notes folder |
| Reference material on a topic | the resources folder |
| Journal / today | today's daily note, `YYYY-MM-DD` |
| Genuinely unsure | the inbox — the correct default, not a failure |

When working in a code repo, map the repo to its matching project folder (repo
`~/code/foo` → the project named `foo`) and log there. Create the project note and folder
if they don't exist yet.

## Rules

- **Look before you write.** Grep/Glob the vault for the topic first. Update the existing
  note rather than creating a near-duplicate. When a new decision reverses an earlier one,
  amend the log entry — don't silently contradict it.
- **Keep notes current.** Check off completed tasks; update status tags.
- **Read the template first.** Before creating a typed note, read the matching file in
  the vault's `Templates/` folder so frontmatter and headings match. Fill template
  placeholders (`{{title}}`, `{{date:YYYY-MM-DD}}`) with real values.
- **Frontmatter** on every note: `created`, `type`, `tags` — mirroring the template.
- **Tags encode status, not topic** (`#active`, `#seedling`, `#evergreen`, `#someday`,
  `#waiting`). Express topic through `[[links]]`.
- **Link, don't nest.** Prefer `[[wiki-links]]` over deep folders. The link target is the
  note's title — its filename without `.md`.
- **Dates:** use the session's real current date. Never a placeholder, never a guess.
