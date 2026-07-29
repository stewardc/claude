# Obsidian Vault Plugin — Design

**Date:** 2026-07-29
**Status:** approved, not yet implemented

## Problem

The `obsidian-vault` skill works, but only on this machine. It hardcodes a vault path
(inconsistently — the description says `~/Documents/Claude`, the body says
`~/Documents/ClaudeVault`, and only the former exists), it hardcodes one user's PARA
conventions, and its proactive-capture behavior actually comes from
`~/.claude/CLAUDE.md` rather than from the skill itself. None of that survives being
handed to someone else.

## Goal

An installable Claude Code plugin. Target workflow:

1. Install Obsidian
2. Create a vault
3. `/plugin marketplace add stewardc/claude`
4. `/plugin install obsidian-vault`
5. `/vault-setup` — once per machine
6. Claude finds the vault and files notes into it from any directory, in every session

Must work on macOS, native Windows, and WSL.

## Architecture

Three pieces with one dependency each:

| Piece | Responsibility | Depends on |
| --- | --- | --- |
| `resolve-vault.js` | Find the vault. Emit JSON. | Obsidian's registry, the config file |
| SessionStart hook | Tell Claude the path each session, or nudge. | The config file only |
| `obsidian-vault` skill | How to file, when to capture. | The vault's own `CLAUDE.md` |

The load-bearing idea: **the plugin owns mechanism, the vault owns policy.** Filing
conventions live in a `CLAUDE.md` at the vault root, seeded by setup and thereafter
owned by the user. A user who doesn't want PARA edits their vault, not the plugin.

### Repo layout

The repo becomes a single-plugin marketplace, so install is two commands rather than a
manual clone.

```
claude/
├── .claude-plugin/
│   ├── marketplace.json      # plugins: [{ name: "obsidian-vault", source: "./" }]
│   └── plugin.json           # name, version, description, author, license
├── commands/
│   └── vault-setup.md
├── hooks/
│   ├── hooks.json            # SessionStart, matcher: startup|clear|compact
│   ├── run-hook.cmd          # cmd.exe shim so the hook runs on native Windows
│   └── session-start.js
├── scripts/
│   ├── resolve-vault.js
│   └── lib/
│       ├── registry.js       # locate + parse obsidian.json per platform
│       ├── wsl.js            # WSL detection, C:\ → /mnt/c path translation
│       └── scaffold.js       # idempotent folder/template/CLAUDE.md creation
├── skills/obsidian-vault/
│   ├── SKILL.md
│   └── templates/            # 6 note templates, seeded into the vault
├── test/
│   ├── fixtures/             # fake homedirs + obsidian.json per platform
│   └── *.test.js
├── docs/superpowers/specs/
├── LICENSE
└── README.md
```

Node is the implementation language for all scripts. Claude Code bundles it, so there
is no new dependency; `os.homedir()` and `path` remove most platform branching; and one
implementation avoids a bash/PowerShell pair drifting out of sync. Native Windows needs
only the `.cmd` shim for the hook, the same approach the `superpowers` plugin uses.

## Component: `resolve-vault.js`

Prints a JSON object to stdout and exits 0. Callers (hook, setup command, skill
fallback) all consume the same contract.

```json
{
  "vaultPath": "/Users/stewardc/Documents/Claude",
  "source": "config" | "env" | "registry" | "glob",
  "platform": "darwin" | "win32" | "linux" | "wsl",
  "candidates": [{ "path": "...", "open": true, "id": "..." }]
}
```

`vaultPath` is `null` when nothing resolves. `candidates` lists everything the registry
knew about, and is populated only when the registry was actually consulted — that is,
when resolution did not short-circuit at the env var or config file. Setup passes
`--all` to force a full scan so it can always offer alternatives. Errors are reported as `{ "vaultPath": null, "error":
"..." }` rather than a non-zero exit, so the hook never breaks a session.

### Resolution order

First hit wins.

1. **`OBSIDIAN_VAULT` env var.** Escape hatch; always wins, never cached over.
2. **`~/.claude/obsidian-vault.json`.** The cached result of setup.
3. **Obsidian's registry.** Per platform:
   - darwin — `~/Library/Application Support/obsidian/obsidian.json`
   - win32 — `%APPDATA%\obsidian\obsidian.json`
   - linux — `${XDG_CONFIG_HOME:-~/.config}/obsidian/obsidian.json`, plus flatpak
     (`~/.var/app/md.obsidian.Obsidian/config/obsidian.json`) and snap
     (`~/snap/obsidian/current/.config/obsidian/obsidian.json`)
   - wsl — the Linux paths above **and** the Windows-side registry (see below)
4. **Depth-limited glob** for directories containing `.obsidian/`, under `~/Documents`,
   `~`, the iCloud Obsidian directory, and OneDrive. Max depth 3; skips dotfiles and
   `node_modules`.

The registry format is `{"vaults": {"<id>": {"path": "...", "ts": N, "open": true}}}`.
Entries whose `path` no longer exists on disk are dropped.

### WSL

The hard case, because Claude Code runs in Linux while Obsidian is typically installed
on the Windows host. Both possibilities are checked, and Linux-side is checked first.

- **Detection:** `WSL_DISTRO_NAME` is set, or `/proc/version` contains `microsoft`
  (case-insensitive).
- **Windows registry:** glob `/mnt/*/Users/*/AppData/Roaming/obsidian/obsidian.json`.
  Globbing rather than assuming `/mnt/c` and a username, since drive letter and Windows
  username both vary and need not match the Linux user.
- **Path translation:** vault paths in that registry are Windows paths (`C:\Users\me\
  Documents\Vault`). Translate with `wslpath -u`, falling back to a regex
  (`/^([A-Za-z]):[\\/]/` → `/mnt/<lowercased letter>/`, backslashes to forward slashes)
  if `wslpath` is unavailable.
- Translated paths are verified to exist before being offered.

A vault on `/mnt/c` is slower to read and write than a native Linux path, but correct.
Not worth mitigating.

## Component: SessionStart hook

Registered for `startup|clear|compact`. Reads `~/.claude/obsidian-vault.json` and
nothing else — no registry parsing, no globbing — so it stays fast on every session.

- **Configured:** emits roughly three lines — the resolved vault path, an instruction to
  capture decisions, plans, and todos there proactively, and a pointer to the
  `obsidian-vault` skill for conventions.
- **Not configured:** emits a single line telling the user to run `/vault-setup`. This
  fires in every session until setup is run, regardless of whether Obsidian is
  installed. That is deliberate: installing the plugin signals intent to use it, the
  whole point is capture that happens without being asked, and `/vault-setup` can create
  a vault from scratch — so the message is always actionable. A user who doesn't want it
  should uninstall the plugin.

The hook never fails a session: any error path emits nothing and exits 0.

## Component: the skill

`SKILL.md` is rewritten to carry mechanism only. Both hardcoded paths disappear, along
with the `ClaudeVault` typo and the `whatsupfv`-specific note.

It keeps:

- when to capture proactively (decisions with rationale, plans, todo lists) and the
  proportionality rule — durable value yes, transient chatter no
- the filing decision procedure, expressed against roles rather than literal folder
  names, deferring to the vault's `CLAUDE.md` for the mapping
- look before you write: grep/glob the vault and update an existing note rather than
  creating a near-duplicate
- keep captured notes current — check off completed tasks, amend reversed decisions
- use the session's real current date, never a placeholder
- read the matching file in the vault's `Templates/` before creating a typed note

It gains a fallback: if the hook's context is absent (hooks disabled, a different
harness), run `node "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-vault.js"` and use that. If
that yields nothing, tell the user to run `/vault-setup` instead of guessing a path.

The proactive-capture protocol currently in `~/.claude/CLAUDE.md` moves here, so the
behavior travels with the plugin.

## Component: `/vault-setup`

1. Run `resolve-vault.js`.
2. **Confirm.** One candidate → confirm it. Several → list them and ask, defaulting to
   the one the registry marks `"open": true`. None → offer to create a directory with a
   `.obsidian/` marker, and tell the user to open it in Obsidian once so Obsidian
   registers it.
3. **Scaffold missing folders:** `00-Inbox`, `01-Projects`, `02-Areas`, `03-Resources`,
   `04-Archive`, `Notes`, `Daily`, `Templates`, `Attachments`. Creates only what is
   absent. Never modifies or deletes existing content.
4. **Seed policy:** write `CLAUDE.md` at the vault root with the PARA table, tag and
   frontmatter conventions, and filing rules — **skipped entirely if one already
   exists**, since it is user-owned from that point on. Copy the six templates into
   `Templates/`, skipping any that exist.
5. **Offer write permission.** Plugins cannot grant tool permissions, so without an
   allowlist entry every vault write prompts. Ask, and on yes append `Write` and `Edit`
   rules scoped to the vault path to `~/.claude/settings.json`. Never silent, never
   broader than the vault.
6. **Cache** `{vaultPath, platform, configuredOn}` to `~/.claude/obsidian-vault.json`.
7. Print a summary: path, what was created, what was skipped, whether permissions were
   added.

Re-running is safe and is also how a user switches vaults.

## Testing

`node --test`, with `HOME`/`APPDATA`/`XDG_CONFIG_HOME` pointed at fixture directories.

Registry resolution: darwin, win32, linux, linux-flatpak, WSL with Windows-side
Obsidian, WSL with Linux-side Obsidian, multiple vaults (correct `open: true` default),
no registry present, malformed JSON, registry listing a path that no longer exists.

WSL translation, as unit tests: `C:\` and `D:\` drives, spaces in paths, `wslpath`
present and absent.

Scaffold: empty vault, fully-populated vault (asserting nothing is rewritten), partially
populated vault, and a vault with a pre-existing `CLAUDE.md` (asserting it is left
untouched).

Hook: configured, unconfigured, and unreadable-config — all three exit 0.

macOS is the only platform executable here. Windows and WSL are covered by fixtures and
need a real-machine smoke test before the plugin is considered done; this is a known
gap, not a silent one.

## Out of scope

- Switching vaults without re-running `/vault-setup`
- Obsidian plugin or `obsidian://` URI integration
- Sync-conflict handling (Obsidian Sync, iCloud, Git)
- Reading Obsidian's own per-vault config to infer folder conventions
