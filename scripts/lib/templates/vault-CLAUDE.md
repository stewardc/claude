# Vault conventions

This file is **yours**. `/vault-setup` seeded it once and will never overwrite it.
Claude reads it to learn how you want notes filed here — edit it and Claude's
behavior changes. Don't use PARA? Rewrite the table below.

## Folders

| Folder | Holds | Rule of thumb |
| --- | --- | --- |
| `00-Inbox/` | Raw capture, unsorted | **Default when unsure.** Process weekly. |
| `01-Projects/` | Efforts with an outcome + rough deadline | Has a finish line. One subfolder per project. |
| `02-Areas/` | Ongoing responsibilities, no end date | Health, Finances, Dev practice, Home… |
| `03-Resources/` | Reference material by topic | Might be useful someday |
| `04-Archive/` | Completed / inactive | Anything no longer live |
| `Notes/` | Evergreen atomic notes | One idea per note, densely linked |
| `Daily/` | Daily notes `YYYY-MM-DD.md` | Journal + task capture |
| `Templates/` | Note templates | Read the matching one before creating a typed note |
| `Attachments/` | Images / PDFs / pasted files | Auto-target, don't hand-manage |

## Filing rules

- Project-specific → the matching `01-Projects/<name>/` folder. Create the folder and a
  project note from `Templates/Project.md` if it doesn't exist.
- A durable standalone idea → `Notes/`.
- Reference material → `03-Resources/`.
- Journal / today → `Daily/YYYY-MM-DD.md`, from `Templates/Daily.md`.
- Genuinely unsure → `00-Inbox/`.

## Note conventions

- **Frontmatter** on every note: `created: YYYY-MM-DD`, `type`, `tags`. Mirror the
  matching file in `Templates/`.
- **Tags encode status, not topic:** `#active` `#seedling` `#evergreen` `#someday`
  `#waiting`. Topic lives in `[[links]]`.
- **Links over folders.** Connect notes with `[[wiki-links]]`; keep folders shallow. The
  link target is the note's title (filename without `.md`).
- **Atomic notes.** One idea per note in `Notes/`. Promote `#seedling` → `#evergreen`
  once a note stands on its own.

## Where project work is logged

When Claude works in a code repo, it maps that repo to `01-Projects/<name>/` and appends
to that project note:

- `## Decisions` — `- YYYY-MM-DD — <decision> — <why>`
- `## Plans` — links to plan/spec notes
- `## Tasks` — checkboxes, kept current as work completes
