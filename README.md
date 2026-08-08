# obsidian-vault

A Claude Code plugin that finds your Obsidian vault and proactively files decisions,
plans, and todos into it — from any working directory, in every session.

Works on macOS, native Windows, and WSL. No dependencies beyond the Node that Claude Code
already bundles.

## Install

```
/plugin marketplace add stewardc/claude
/plugin install obsidian-vault
/vault-setup
```

`/vault-setup` runs once per machine. It finds your vault (or creates one), scaffolds the
folders and note templates, and caches the path. From the next session on, Claude knows
where your vault is.

Don't have Obsidian yet? Install it and create a vault first — then run `/vault-setup`.

## How it works

Three pieces, each with one job:

| Piece | Job |
| --- | --- |
| `scripts/resolve-vault.js` | Finds the vault. Prints JSON. |
| SessionStart hook | Tells Claude the path each session — startup, resume, clear, and compact — or nudges you to run `/vault-setup`. |
| ExitPlanMode hook | Names the vault as the plan's destination at the moment a plan is finished. |
| `obsidian-vault` skill | How to file notes, and when to capture without being asked. |

### Why the plan-mode hook exists

Knowing the vault path isn't enough. When a planning session happens inside a code repo,
the reflex to write the plan to `docs/plans/` goes uncontested and the plan lands in the
repo. The `ExitPlanMode` hook fires at exactly that decision point and names the vault
destination instead.

It is **advisory** — it never denies the tool call, and it stays silent when you're
already working inside the vault. A plan you explicitly asked to be an in-repo document
still goes in the repo.

**The plugin owns mechanism; your vault owns policy.** Filing conventions live in a
`CLAUDE.md` at your vault root — seeded once by `/vault-setup`, yours to edit forever
after. Don't use PARA? Rewrite that file. The plugin never overwrites it.

### Finding the vault

First hit wins:

1. `OBSIDIAN_VAULT` environment variable — an escape hatch that always wins
2. `~/.claude/obsidian-vault.json` — the cached result of `/vault-setup`
3. Obsidian's own registry (`obsidian.json`) — macOS, Windows, Linux (including flatpak
   and snap), and, under WSL, the Windows-side registry with `C:\…` → `/mnt/c/…`
   translation (honouring a relocated `[automount] root` from `/etc/wsl.conf`)
4. A depth-limited scan for directories containing `.obsidian/`

## Configuration

- **`OBSIDIAN_VAULT`** — override the vault path for a session or a shell.
- **`OBSIDIAN_VAULT_MNT_ROOT`** — WSL only. Where Windows drives are mounted. Read from
  `/etc/wsl.conf`'s `[automount] root` when set there, defaulting to `/mnt`; this variable
  overrides both.
- **`~/.claude/obsidian-vault.json`** — `{ vaultPath, platform, configuredOn }`. Delete it
  and re-run `/vault-setup` to start over.
- **`<vault>/CLAUDE.md`** — your filing rules. Edit freely.

## Switching vaults

Re-run `/vault-setup` and pick a different one.

## Development

```
npm test        # node --test
```

Tests point `HOME`, `APPDATA`, `XDG_CONFIG_HOME`, and `OBSIDIAN_VAULT_MNT_ROOT` at fixture
directories, so every platform's registry layout is covered from any machine — and the
suite passes on a real WSL host, where the resolver would otherwise reach past the fixture
`HOME` to the actual Windows-side registry.

**Known gap:** only macOS is executed in CI. Windows and WSL are covered by fixtures and
unit tests but still want a real-machine smoke test.

## License

MIT
