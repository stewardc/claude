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
| SessionStart hook | Tells Claude the path each session, or nudges you to run `/vault-setup`. |
| `obsidian-vault` skill | How to file notes, and when to capture without being asked. |

**The plugin owns mechanism; your vault owns policy.** Filing conventions live in a
`CLAUDE.md` at your vault root — seeded once by `/vault-setup`, yours to edit forever
after. Don't use PARA? Rewrite that file. The plugin never overwrites it.

### Finding the vault

First hit wins:

1. `OBSIDIAN_VAULT` environment variable — an escape hatch that always wins
2. `~/.claude/obsidian-vault.json` — the cached result of `/vault-setup`
3. Obsidian's own registry (`obsidian.json`) — macOS, Windows, Linux (including flatpak
   and snap), and, under WSL, the Windows-side registry with `C:\…` → `/mnt/c/…`
   translation
4. A depth-limited scan for directories containing `.obsidian/`

## Configuration

- **`OBSIDIAN_VAULT`** — override the vault path for a session or a shell.
- **`~/.claude/obsidian-vault.json`** — `{ vaultPath, platform, configuredOn }`. Delete it
  and re-run `/vault-setup` to start over.
- **`<vault>/CLAUDE.md`** — your filing rules. Edit freely.

## Switching vaults

Re-run `/vault-setup` and pick a different one.

## Development

```
npm test        # node --test
```

Tests point `HOME`, `APPDATA`, and `XDG_CONFIG_HOME` at fixture directories under
`test/fixtures/`, so every platform's registry layout is covered from any machine.

**Known gap:** only macOS is executed in CI. Windows and WSL are covered by fixtures and
unit tests but still want a real-machine smoke test.

## License

MIT
