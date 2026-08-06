# Obsidian Vault Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the machine-specific `obsidian-vault` skill into an installable, cross-platform Claude Code plugin that discovers the user's Obsidian vault and files notes into it from any directory.

**Architecture:** Three components with one dependency each — `resolve-vault.js` finds the vault (Obsidian's own `obsidian.json` registry, plus a cached config file); a SessionStart hook reads only the cached config and injects the path each session; the skill carries filing *mechanism* while the vault's own root `CLAUDE.md` carries filing *policy*. The repo doubles as a single-plugin marketplace so install is two slash commands.

**Tech Stack:** Node.js (bundled with Claude Code — no new dependency), CommonJS, `node --test` with `node:assert/strict`. No third-party packages at all.

## Global Constraints

- **Zero runtime dependencies.** No `npm install` for the plugin to work. `package.json` declares no `dependencies`. Dev-only tooling is also disallowed — tests use the built-in `node --test` runner.
- **CommonJS** (`require`/`module.exports`), not ESM. `package.json` must NOT set `"type": "module"`.
- **Node API floor: Node 18.** Do not use `fs.globSync`, `fs.promises.glob`, or `require('node:test')` reporters newer than Node 18. Hand-roll directory walking with `fs.readdirSync`.
- **Test invocation:** `npm test`, which runs `node --test` (auto-discovery). Verified on the Node 24.15.0 in this environment: a **bare directory argument** (`node --test test/`) fails there — it tries to load `test` as a module entry point. Explicit files (`node --test test/wsl.test.js`) and globs (`node --test 'test/**/*.test.js'`) both work; per-task verification steps use the explicit-file form.
- **Platforms:** macOS (`darwin`), native Windows (`win32`), Linux, and WSL. Only macOS is executable in this environment; Windows/WSL are covered by fixtures and flagged as needing a real-machine smoke test.
- **Every script must exit 0.** `resolve-vault.js` reports failure as `{"vaultPath": null, "error": "..."}` on stdout, never a non-zero exit. The hook emits nothing and exits 0 on any error. A broken plugin must never break a session.
- **All platform state comes from injectable inputs**, never read directly from globals inside logic: functions take `{ env, platform, home }` options defaulting to `process.env`, `process.platform`, `os.homedir()`. This is what makes fixture-based cross-platform testing possible. Treat a function that reads `process.platform` inline as a bug.
- **Never modify or delete existing vault content.** Scaffolding creates only what is absent. A pre-existing vault-root `CLAUDE.md` is left byte-for-byte untouched.
- **Permission rules use the double-slash absolute form** already present in this user's `~/.claude/settings.json`: `Write(//Users/stewardc/Documents/Claude/**)`. Preserve that exact shape.
- **Config file path:** `~/.claude/obsidian-vault.json`. **Env override:** `OBSIDIAN_VAULT`.
- The six template names are exactly: `Area.md`, `Daily.md`, `Meeting.md`, `Permanent Note.md`, `Project.md`, `Resource.md` (note the space in `Permanent Note.md`).

---

## Execution progress

**All 11 tasks implemented as of 2026-08-06.** Tasks 6–11 were executed with
`superpowers:executing-plans` (single session, no subagents).

- **Branch:** `obsidian-vault-plugin` (branched from `main` at `1a58d4b`; nothing merged yet)
- **Suite status:** 88 tests, 0 failures. Verified passing on a fresh `git clone` of the branch, not just the working tree.
- **Ledger:** `.superpowers/sdd/progress.md` (git-ignored scratch; `git clean -fdx` destroys it — recover from `git log`)

| Task | Status | Commits |
| --- | --- | --- |
| 1 — manifests + test harness | ✅ reviewed clean | `a5785e0` |
| 2 — `wsl.js` | ✅ reviewed clean | `b22b423` |
| 3 — `registry.js` + fixtures | ✅ reviewed clean | `9bf5977`, `6b45596`, `9221e0c` |
| 4 — `glob.js` | ✅ reviewed clean | `6144d52` |
| 5 — `config.js` | ✅ reviewed clean | `c0981f3` |
| 6 — `resolve-vault.js` | ✅ | `2598689`, `881c6df` |
| 7 — SessionStart hook | ✅ | `eaff8fb` |
| 8 — scaffolding + templates | ✅ | `8cf3444` |
| 9 — skill rewrite | ✅ | `f31219d` |
| 10 — `/vault-setup` | ✅ | `b6457ce` |
| 11 — README + smoke test | ✅ (steps 1–5, 7) | `91ea6a1`, `dc7722e` |

### What is left

Task 11 Step 6 was completed by the user on 2026-08-06: the plugin was installed locally
from this branch (`/plugin marketplace add /Users/stewardc/claude`, then
`obsidian-vault@stewardc-claude`) and `/vault-setup` ran end to end. Manifests, command
registration, and `${CLAUDE_PLUGIN_ROOT}` expansion are all confirmed working; scaffolding
the real vault was a no-op.

The redundant capture protocol has been removed from `~/.claude/CLAUDE.md` (backup at
`~/.claude/CLAUDE.md.bak-2026-08-06`).

The SessionStart hook is confirmed firing automatically: after `/clear`, a fresh session
knew the vault path unprompted. The first attempt at this test was inconclusive, because
`~/.claude/CLAUDE.md` still named the vault path and so gave the session a second possible
source; the test was repeated after that file was cleared.

**macOS is fully verified end to end.** Windows and WSL remain fixture-tested only; both
still want a real-machine smoke test. Nothing else blocks merging.

Windows and WSL remain fixture-tested only; both still want a real-machine smoke test.

### Corrections made to this plan during execution

Three plan errors surfaced in the first five tasks. All are fixed above; noted here so a
reader doesn't rediscover them.

1. **`node --test test/` does not work** on this environment's Node 24.15.0 — a bare
   directory argument is treated as a module entry point. `npm test` runs `node --test`
   (auto-discovery); per-task steps use explicit files. Recorded in Global Constraints.
2. **Task 3's fixture script produces empty directories**, and git cannot track those, so
   the committed fixtures would have failed 7 tests on a fresh clone. Fixed with 8
   `.gitkeep` files. **If you edit the fixture script, keep the `.gitkeep` markers.**
3. **Task 5's Interfaces block listed `configPath({ env, home })`** while its code block
   showed `configPath({ home })`. The code was right; `env` is unused. Interfaces
   corrected.
4. **Task 7's shim test used `execFileSync(shim, ...)` directly**, which fails with
   `ENOEXEC`. `run-hook.cmd` is a polyglot whose byte 0 must be `:` so cmd.exe's heredoc
   swallows the batch block — so it has no shebang and cannot be `execve`'d. (The upstream
   `superpowers` shim it was modeled on has the same property.) It is invoked *through a
   shell*, which handles `ENOEXEC` by rerunning the file with `sh`; that is how Claude Code
   runs hook commands. The test now invokes it via `sh -c`. Adding a `#!/bin/sh` line was
   rejected: cmd.exe would try to execute it and emit stderr noise before `@echo off`.

### Deferred Minor findings

Both resolved in `dc7722e` during Task 11:

- ~~`test/registry.test.js` — the dedup test uses byte-identical records, so the
  "richer record wins" branch of the dedup comparator is never actually exercised.~~
  Two tests now cover both branches (earlier record survives; later, newer record
  displaces). Mutation-checked: replacing the comparator with `if (true)` fails the suite.
- ~~`test/registry.test.js` — the `XDG_CONFIG_HOME` test asserts only `paths[0]`, where the
  darwin/win32/linux tests assert the whole array.~~ Now asserts the whole array.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `.claude-plugin/plugin.json` | Plugin identity/version |
| `.claude-plugin/marketplace.json` | Makes this repo a one-plugin marketplace |
| `package.json` | Name, test script. No deps. |
| `scripts/lib/wsl.js` | WSL detection; `C:\…` → `/mnt/c/…` translation |
| `scripts/lib/registry.js` | Locate + parse `obsidian.json` per platform |
| `scripts/lib/glob.js` | Depth-limited scan for dirs containing `.obsidian/` |
| `scripts/lib/config.js` | Read/write `~/.claude/obsidian-vault.json` |
| `scripts/lib/scaffold.js` | Idempotent folder/template/`CLAUDE.md` creation |
| `scripts/lib/templates/` | The 6 note templates + `vault-CLAUDE.md` policy seed |
| `scripts/resolve-vault.js` | CLI: resolution order → JSON on stdout |
| `hooks/hooks.json` | Registers SessionStart for `startup\|clear\|compact` |
| `hooks/run-hook.cmd` | Polyglot shim so the hook runs on native Windows |
| `hooks/session-start.js` | Reads config only; emits context or a nudge |
| `commands/vault-setup.md` | The `/vault-setup` slash command |
| `skills/obsidian-vault/SKILL.md` | Filing mechanism (rewritten; no hardcoded paths) |
| `test/fixtures/` | Fake homedirs + `obsidian.json` per platform |
| `test/*.test.js` | One test file per lib module + hook + resolve |
| `README.md` | Install + usage |

Templates live under `scripts/lib/templates/` rather than `skills/obsidian-vault/templates/` (a deviation from the spec's layout): `scaffold.js` is their only consumer, and files that change together should live together. The skill does not read them from the plugin — it reads them from the vault after setup copies them in.

---

### Task 1: Repo scaffolding, plugin manifests, and a running test harness

**Files:**
- Create: `package.json`
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `.gitignore`
- Test: `test/manifest.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs `node --test test/`. Every later task adds files under `test/` and relies on this command.

- [ ] **Step 1: Write the failing test**

Create `test/manifest.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

test('plugin.json declares the plugin identity', () => {
  const plugin = read('.claude-plugin/plugin.json');
  assert.equal(plugin.name, 'obsidian-vault');
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  assert.ok(plugin.description.length > 20);
  assert.equal(plugin.license, 'MIT');
});

test('marketplace.json advertises exactly this plugin from the repo root', () => {
  const market = read('.claude-plugin/marketplace.json');
  assert.equal(market.plugins.length, 1);
  assert.equal(market.plugins[0].name, 'obsidian-vault');
  assert.equal(market.plugins[0].source, './');
});

test('marketplace and plugin versions agree', () => {
  assert.equal(
    read('.claude-plugin/marketplace.json').plugins[0].version,
    read('.claude-plugin/plugin.json').version
  );
});

test('package.json pulls in no dependencies and is CommonJS', () => {
  const pkg = read('package.json');
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
  assert.notEqual(pkg.type, 'module');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/stewardc/claude && node --test test/`
Expected: FAIL — `ENOENT: no such file or directory, open '.../package.json'`

- [ ] **Step 3: Write the manifests**

Create `package.json`:

```json
{
  "name": "obsidian-vault-plugin",
  "version": "0.1.0",
  "description": "Claude Code plugin that finds your Obsidian vault and files notes into it",
  "license": "MIT",
  "private": true,
  "scripts": {
    "test": "node --test test/"
  }
}
```

Create `.claude-plugin/plugin.json`:

```json
{
  "name": "obsidian-vault",
  "version": "0.1.0",
  "description": "Finds your Obsidian vault and proactively files decisions, plans, and todos into it from any directory. Cross-platform: macOS, Windows, WSL.",
  "author": {
    "name": "Chris Steward",
    "email": "stewardc@gmail.com"
  },
  "homepage": "https://github.com/stewardc/claude",
  "repository": "https://github.com/stewardc/claude",
  "license": "MIT",
  "keywords": ["obsidian", "notes", "knowledge-management", "para", "second-brain"]
}
```

Create `.claude-plugin/marketplace.json`:

```json
{
  "name": "stewardc-claude",
  "description": "Chris Steward's Claude Code plugins",
  "owner": {
    "name": "Chris Steward",
    "email": "stewardc@gmail.com"
  },
  "plugins": [
    {
      "name": "obsidian-vault",
      "description": "Finds your Obsidian vault and proactively files decisions, plans, and todos into it from any directory. Cross-platform: macOS, Windows, WSL.",
      "version": "0.1.0",
      "source": "./",
      "author": {
        "name": "Chris Steward",
        "email": "stewardc@gmail.com"
      }
    }
  ]
}
```

Create `.gitignore`:

```
node_modules/
.DS_Store
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/stewardc/claude && npm test`
Expected: PASS — `# pass 4`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add package.json .claude-plugin .gitignore test/manifest.test.js
git commit -m "feat: add plugin and marketplace manifests with test harness"
```

---

### Task 2: WSL detection and path translation (`scripts/lib/wsl.js`)

**Files:**
- Create: `scripts/lib/wsl.js`
- Test: `test/wsl.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `isWSL({ env = process.env, readFile } = {})` → `boolean`. `readFile` is an injectable `(path) => string` used to read `/proc/version`; defaults to `fs.readFileSync(p, 'utf8')`.
  - `winToWslPath(winPath, { exec } = {})` → `string | null`. `exec` is an injectable `(cmd, args) => string` defaulting to `child_process.execFileSync` with `encoding: 'utf8'`.
  - `detectPlatform({ env = process.env, platform = process.platform, readFile } = {})` → `'darwin' | 'win32' | 'linux' | 'wsl'`.

Both `readFile` and `exec` are injectable *specifically* so WSL behavior is testable on macOS. Every later module that needs the platform name calls `detectPlatform`.

- [ ] **Step 1: Write the failing test**

Create `test/wsl.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isWSL, winToWslPath, detectPlatform } = require('../scripts/lib/wsl');

const throwsENOENT = () => { throw new Error('ENOENT'); };

test('isWSL is true when WSL_DISTRO_NAME is set', () => {
  assert.equal(isWSL({ env: { WSL_DISTRO_NAME: 'Ubuntu' }, readFile: throwsENOENT }), true);
});

test('isWSL is true when /proc/version mentions Microsoft in any case', () => {
  assert.equal(isWSL({ env: {}, readFile: () => 'Linux version 5.15 (Microsoft@Microsoft)' }), true);
  assert.equal(isWSL({ env: {}, readFile: () => 'linux version 5.15 microsoft-standard-WSL2' }), true);
});

test('isWSL is false on ordinary Linux', () => {
  assert.equal(isWSL({ env: {}, readFile: () => 'Linux version 6.1.0 (gcc 12)' }), false);
});

test('isWSL is false when /proc/version is unreadable', () => {
  assert.equal(isWSL({ env: {}, readFile: throwsENOENT }), false);
});

test('winToWslPath prefers wslpath output', () => {
  const exec = (cmd, args) => {
    assert.equal(cmd, 'wslpath');
    assert.deepEqual(args, ['-u', 'C:\\Users\\me\\Vault']);
    return '/mnt/c/Users/me/Vault\n';
  };
  assert.equal(winToWslPath('C:\\Users\\me\\Vault', { exec }), '/mnt/c/Users/me/Vault');
});

test('winToWslPath falls back to regex when wslpath is absent', () => {
  const exec = () => { throw new Error('spawn wslpath ENOENT'); };
  assert.equal(winToWslPath('C:\\Users\\me\\Vault', { exec }), '/mnt/c/Users/me/Vault');
});

test('winToWslPath fallback handles a non-C drive and lowercases the letter', () => {
  const exec = () => { throw new Error('ENOENT'); };
  assert.equal(winToWslPath('D:\\Notes\\Vault', { exec }), '/mnt/d/Notes/Vault');
});

test('winToWslPath fallback preserves spaces in paths', () => {
  const exec = () => { throw new Error('ENOENT'); };
  assert.equal(
    winToWslPath('C:\\Users\\Chris Steward\\My Vault', { exec }),
    '/mnt/c/Users/Chris Steward/My Vault'
  );
});

test('winToWslPath fallback accepts a forward-slash separator', () => {
  const exec = () => { throw new Error('ENOENT'); };
  assert.equal(winToWslPath('C:/Users/me/Vault', { exec }), '/mnt/c/Users/me/Vault');
});

test('winToWslPath returns null for input that is not a Windows path', () => {
  const exec = () => { throw new Error('ENOENT'); };
  assert.equal(winToWslPath('/home/me/Vault', { exec }), null);
  assert.equal(winToWslPath('', { exec }), null);
  assert.equal(winToWslPath(null, { exec }), null);
});

test('winToWslPath ignores empty wslpath output and falls back', () => {
  const exec = () => '   \n';
  assert.equal(winToWslPath('C:\\Vault', { exec }), '/mnt/c/Vault');
});

test('detectPlatform reports wsl for Linux under WSL, plain linux otherwise', () => {
  assert.equal(detectPlatform({ platform: 'linux', env: { WSL_DISTRO_NAME: 'Ubuntu' }, readFile: throwsENOENT }), 'wsl');
  assert.equal(detectPlatform({ platform: 'linux', env: {}, readFile: throwsENOENT }), 'linux');
});

test('detectPlatform passes through darwin and win32 without touching /proc', () => {
  const boom = () => { throw new Error('should not be read'); };
  assert.equal(detectPlatform({ platform: 'darwin', env: {}, readFile: boom }), 'darwin');
  assert.equal(detectPlatform({ platform: 'win32', env: {}, readFile: boom }), 'win32');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/stewardc/claude && node --test test/wsl.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/wsl'`

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/wsl.js`:

```js
'use strict';

const fs = require('fs');
const { execFileSync } = require('child_process');

const defaultReadFile = (p) => fs.readFileSync(p, 'utf8');

const defaultExec = (cmd, args) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/** True when we are running inside a WSL distribution. */
function isWSL({ env = process.env, readFile = defaultReadFile } = {}) {
  if (env.WSL_DISTRO_NAME) return true;
  try {
    return /microsoft/i.test(readFile('/proc/version'));
  } catch {
    return false;
  }
}

/**
 * Translate a Windows path to its WSL mount path.
 * Prefers `wslpath -u`; falls back to a regex when wslpath is unavailable.
 * Returns null when the input is not a drive-letter path.
 */
function winToWslPath(winPath, { exec = defaultExec } = {}) {
  if (!winPath || typeof winPath !== 'string') return null;

  try {
    const out = exec('wslpath', ['-u', winPath]);
    if (out && out.trim()) return out.trim();
  } catch {
    // wslpath missing or failed — fall through to the regex.
  }

  const m = /^([A-Za-z]):[\\/]/.exec(winPath);
  if (!m) return null;
  return `/mnt/${m[1].toLowerCase()}/${winPath.slice(3).replace(/\\/g, '/')}`;
}

/** Platform name used throughout the plugin: darwin | win32 | linux | wsl. */
function detectPlatform({ env = process.env, platform = process.platform, readFile = defaultReadFile } = {}) {
  if (platform === 'linux' && isWSL({ env, readFile })) return 'wsl';
  return platform;
}

module.exports = { isWSL, winToWslPath, detectPlatform };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/stewardc/claude && node --test test/wsl.test.js`
Expected: PASS — `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/wsl.js test/wsl.test.js
git commit -m "feat: add WSL detection and Windows-to-WSL path translation"
```

---

### Task 3: Obsidian registry location and parsing (`scripts/lib/registry.js`)

**Files:**
- Create: `scripts/lib/registry.js`
- Create: `test/fixtures/` (several fixture trees, listed in Step 1)
- Test: `test/registry.test.js`

**Interfaces:**
- Consumes: `detectPlatform`, `winToWslPath` from `scripts/lib/wsl.js` (Task 2).
- Produces:
  - `registryPaths({ env, platform, home })` → `Array<{ path: string, windowsSide: boolean }>` — candidate `obsidian.json` locations, in priority order, for the given platform. Does not check existence.
  - `readRegistry(opts)` → `Array<{ path, open, id, ts }>` — every vault Obsidian knows about, translated for WSL, filtered to paths that exist on disk, sorted `open` first then most-recent `ts` first.

`opts` for `readRegistry` is `{ env, platform, home, exec, existsSync }`; `existsSync` is injectable so fixtures can model "registry lists a path that no longer exists".

Registry file format, for reference: `{"vaults": {"<id>": {"path": "...", "ts": 1690000000000, "open": true}}}`.

- [ ] **Step 1: Create the fixture trees**

Run this exact script to build the fixtures:

```bash
cd /Users/stewardc/claude
F=test/fixtures

# darwin: one vault
mkdir -p "$F/darwin/Library/Application Support/obsidian" "$F/darwin/Documents/Claude/.obsidian"
cat > "$F/darwin/Library/Application Support/obsidian/obsidian.json" <<'EOF'
{"vaults":{"a1":{"path":"__FIXTURE__/darwin/Documents/Claude","ts":1690000000000,"open":true}}}
EOF

# win32: two vaults, the second one open
mkdir -p "$F/win32/AppData/Roaming/obsidian" "$F/win32/Documents/Notes/.obsidian" "$F/win32/Documents/Work/.obsidian"
cat > "$F/win32/AppData/Roaming/obsidian/obsidian.json" <<'EOF'
{"vaults":{"b1":{"path":"__FIXTURE__/win32/Documents/Notes","ts":1690000000000},"b2":{"path":"__FIXTURE__/win32/Documents/Work","ts":1600000000000,"open":true}}}
EOF

# linux: XDG config
mkdir -p "$F/linux/.config/obsidian" "$F/linux/vault/.obsidian"
cat > "$F/linux/.config/obsidian/obsidian.json" <<'EOF'
{"vaults":{"c1":{"path":"__FIXTURE__/linux/vault","ts":1690000000000,"open":true}}}
EOF

# linux-flatpak: only the flatpak location exists
mkdir -p "$F/linux-flatpak/.var/app/md.obsidian.Obsidian/config/obsidian" "$F/linux-flatpak/vault/.obsidian"
cat > "$F/linux-flatpak/.var/app/md.obsidian.Obsidian/config/obsidian/obsidian.json" <<'EOF'
{"vaults":{"d1":{"path":"__FIXTURE__/linux-flatpak/vault","ts":1690000000000,"open":true}}}
EOF

# linux-snap
mkdir -p "$F/linux-snap/snap/obsidian/current/.config/obsidian" "$F/linux-snap/vault/.obsidian"
cat > "$F/linux-snap/snap/obsidian/current/.config/obsidian/obsidian.json" <<'EOF'
{"vaults":{"e1":{"path":"__FIXTURE__/linux-snap/vault","ts":1690000000000,"open":true}}}
EOF

# wsl-linux-side: Obsidian installed inside the distro
mkdir -p "$F/wsl-linux-side/.config/obsidian" "$F/wsl-linux-side/vault/.obsidian"
cat > "$F/wsl-linux-side/.config/obsidian/obsidian.json" <<'EOF'
{"vaults":{"f1":{"path":"__FIXTURE__/wsl-linux-side/vault","ts":1690000000000,"open":true}}}
EOF

# malformed JSON
mkdir -p "$F/malformed/Library/Application Support/obsidian"
printf '{"vaults": {' > "$F/malformed/Library/Application Support/obsidian/obsidian.json"

# stale: registry points at a path that does not exist
mkdir -p "$F/stale/Library/Application Support/obsidian"
cat > "$F/stale/Library/Application Support/obsidian/obsidian.json" <<'EOF'
{"vaults":{"g1":{"path":"__FIXTURE__/stale/gone","ts":1690000000000,"open":true}}}
EOF

# no-registry: a homedir with nothing in it
mkdir -p "$F/no-registry/Documents"

find "$F" -type f | sort
```

The literal `__FIXTURE__` placeholder is substituted for the absolute fixture directory at test time (paths inside a committed fixture cannot be absolute). The helper in Step 2 does that substitution.

The WSL Windows-side case (`/mnt/*/Users/*/AppData/Roaming/obsidian/obsidian.json`) cannot be modeled by a fixture homedir, because the glob root `/mnt` is absolute. It is tested in Step 2 by injecting a `mntRoot` option instead.

- [ ] **Step 2: Write the failing test**

Create `test/registry.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { registryPaths, readRegistry } = require('../scripts/lib/registry');

const FIXTURES = path.join(__dirname, 'fixtures');

/**
 * Copy a fixture homedir to a temp dir, substituting __FIXTURE__ for its real
 * absolute path inside every obsidian.json. Returns the temp homedir.
 */
function materialize(name) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'obsvault-'));
  fs.cpSync(path.join(FIXTURES, name), path.join(tmp, name), { recursive: true });
  const home = path.join(tmp, name);
  for (const file of walk(home)) {
    if (path.basename(file) === 'obsidian.json') {
      const raw = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, raw.split('__FIXTURE__').join(tmp));
    }
  }
  return home;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

test('registryPaths points at Application Support on darwin', () => {
  const paths = registryPaths({ platform: 'darwin', env: {}, home: '/Users/me' });
  assert.deepEqual(paths.map((p) => p.path), [
    '/Users/me/Library/Application Support/obsidian/obsidian.json',
  ]);
});

test('registryPaths uses APPDATA on win32', () => {
  const paths = registryPaths({
    platform: 'win32',
    env: { APPDATA: 'C:\\Users\\me\\AppData\\Roaming' },
    home: 'C:\\Users\\me',
  });
  assert.equal(paths.length, 1);
  assert.match(paths[0].path, /AppData[\\/]Roaming[\\/]obsidian[\\/]obsidian\.json$/);
});

test('registryPaths falls back to a default APPDATA location when unset', () => {
  const paths = registryPaths({ platform: 'win32', env: {}, home: 'C:\\Users\\me' });
  assert.equal(paths.length, 1);
  assert.match(paths[0].path, /AppData[\\/]Roaming[\\/]obsidian[\\/]obsidian\.json$/);
});

test('registryPaths covers XDG, flatpak, and snap on linux, XDG first', () => {
  const paths = registryPaths({ platform: 'linux', env: {}, home: '/home/me' }).map((p) => p.path);
  assert.deepEqual(paths, [
    '/home/me/.config/obsidian/obsidian.json',
    '/home/me/.var/app/md.obsidian.Obsidian/config/obsidian/obsidian.json',
    '/home/me/snap/obsidian/current/.config/obsidian/obsidian.json',
  ]);
});

test('registryPaths honours XDG_CONFIG_HOME', () => {
  const paths = registryPaths({
    platform: 'linux',
    env: { XDG_CONFIG_HOME: '/home/me/.xdg' },
    home: '/home/me',
  }).map((p) => p.path);
  assert.equal(paths[0], '/home/me/.xdg/obsidian/obsidian.json');
});

test('registryPaths on wsl lists Linux-side paths before Windows-side ones', () => {
  // A real fake /mnt with two drives and two Windows users, so the glob and the
  // ordering are both genuinely exercised.
  const mntRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'obsmnt-')), 'mnt');
  for (const p of [['c', 'chris'], ['c', 'other'], ['d', 'chris']]) {
    fs.mkdirSync(path.join(mntRoot, p[0], 'Users', p[1]), { recursive: true });
  }

  const paths = registryPaths({ platform: 'wsl', env: {}, home: '/home/me', mntRoot });
  const linuxSide = paths.filter((p) => !p.windowsSide);
  const winSide = paths.filter((p) => p.windowsSide);

  assert.equal(linuxSide.length, 3, 'XDG + flatpak + snap');
  assert.equal(linuxSide[0].path, '/home/me/.config/obsidian/obsidian.json');
  assert.equal(winSide.length, 3, 'one per drive/user pair discovered under /mnt');

  // Every Linux-side path must come before every Windows-side one.
  const lastLinux = paths.indexOf(linuxSide[linuxSide.length - 1]);
  const firstWin = paths.indexOf(winSide[0]);
  assert.ok(lastLinux < firstWin, `linux-side (${lastLinux}) must precede windows-side (${firstWin})`);

  // The globbed paths point where we expect.
  assert.ok(
    winSide.some((p) => p.path === path.join(mntRoot, 'd', 'Users', 'chris', 'AppData', 'Roaming', 'obsidian', 'obsidian.json')),
    'non-C drives are globbed too'
  );
});

test('readRegistry finds the single darwin vault', () => {
  const home = materialize('darwin');
  const vaults = readRegistry({ platform: 'darwin', env: {}, home });
  assert.equal(vaults.length, 1);
  assert.equal(path.basename(vaults[0].path), 'Claude');
  assert.equal(vaults[0].open, true);
  assert.equal(vaults[0].id, 'a1');
});

test('readRegistry sorts the open vault first even when another is newer', () => {
  const home = materialize('win32');
  const vaults = readRegistry({
    platform: 'win32',
    env: { APPDATA: path.join(home, 'AppData', 'Roaming') },
    home,
  });
  assert.equal(vaults.length, 2);
  assert.equal(path.basename(vaults[0].path), 'Work');
  assert.equal(vaults[0].open, true);
  assert.equal(path.basename(vaults[1].path), 'Notes');
});

test('readRegistry reads the linux XDG registry', () => {
  const home = materialize('linux');
  const vaults = readRegistry({ platform: 'linux', env: {}, home });
  assert.equal(vaults.length, 1);
  assert.equal(path.basename(vaults[0].path), 'vault');
});

test('readRegistry reads the flatpak registry when XDG is absent', () => {
  const home = materialize('linux-flatpak');
  const vaults = readRegistry({ platform: 'linux', env: {}, home });
  assert.equal(vaults.length, 1);
  assert.equal(vaults[0].id, 'd1');
});

test('readRegistry reads the snap registry when XDG is absent', () => {
  const home = materialize('linux-snap');
  const vaults = readRegistry({ platform: 'linux', env: {}, home });
  assert.equal(vaults.length, 1);
  assert.equal(vaults[0].id, 'e1');
});

test('readRegistry finds a Linux-side vault under WSL', () => {
  const home = materialize('wsl-linux-side');
  const vaults = readRegistry({ platform: 'wsl', env: {}, home, mntRoot: '/nonexistent-mnt' });
  assert.equal(vaults.length, 1);
  assert.equal(vaults[0].id, 'f1');
});

test('readRegistry finds and translates a Windows-side vault under WSL', () => {
  // Model /mnt as a temp tree: <mnt>/c/Users/chris/AppData/Roaming/obsidian/obsidian.json
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'obsvault-mnt-'));
  const mntRoot = path.join(tmp, 'mnt');
  const reg = path.join(mntRoot, 'c', 'Users', 'chris', 'AppData', 'Roaming', 'obsidian');
  fs.mkdirSync(reg, { recursive: true });
  fs.writeFileSync(
    path.join(reg, 'obsidian.json'),
    JSON.stringify({ vaults: { w1: { path: 'C:\\Users\\chris\\Documents\\Vault', ts: 1, open: true } } })
  );
  // The translated path must exist for the vault to be offered.
  const translated = path.join(mntRoot, 'c', 'Users', 'chris', 'Documents', 'Vault');
  fs.mkdirSync(path.join(translated, '.obsidian'), { recursive: true });

  const vaults = readRegistry({
    platform: 'wsl',
    env: {},
    home: path.join(tmp, 'home'),
    mntRoot,
    // Stand in for `wslpath -u`, rooted at our fake /mnt.
    exec: (cmd, args) => {
      assert.equal(cmd, 'wslpath');
      const win = args[1];
      const drive = win[0].toLowerCase();
      return path.join(mntRoot, drive, win.slice(3).replace(/\\/g, '/'));
    },
  });

  assert.equal(vaults.length, 1);
  assert.equal(vaults[0].path, translated);
  assert.equal(vaults[0].id, 'w1');
});

test('readRegistry drops vaults whose path no longer exists', () => {
  const home = materialize('stale');
  const vaults = readRegistry({ platform: 'darwin', env: {}, home });
  assert.deepEqual(vaults, []);
});

test('readRegistry returns an empty list for malformed JSON', () => {
  const home = materialize('malformed');
  assert.deepEqual(readRegistry({ platform: 'darwin', env: {}, home }), []);
});

test('readRegistry returns an empty list when no registry exists', () => {
  const home = materialize('no-registry');
  assert.deepEqual(readRegistry({ platform: 'darwin', env: {}, home }), []);
});

test('readRegistry deduplicates a vault listed in two registries', () => {
  const home = materialize('linux');
  // Point flatpak at the same vault the XDG registry already lists.
  const flatpak = path.join(home, '.var', 'app', 'md.obsidian.Obsidian', 'config', 'obsidian');
  fs.mkdirSync(flatpak, { recursive: true });
  fs.writeFileSync(
    path.join(flatpak, 'obsidian.json'),
    fs.readFileSync(path.join(home, '.config', 'obsidian', 'obsidian.json'))
  );
  const vaults = readRegistry({ platform: 'linux', env: {}, home });
  assert.equal(vaults.length, 1);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd /Users/stewardc/claude && node --test test/registry.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/registry'`

- [ ] **Step 4: Write the implementation**

Create `scripts/lib/registry.js`:

```js
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { winToWslPath } = require('./wsl');

const LINUX_REGISTRY_SUFFIXES = [
  // XDG first — handled specially below because XDG_CONFIG_HOME can override it.
  ['.var', 'app', 'md.obsidian.Obsidian', 'config', 'obsidian', 'obsidian.json'],
  ['snap', 'obsidian', 'current', '.config', 'obsidian', 'obsidian.json'],
];

function linuxPaths(env, home) {
  const xdg = env.XDG_CONFIG_HOME || path.join(home, '.config');
  return [
    { path: path.join(xdg, 'obsidian', 'obsidian.json'), windowsSide: false },
    ...LINUX_REGISTRY_SUFFIXES.map((parts) => ({
      path: path.join(home, ...parts),
      windowsSide: false,
    })),
  ];
}

/**
 * Windows-side registries visible from WSL. Globs
 * <mntRoot>/*\/Users/*\/AppData/Roaming/obsidian/obsidian.json rather than
 * assuming /mnt/c and a username, since both vary and need not match the
 * Linux user.
 */
function windowsSidePaths(mntRoot) {
  const found = [];
  for (const drive of listDirs(mntRoot)) {
    const users = path.join(mntRoot, drive, 'Users');
    for (const user of listDirs(users)) {
      found.push({
        path: path.join(users, user, 'AppData', 'Roaming', 'obsidian', 'obsidian.json'),
        windowsSide: true,
      });
    }
  }
  return found;
}

function listDirs(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/** Candidate obsidian.json locations for a platform, in priority order. */
function registryPaths({ env = process.env, platform = process.platform, home = os.homedir(), mntRoot = '/mnt' } = {}) {
  switch (platform) {
    case 'darwin':
      return [
        {
          path: path.join(home, 'Library', 'Application Support', 'obsidian', 'obsidian.json'),
          windowsSide: false,
        },
      ];
    case 'win32': {
      const appData = env.APPDATA || path.join(home, 'AppData', 'Roaming');
      return [{ path: path.join(appData, 'obsidian', 'obsidian.json'), windowsSide: false }];
    }
    case 'wsl':
      // Linux-side first: a native vault beats one on /mnt/c.
      return [...linuxPaths(env, home), ...windowsSidePaths(mntRoot)];
    case 'linux':
    default:
      return linuxPaths(env, home);
  }
}

function parseRegistry(file) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
  if (!data || typeof data.vaults !== 'object' || data.vaults === null) return [];
  return Object.entries(data.vaults)
    .filter(([, v]) => v && typeof v.path === 'string')
    .map(([id, v]) => ({ id, path: v.path, ts: typeof v.ts === 'number' ? v.ts : 0, open: v.open === true }));
}

/**
 * Every vault Obsidian knows about: translated for WSL, filtered to paths that
 * exist, deduplicated, and sorted open-first then most-recently-used first.
 */
function readRegistry(opts = {}) {
  const { exec, existsSync = fs.existsSync } = opts;
  const found = [];

  for (const { path: file, windowsSide } of registryPaths(opts)) {
    for (const entry of parseRegistry(file)) {
      let resolved = entry.path;
      if (windowsSide) {
        resolved = winToWslPath(entry.path, exec ? { exec } : {});
        if (!resolved) continue;
      }
      if (!existsSync(resolved)) continue;
      found.push({ ...entry, path: resolved });
    }
  }

  const byPath = new Map();
  for (const v of found) {
    const prev = byPath.get(v.path);
    // Keep the richer record: open wins, then the newer timestamp.
    if (!prev || (v.open && !prev.open) || (v.open === prev.open && v.ts > prev.ts)) {
      byPath.set(v.path, v);
    }
  }

  return [...byPath.values()].sort((a, b) => (b.open === a.open ? b.ts - a.ts : b.open ? 1 : -1));
}

module.exports = { registryPaths, readRegistry };
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /Users/stewardc/claude && node --test test/registry.test.js`
Expected: PASS — `# fail 0`

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/registry.js test/registry.test.js test/fixtures
git commit -m "feat: locate and parse Obsidian's vault registry per platform"
```

---

### Task 4: Depth-limited vault glob (`scripts/lib/glob.js`)

**Files:**
- Create: `scripts/lib/glob.js`
- Test: `test/glob.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `globRoots({ env, platform, home })` → `string[]` — the directories to scan.
  - `findVaults({ roots = globRoots(), maxDepth = 3 })` → `string[]` — directories containing a `.obsidian/` child, deduplicated. Skips dotfile directories and `node_modules`, and does not descend into a directory once it is identified as a vault. Missing or unreadable directories are skipped silently.

This function reads the real filesystem directly — no injectable `fs` — because every test builds a real temp directory tree, which exercises more than a stubbed `readdirSync` would. (Injection is reserved for *platform* state: `env`, `platform`, `home`.)

- [ ] **Step 1: Write the failing test**

Create `test/glob.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { globRoots, findVaults } = require('../scripts/lib/glob');

function tree(spec) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'obsglob-'));
  for (const dir of spec) fs.mkdirSync(path.join(root, dir), { recursive: true });
  return root;
}

test('globRoots covers Documents, home, iCloud, and OneDrive on darwin', () => {
  const roots = globRoots({ platform: 'darwin', env: {}, home: '/Users/me' });
  assert.ok(roots.includes('/Users/me/Documents'));
  assert.ok(roots.includes('/Users/me'));
  assert.ok(roots.some((r) => r.includes('iCloud~md~obsidian')));
});

test('globRoots honours the OneDrive env var when set', () => {
  const roots = globRoots({ platform: 'win32', env: { OneDrive: 'C:\\Users\\me\\OneDrive' }, home: 'C:\\Users\\me' });
  assert.ok(roots.includes('C:\\Users\\me\\OneDrive'));
});

test('findVaults finds a vault at depth 1', () => {
  const root = tree(['Documents/Vault/.obsidian']);
  assert.deepEqual(
    findVaults({ roots: [path.join(root, 'Documents')] }),
    [path.join(root, 'Documents', 'Vault')]
  );
});

test('findVaults finds a vault at the maximum depth', () => {
  const root = tree(['a/b/c/.obsidian']);
  assert.deepEqual(findVaults({ roots: [root], maxDepth: 3 }), [path.join(root, 'a', 'b', 'c')]);
});

test('findVaults does not find a vault beyond the maximum depth', () => {
  const root = tree(['a/b/c/d/.obsidian']);
  assert.deepEqual(findVaults({ roots: [root], maxDepth: 3 }), []);
});

test('findVaults skips dotfile directories and node_modules', () => {
  const root = tree(['.hidden/Vault/.obsidian', 'node_modules/pkg/.obsidian']);
  assert.deepEqual(findVaults({ roots: [root] }), []);
});

test('findVaults does not descend into a vault it already matched', () => {
  const root = tree(['Vault/.obsidian', 'Vault/Nested/.obsidian']);
  assert.deepEqual(findVaults({ roots: [root] }), [path.join(root, 'Vault')]);
});

test('findVaults deduplicates a vault reachable from two roots', () => {
  const root = tree(['Documents/Vault/.obsidian']);
  const found = findVaults({ roots: [root, path.join(root, 'Documents')] });
  assert.deepEqual(found, [path.join(root, 'Documents', 'Vault')]);
});

test('findVaults ignores roots that do not exist', () => {
  assert.deepEqual(findVaults({ roots: ['/nonexistent-root-xyz'] }), []);
});

test('findVaults ignores a .obsidian that is a file rather than a directory', () => {
  const root = tree(['Vault']);
  fs.writeFileSync(path.join(root, 'Vault', '.obsidian'), 'not a dir');
  assert.deepEqual(findVaults({ roots: [root] }), []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/stewardc/claude && node --test test/glob.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/glob'`

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/glob.js`:

```js
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const SKIP = new Set(['node_modules', 'Library', '.git']);

/** Directories worth scanning for a vault, most-likely first. */
function globRoots({ env = process.env, platform = process.platform, home = os.homedir() } = {}) {
  const roots = [path.join(home, 'Documents'), home];

  if (platform === 'darwin') {
    roots.push(path.join(home, 'Library', 'Mobile Documents', 'iCloud~md~obsidian', 'Documents'));
  }

  const oneDrive = env.OneDrive || env.ONEDRIVE;
  roots.push(oneDrive || path.join(home, 'OneDrive'));

  return [...new Set(roots)];
}

/** Directories containing a `.obsidian/` child, searched to maxDepth. */
function findVaults({ roots = globRoots(), maxDepth = 3 } = {}) {
  const found = new Set();
  const visited = new Set();

  const isVault = (dir) => {
    try {
      return fs.statSync(path.join(dir, '.obsidian')).isDirectory();
    } catch {
      return false;
    }
  };

  const walk = (dir, depth) => {
    if (depth > maxDepth) return;
    const real = path.resolve(dir);
    if (visited.has(real)) return;
    visited.add(real);

    if (isVault(real)) {
      // A vault is a leaf: don't index vaults nested inside vaults.
      found.add(real);
      return;
    }

    // readdirSync throws for a missing or unreadable directory — that is the
    // "skip it" path, so no separate existence check is needed.
    let entries;
    try {
      entries = fs.readdirSync(real, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
      walk(path.join(real, e.name), depth + 1);
    }
  };

  for (const root of roots) walk(root, 0);
  return [...found];
}

module.exports = { globRoots, findVaults };
```

Note: `Library` is in `SKIP` so scanning `~` on macOS doesn't crawl the entire Library tree; the iCloud Obsidian directory is reached as an explicit root instead.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/stewardc/claude && node --test test/glob.test.js`
Expected: PASS — `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/glob.js test/glob.test.js
git commit -m "feat: add depth-limited scan for directories containing .obsidian"
```

---

### Task 5: Config file read/write (`scripts/lib/config.js`)

**Files:**
- Create: `scripts/lib/config.js`
- Test: `test/config.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `configPath({ home })` → `string` — `<home>/.claude/obsidian-vault.json`. (No `env` parameter: the config path derives from `home` alone, and an unused parameter would violate the zero-overbuild constraint. Callers pass their whole opts object, so the extra keys are simply ignored.)
  - `readConfig(opts)` → `{ vaultPath, platform, configuredOn } | null` — `null` on missing file, unreadable file, malformed JSON, or a record without a string `vaultPath`.
  - `writeConfig(record, opts)` → `string` — creates `~/.claude/` if needed, writes pretty JSON, returns the path written.

- [ ] **Step 1: Write the failing test**

Create `test/config.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { configPath, readConfig, writeConfig } = require('../scripts/lib/config');

const tmpHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'obscfg-'));

test('configPath lives under .claude in the home directory', () => {
  assert.equal(configPath({ home: '/Users/me' }), '/Users/me/.claude/obsidian-vault.json');
});

test('readConfig returns null when the file is absent', () => {
  assert.equal(readConfig({ home: tmpHome() }), null);
});

test('readConfig returns null for malformed JSON', () => {
  const home = tmpHome();
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(path.join(home, '.claude', 'obsidian-vault.json'), '{ nope');
  assert.equal(readConfig({ home }), null);
});

test('readConfig returns null when vaultPath is missing or not a string', () => {
  const home = tmpHome();
  fs.mkdirSync(path.join(home, '.claude'));
  const file = path.join(home, '.claude', 'obsidian-vault.json');
  fs.writeFileSync(file, JSON.stringify({ platform: 'darwin' }));
  assert.equal(readConfig({ home }), null);
  fs.writeFileSync(file, JSON.stringify({ vaultPath: 42 }));
  assert.equal(readConfig({ home }), null);
});

test('writeConfig creates .claude and round-trips through readConfig', () => {
  const home = tmpHome();
  const record = { vaultPath: '/Users/me/Documents/Claude', platform: 'darwin', configuredOn: '2026-08-05' };
  const written = writeConfig(record, { home });
  assert.equal(written, path.join(home, '.claude', 'obsidian-vault.json'));
  assert.deepEqual(readConfig({ home }), record);
});

test('writeConfig overwrites an existing config, which is how a user switches vaults', () => {
  const home = tmpHome();
  writeConfig({ vaultPath: '/old', platform: 'darwin', configuredOn: '2026-01-01' }, { home });
  writeConfig({ vaultPath: '/new', platform: 'darwin', configuredOn: '2026-08-05' }, { home });
  assert.equal(readConfig({ home }).vaultPath, '/new');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/stewardc/claude && node --test test/config.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/config'`

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/config.js`:

```js
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const FILENAME = 'obsidian-vault.json';

function configPath({ home = os.homedir() } = {}) {
  return path.join(home, '.claude', FILENAME);
}

/** The cached result of /vault-setup, or null if unusable for any reason. */
function readConfig(opts = {}) {
  try {
    const data = JSON.parse(fs.readFileSync(configPath(opts), 'utf8'));
    if (!data || typeof data.vaultPath !== 'string' || !data.vaultPath) return null;
    return data;
  } catch {
    return null;
  }
}

function writeConfig(record, opts = {}) {
  const file = configPath(opts);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return file;
}

module.exports = { configPath, readConfig, writeConfig };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/stewardc/claude && node --test test/config.test.js`
Expected: PASS — `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/config.js test/config.test.js
git commit -m "feat: add read/write for the cached vault config"
```

---

### Task 6: The resolver CLI (`scripts/resolve-vault.js`)

**Files:**
- Create: `scripts/resolve-vault.js`
- Test: `test/resolve-vault.test.js`

**Interfaces:**
- Consumes: `detectPlatform` (Task 2), `readRegistry` (Task 3), `findVaults`/`globRoots` (Task 4), `readConfig` (Task 5).
- Produces:
  - `resolveVault({ env, platform, home, all = false, ... })` → `{ vaultPath, source, platform, candidates }` where `source` is `'env' | 'config' | 'registry' | 'glob' | null` and `candidates` is `Array<{ path, open, id }>`.
  - CLI: `node scripts/resolve-vault.js [--all]` prints that object as JSON to stdout and exits 0. On unexpected error it prints `{"vaultPath": null, "error": "..."}` and still exits 0.

Resolution order, first hit wins: `OBSIDIAN_VAULT` → config file → registry → glob. `candidates` is populated only when the registry was actually consulted — i.e. when resolution did not short-circuit at env or config — unless `--all` forces a full scan.

- [ ] **Step 1: Write the failing test**

Create `test/resolve-vault.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { resolveVault } = require('../scripts/resolve-vault');
const { writeConfig } = require('../scripts/lib/config');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'resolve-vault.js');

/** A temp home containing a darwin registry plus a real vault directory. */
function homeWithVault() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'obsres-'));
  const vault = path.join(home, 'Documents', 'Claude');
  fs.mkdirSync(path.join(vault, '.obsidian'), { recursive: true });
  const regDir = path.join(home, 'Library', 'Application Support', 'obsidian');
  fs.mkdirSync(regDir, { recursive: true });
  fs.writeFileSync(
    path.join(regDir, 'obsidian.json'),
    JSON.stringify({ vaults: { a1: { path: vault, ts: 1690000000000, open: true } } })
  );
  return { home, vault };
}

test('OBSIDIAN_VAULT wins over everything', () => {
  const { home, vault } = homeWithVault();
  const override = path.join(home, 'Override');
  fs.mkdirSync(override);
  writeConfig({ vaultPath: vault, platform: 'darwin', configuredOn: '2026-08-05' }, { home });

  const r = resolveVault({ platform: 'darwin', home, env: { OBSIDIAN_VAULT: override } });
  assert.equal(r.vaultPath, override);
  assert.equal(r.source, 'env');
  assert.deepEqual(r.candidates, []);
});

test('the config file wins over the registry and skips the registry scan', () => {
  const { home, vault } = homeWithVault();
  const chosen = path.join(home, 'Chosen');
  fs.mkdirSync(chosen);
  writeConfig({ vaultPath: chosen, platform: 'darwin', configuredOn: '2026-08-05' }, { home });

  const r = resolveVault({ platform: 'darwin', home, env: {} });
  assert.equal(r.vaultPath, chosen);
  assert.equal(r.source, 'config');
  assert.deepEqual(r.candidates, [], 'registry must not be consulted when config hits');
  assert.notEqual(r.vaultPath, vault);
});

test('the registry resolves the vault when no config exists', () => {
  const { home, vault } = homeWithVault();
  const r = resolveVault({ platform: 'darwin', home, env: {} });
  assert.equal(r.vaultPath, vault);
  assert.equal(r.source, 'registry');
  assert.equal(r.candidates.length, 1);
  assert.equal(r.candidates[0].path, vault);
  assert.equal(r.candidates[0].open, true);
});

test('--all forces a full scan so candidates are offered even on a config hit', () => {
  const { home, vault } = homeWithVault();
  const chosen = path.join(home, 'Chosen');
  fs.mkdirSync(chosen);
  writeConfig({ vaultPath: chosen, platform: 'darwin', configuredOn: '2026-08-05' }, { home });

  const r = resolveVault({ platform: 'darwin', home, env: {}, all: true });
  assert.equal(r.source, 'config');
  assert.ok(r.candidates.some((c) => c.path === vault));
});

test('glob resolves a vault the registry does not know about', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'obsres-'));
  const vault = path.join(home, 'Documents', 'Unregistered');
  fs.mkdirSync(path.join(vault, '.obsidian'), { recursive: true });

  const r = resolveVault({ platform: 'darwin', home, env: {} });
  assert.equal(r.vaultPath, vault);
  assert.equal(r.source, 'glob');
});

test('nothing resolves to a null vaultPath with a null source', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'obsres-'));
  const r = resolveVault({ platform: 'darwin', home, env: {} });
  assert.equal(r.vaultPath, null);
  assert.equal(r.source, null);
  assert.deepEqual(r.candidates, []);
});

test('the reported platform is the detected one', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'obsres-'));
  assert.equal(resolveVault({ platform: 'darwin', home, env: {} }).platform, 'darwin');
  assert.equal(
    resolveVault({ platform: 'linux', home, env: { WSL_DISTRO_NAME: 'Ubuntu' } }).platform,
    'wsl'
  );
});

test('the CLI prints valid JSON on stdout and exits 0', () => {
  const { home, vault } = homeWithVault();
  const out = execFileSync('node', [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, OBSIDIAN_VAULT: '' },
  });
  const parsed = JSON.parse(out);
  assert.equal(parsed.vaultPath, vault);
  assert.equal(parsed.source, 'registry');
});

test('the CLI honours OBSIDIAN_VAULT and --all', () => {
  const { home, vault } = homeWithVault();
  const out = execFileSync('node', [SCRIPT, '--all'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, OBSIDIAN_VAULT: vault },
  });
  const parsed = JSON.parse(out);
  assert.equal(parsed.source, 'env');
  assert.ok(parsed.candidates.length >= 1, '--all scans even on an env hit');
});
```

Note on the CLI tests: `HOME` is set in the child env so `os.homedir()` resolves to the fixture. `OBSIDIAN_VAULT: ''` clears any real value inherited from the developer's shell — an empty string is falsy, so the resolver skips it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/stewardc/claude && node --test test/resolve-vault.test.js`
Expected: FAIL — `Cannot find module '../scripts/resolve-vault'`

- [ ] **Step 3: Write the implementation**

Create `scripts/resolve-vault.js`:

```js
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const { detectPlatform } = require('./lib/wsl');
const { readRegistry } = require('./lib/registry');
const { findVaults, globRoots } = require('./lib/glob');
const { readConfig } = require('./lib/config');

/**
 * Find the user's vault. First hit wins: env var, cached config, Obsidian's
 * registry, then a depth-limited glob.
 *
 * `candidates` is filled only when the registry was actually consulted, so a
 * fast config hit stays fast. Pass `all: true` (the --all flag) to force a
 * full scan — /vault-setup needs alternatives to offer.
 */
function resolveVault(opts = {}) {
  const { env = process.env, home = os.homedir(), all = false } = opts;
  const platform = detectPlatform({ env, platform: opts.platform || process.platform });
  const base = { ...opts, env, home, platform };

  let vaultPath = null;
  let source = null;

  if (env.OBSIDIAN_VAULT) {
    vaultPath = env.OBSIDIAN_VAULT;
    source = 'env';
  }

  if (!vaultPath) {
    const config = readConfig(base);
    if (config) {
      vaultPath = config.vaultPath;
      source = 'config';
    }
  }

  // Skip discovery entirely on a short-circuit hit unless --all was passed.
  if (vaultPath && !all) {
    return { vaultPath, source, platform, candidates: [] };
  }

  const candidates = readRegistry(base).map(({ path: p, open, id }) => ({ path: p, open, id }));

  if (!vaultPath && candidates.length) {
    vaultPath = candidates[0].path;
    source = 'registry';
  }

  if (!vaultPath || all) {
    const known = new Set(candidates.map((c) => c.path));
    for (const p of findVaults({ roots: globRoots(base) })) {
      if (!known.has(p)) {
        known.add(p);
        candidates.push({ path: p, open: false, id: null });
      }
    }
    if (!vaultPath && candidates.length) {
      vaultPath = candidates[0].path;
      source = 'glob';
    }
  }

  return { vaultPath, source, platform, candidates };
}

if (require.main === module) {
  let result;
  try {
    result = resolveVault({ all: process.argv.includes('--all') });
  } catch (err) {
    // Never a non-zero exit: callers include a session hook.
    result = { vaultPath: null, error: String((err && err.message) || err) };
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(0);
}

module.exports = { resolveVault };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/stewardc/claude && node --test test/resolve-vault.test.js`
Expected: PASS — `# fail 0`

- [ ] **Step 5: Verify against the real machine**

Run: `cd /Users/stewardc/claude && node scripts/resolve-vault.js --all`
Expected: JSON with `"vaultPath": "/Users/stewardc/Documents/Claude"`, `"platform": "darwin"`, and at least one candidate. (`source` will be `registry` or `glob` until setup has run.)

- [ ] **Step 6: Commit**

```bash
git add scripts/resolve-vault.js test/resolve-vault.test.js
git commit -m "feat: add resolve-vault CLI with env/config/registry/glob resolution"
```

---

### Task 7: SessionStart hook (`hooks/`)

**Files:**
- Create: `hooks/session-start.js`
- Create: `hooks/hooks.json`
- Create: `hooks/run-hook.cmd`
- Test: `test/hook.test.js`

**Interfaces:**
- Consumes: `readConfig` from `scripts/lib/config.js` (Task 5). **Nothing else** — no registry parse, no glob — so it stays fast on every session.
- Produces: JSON on stdout in the shape Claude Code expects: `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"..."}}`.

The shim is a polyglot copied in structure from the `superpowers` plugin's `run-hook.cmd`, adapted to invoke `node` instead of `bash`. Windows-only note: Claude Code's Windows auto-detection prepends `bash` to commands containing `.sh`; `.js` is unaffected, so the hook script keeps its extension.

- [ ] **Step 1: Write the failing test**

Create `test/hook.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const HOOK = path.join(__dirname, '..', 'hooks', 'session-start.js');
const tmpHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'obshook-'));

/** Run the hook with a given HOME. Returns { stdout, status }. */
function runHook(home) {
  const stdout = execFileSync('node', [HOOK], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, OBSIDIAN_VAULT: '' },
  });
  return stdout;
}

function contextOf(stdout) {
  return JSON.parse(stdout).hookSpecificOutput.additionalContext;
}

test('configured: emits the vault path, a capture instruction, and a skill pointer', () => {
  const home = tmpHome();
  const vault = path.join(home, 'Documents', 'Claude');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.mkdirSync(vault, { recursive: true });
  fs.writeFileSync(
    path.join(home, '.claude', 'obsidian-vault.json'),
    JSON.stringify({ vaultPath: vault, platform: 'darwin', configuredOn: '2026-08-05' })
  );

  const ctx = contextOf(runHook(home));
  assert.ok(ctx.includes(vault), 'context names the vault path');
  assert.match(ctx, /proactiv/i, 'context instructs proactive capture');
  assert.match(ctx, /decisions/i);
  assert.match(ctx, /obsidian-vault/, 'context points at the skill');
});

test('configured: output parses as the Claude Code SessionStart shape', () => {
  const home = tmpHome();
  const vault = path.join(home, 'Vault');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.mkdirSync(vault);
  fs.writeFileSync(
    path.join(home, '.claude', 'obsidian-vault.json'),
    JSON.stringify({ vaultPath: vault })
  );

  const parsed = JSON.parse(runHook(home));
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(typeof parsed.hookSpecificOutput.additionalContext, 'string');
});

test('unconfigured: nudges the user to run /vault-setup', () => {
  const ctx = contextOf(runHook(tmpHome()));
  assert.match(ctx, /\/vault-setup/);
});

test('unreadable config: still exits 0 and nudges rather than crashing', () => {
  const home = tmpHome();
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'obsidian-vault.json'), '{ broken');
  const ctx = contextOf(runHook(home));
  assert.match(ctx, /\/vault-setup/);
});

test('a vault path that no longer exists is treated as unconfigured', () => {
  const home = tmpHome();
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.claude', 'obsidian-vault.json'),
    JSON.stringify({ vaultPath: path.join(home, 'deleted-vault') })
  );
  const ctx = contextOf(runHook(home));
  assert.match(ctx, /\/vault-setup/);
});

test('every config state exits 0', () => {
  const good = tmpHome();
  fs.mkdirSync(path.join(good, '.claude'));
  fs.mkdirSync(path.join(good, 'V'));
  fs.writeFileSync(
    path.join(good, '.claude', 'obsidian-vault.json'),
    JSON.stringify({ vaultPath: path.join(good, 'V') })
  );
  const broken = tmpHome();
  fs.mkdirSync(path.join(broken, '.claude'));
  fs.writeFileSync(path.join(broken, '.claude', 'obsidian-vault.json'), 'nope');

  for (const home of [good, broken, tmpHome()]) {
    const r = require('child_process').spawnSync('node', [HOOK], {
      encoding: 'utf8',
      env: { ...process.env, HOME: home, OBSIDIAN_VAULT: '' },
    });
    assert.equal(r.status, 0, `exit 0 for HOME=${home}`);
  }
});

test('hooks.json registers SessionStart for startup, clear, and compact via the shim', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'hooks', 'hooks.json'), 'utf8'));
  const entry = hooks.hooks.SessionStart[0];
  assert.equal(entry.matcher, 'startup|clear|compact');
  assert.match(entry.hooks[0].command, /run-hook\.cmd/);
  assert.match(entry.hooks[0].command, /session-start\.js/);
  assert.match(entry.hooks[0].command, /CLAUDE_PLUGIN_ROOT/);
});

test('the shim is executable and runs the named script on Unix', () => {
  const shim = path.join(__dirname, '..', 'hooks', 'run-hook.cmd');
  assert.ok(fs.statSync(shim).mode & 0o111, 'run-hook.cmd must be executable');
  const home = tmpHome();
  const out = execFileSync(shim, ['session-start.js'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, OBSIDIAN_VAULT: '' },
  });
  assert.match(contextOf(out), /\/vault-setup/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/stewardc/claude && node --test test/hook.test.js`
Expected: FAIL — `ENOENT` spawning `hooks/session-start.js`

- [ ] **Step 3: Write the hook**

Create `hooks/session-start.js`:

```js
#!/usr/bin/env node
'use strict';

// SessionStart hook. Reads only the cached config — no registry parse, no
// filesystem scan — so it adds no measurable latency to session start.
// Any failure path emits nothing and exits 0: a broken plugin must never
// break a session.

const fs = require('fs');
const path = require('path');
const { readConfig } = require(path.join(__dirname, '..', 'scripts', 'lib', 'config.js'));

const CONFIGURED = (vaultPath) => `<obsidian-vault>
Obsidian vault: ${vaultPath}
Proactively capture durable knowledge there as it emerges — decisions (with rationale), plans and specs, and todo lists — and keep those notes current, without being asked. Be proportional: durable value yes, transient chatter no.
Use the 'obsidian-vault' skill for filing conventions before writing.
</obsidian-vault>`;

const UNCONFIGURED = `<obsidian-vault>
No Obsidian vault is configured yet. Tell the user to run /vault-setup to set one up (it can also create a vault from scratch).
</obsidian-vault>`;

function main() {
  let context = UNCONFIGURED;

  const config = readConfig();
  if (config && fs.existsSync(config.vaultPath)) {
    context = CONFIGURED(config.vaultPath);
  }

  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: context,
      },
    })}\n`
  );
}

try {
  main();
} catch {
  // Emit nothing rather than risk malformed output.
}
process.exit(0);
```

- [ ] **Step 4: Write `hooks.json` and the shim**

Create `hooks/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" session-start.js",
            "async": false
          }
        ]
      }
    ]
  }
}
```

Create `hooks/run-hook.cmd`:

```
: << 'CMDBLOCK'
@echo off
REM Cross-platform polyglot wrapper for hook scripts.
REM On Windows: cmd.exe runs the batch portion, which finds and calls node.
REM On Unix: the shell interprets this as a script (: is a no-op in bash).
REM
REM Usage: run-hook.cmd <script-name.js> [args...]

if "%~1"=="" (
    echo run-hook.cmd: missing script name >&2
    exit /b 1
)

set "HOOK_DIR=%~dp0"

REM node on PATH is the normal case on Windows.
where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    node "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)

REM Standard installer locations.
if exist "C:\Program Files\nodejs\node.exe" (
    "C:\Program Files\nodejs\node.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    "%ProgramFiles(x86)%\nodejs\node.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)

REM No node found - exit silently rather than error.
REM (the skill still works, just without SessionStart context injection)
exit /b 0
CMDBLOCK

# Unix: run the named script with node.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_NAME="$1"
shift
exec node "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
```

Then make it executable:

```bash
chmod +x hooks/run-hook.cmd hooks/session-start.js scripts/resolve-vault.js
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /Users/stewardc/claude && node --test test/hook.test.js`
Expected: PASS — `# fail 0`

- [ ] **Step 6: Verify the hook by hand**

Run: `cd /Users/stewardc/claude && node hooks/session-start.js`
Expected: JSON containing `run /vault-setup` (no config exists yet on this machine), and `echo $?` prints `0`.

- [ ] **Step 7: Commit**

```bash
git add hooks test/hook.test.js
git commit -m "feat: add SessionStart hook with cross-platform node shim"
```

---

### Task 8: Vault scaffolding and seeded policy (`scripts/lib/scaffold.js` + templates)

**Files:**
- Create: `scripts/lib/templates/Area.md`
- Create: `scripts/lib/templates/Daily.md`
- Create: `scripts/lib/templates/Meeting.md`
- Create: `scripts/lib/templates/Permanent Note.md`
- Create: `scripts/lib/templates/Project.md`
- Create: `scripts/lib/templates/Resource.md`
- Create: `scripts/lib/templates/vault-CLAUDE.md`
- Create: `scripts/lib/scaffold.js`
- Test: `test/scaffold.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `FOLDERS` → `string[]` — the nine folder names, in order.
  - `scaffoldVault(vaultPath, { templateDir } = {})` → `{ created: string[], skipped: string[] }`. Paths in both arrays are vault-relative. Creates missing folders, copies missing templates into `Templates/`, and writes a root `CLAUDE.md` **only if none exists**. Never modifies or deletes anything.

- [ ] **Step 1: Seed the template files from the existing vault**

The six templates already exist in this user's vault and are the canonical versions. Copy them in rather than retyping:

```bash
cd /Users/stewardc/claude
mkdir -p scripts/lib/templates
cp ~/Documents/Claude/Templates/*.md scripts/lib/templates/
ls scripts/lib/templates/
```

Expected: `Area.md  Daily.md  Meeting.md  Permanent Note.md  Project.md  Resource.md`

- [ ] **Step 2: Write the policy seed**

Create `scripts/lib/templates/vault-CLAUDE.md`. This is the file that makes the vault own its own policy — it is copied to the vault root by setup, and is the user's from that moment on.

```markdown
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
```

- [ ] **Step 3: Write the failing test**

Create `test/scaffold.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scaffoldVault, FOLDERS } = require('../scripts/lib/scaffold');

const TEMPLATE_DIR = path.join(__dirname, '..', 'scripts', 'lib', 'templates');
const TEMPLATE_NAMES = [
  'Area.md', 'Daily.md', 'Meeting.md', 'Permanent Note.md', 'Project.md', 'Resource.md',
];
const emptyVault = () => fs.mkdtempSync(path.join(os.tmpdir(), 'obsscaf-'));

test('FOLDERS is the nine expected folders', () => {
  assert.deepEqual(FOLDERS, [
    '00-Inbox', '01-Projects', '02-Areas', '03-Resources', '04-Archive',
    'Notes', 'Daily', 'Templates', 'Attachments',
  ]);
});

test('all six templates plus the policy seed ship with the plugin', () => {
  for (const name of TEMPLATE_NAMES) {
    assert.ok(fs.existsSync(path.join(TEMPLATE_DIR, name)), `${name} must exist`);
  }
  assert.ok(fs.existsSync(path.join(TEMPLATE_DIR, 'vault-CLAUDE.md')));
});

test('an empty vault gets every folder, every template, and a CLAUDE.md', () => {
  const vault = emptyVault();
  const { created, skipped } = scaffoldVault(vault);

  for (const f of FOLDERS) {
    assert.ok(fs.statSync(path.join(vault, f)).isDirectory(), `${f} created`);
    assert.ok(created.includes(`${f}/`), `${f}/ reported as created`);
  }
  for (const name of TEMPLATE_NAMES) {
    assert.ok(fs.existsSync(path.join(vault, 'Templates', name)), `${name} copied`);
    assert.ok(created.includes(`Templates/${name}`));
  }
  assert.ok(fs.existsSync(path.join(vault, 'CLAUDE.md')));
  assert.ok(created.includes('CLAUDE.md'));
  assert.deepEqual(skipped, []);
});

test('the copied CLAUDE.md is the policy seed, not the template filename', () => {
  const vault = emptyVault();
  scaffoldVault(vault);
  const written = fs.readFileSync(path.join(vault, 'CLAUDE.md'), 'utf8');
  assert.equal(written, fs.readFileSync(path.join(TEMPLATE_DIR, 'vault-CLAUDE.md'), 'utf8'));
  assert.ok(!fs.existsSync(path.join(vault, 'Templates', 'vault-CLAUDE.md')),
    'the policy seed is not itself a note template');
});

test('a fully populated vault is not rewritten at all', () => {
  const vault = emptyVault();
  scaffoldVault(vault);

  // Fingerprint every file, then re-scaffold.
  const before = new Map();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else before.set(p, fs.readFileSync(p, 'utf8'));
    }
  };
  walk(vault);

  const { created, skipped } = scaffoldVault(vault);
  assert.deepEqual(created, [], 'nothing created on a second run');
  assert.ok(skipped.includes('CLAUDE.md'));
  assert.ok(skipped.includes('Templates/Project.md'));
  for (const [p, content] of before) {
    assert.equal(fs.readFileSync(p, 'utf8'), content, `${p} unchanged`);
  }
});

test('a partially populated vault gets only what is missing', () => {
  const vault = emptyVault();
  fs.mkdirSync(path.join(vault, '00-Inbox'));
  fs.mkdirSync(path.join(vault, 'Templates'));
  fs.writeFileSync(path.join(vault, 'Templates', 'Project.md'), 'MINE');

  const { created, skipped } = scaffoldVault(vault);
  assert.ok(skipped.includes('00-Inbox/'));
  assert.ok(skipped.includes('Templates/'));
  assert.ok(skipped.includes('Templates/Project.md'));
  assert.ok(created.includes('Notes/'));
  assert.ok(created.includes('Templates/Daily.md'));
  assert.equal(fs.readFileSync(path.join(vault, 'Templates', 'Project.md'), 'utf8'), 'MINE');
});

test('a pre-existing CLAUDE.md is left byte-for-byte untouched', () => {
  const vault = emptyVault();
  const mine = '# My rules\n\nI do not use PARA.\n';
  fs.writeFileSync(path.join(vault, 'CLAUDE.md'), mine);

  const { created, skipped } = scaffoldVault(vault);
  assert.equal(fs.readFileSync(path.join(vault, 'CLAUDE.md'), 'utf8'), mine);
  assert.ok(skipped.includes('CLAUDE.md'));
  assert.ok(!created.includes('CLAUDE.md'));
});

test('scaffoldVault throws for a vault path that does not exist', () => {
  assert.throws(() => scaffoldVault('/nonexistent-vault-xyz'), /does not exist/);
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd /Users/stewardc/claude && node --test test/scaffold.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/scaffold'`

- [ ] **Step 5: Write the implementation**

Create `scripts/lib/scaffold.js`:

```js
'use strict';

const fs = require('fs');
const path = require('path');

const FOLDERS = [
  '00-Inbox',
  '01-Projects',
  '02-Areas',
  '03-Resources',
  '04-Archive',
  'Notes',
  'Daily',
  'Templates',
  'Attachments',
];

const POLICY_SEED = 'vault-CLAUDE.md';
const DEFAULT_TEMPLATE_DIR = path.join(__dirname, 'templates');

/**
 * Bring a vault up to the expected shape. Idempotent and strictly additive:
 * creates only what is absent, and never modifies or deletes existing content.
 * A vault-root CLAUDE.md is user-owned once it exists, so it is only ever
 * written when missing.
 */
function scaffoldVault(vaultPath, { templateDir = DEFAULT_TEMPLATE_DIR } = {}) {
  if (!fs.existsSync(vaultPath)) {
    throw new Error(`Vault path does not exist: ${vaultPath}`);
  }

  const created = [];
  const skipped = [];

  for (const folder of FOLDERS) {
    const dir = path.join(vaultPath, folder);
    if (fs.existsSync(dir)) {
      skipped.push(`${folder}/`);
    } else {
      fs.mkdirSync(dir, { recursive: true });
      created.push(`${folder}/`);
    }
  }

  const templates = fs
    .readdirSync(templateDir)
    .filter((name) => name.endsWith('.md') && name !== POLICY_SEED)
    .sort();

  for (const name of templates) {
    const dest = path.join(vaultPath, 'Templates', name);
    if (fs.existsSync(dest)) {
      skipped.push(`Templates/${name}`);
    } else {
      fs.copyFileSync(path.join(templateDir, name), dest);
      created.push(`Templates/${name}`);
    }
  }

  const claudeMd = path.join(vaultPath, 'CLAUDE.md');
  if (fs.existsSync(claudeMd)) {
    skipped.push('CLAUDE.md');
  } else {
    fs.copyFileSync(path.join(templateDir, POLICY_SEED), claudeMd);
    created.push('CLAUDE.md');
  }

  return { created, skipped };
}

module.exports = { scaffoldVault, FOLDERS };
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd /Users/stewardc/claude && node --test test/scaffold.test.js`
Expected: PASS — `# fail 0`

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/scaffold.js "scripts/lib/templates" test/scaffold.test.js
git commit -m "feat: add idempotent vault scaffolding with seeded templates and policy"
```

---

### Task 9: Rewrite the skill (`skills/obsidian-vault/SKILL.md`)

**Files:**
- Modify: `skills/obsidian-vault/SKILL.md` (full rewrite)
- Test: `test/skill.test.js`

**Interfaces:**
- Consumes: `scripts/resolve-vault.js` (Task 6) as a documented fallback path.
- Produces: nothing programmatic. The test is a lint against the failure modes of the old version.

The old skill hardcoded two different paths (`~/Documents/Claude` in the description, `~/Documents/ClaudeVault` in the body — only the first exists), hardcoded PARA, named a specific project (`whatsupfv`), and delegated proactive-capture to `~/.claude/CLAUDE.md`. All of that must go.

- [ ] **Step 1: Write the failing test**

Create `test/skill.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SKILL = path.join(__dirname, '..', 'skills', 'obsidian-vault', 'SKILL.md');
const body = () => fs.readFileSync(SKILL, 'utf8');

test('the skill has valid frontmatter with a name and description', () => {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(body());
  assert.ok(m, 'frontmatter block present');
  assert.match(m[1], /^name: obsidian-vault$/m);
  assert.match(m[1], /^description: .{40,}/m);
});

test('the skill hardcodes no vault path', () => {
  const text = body();
  assert.doesNotMatch(text, /ClaudeVault/, 'the old typo path must be gone');
  assert.doesNotMatch(text, /~\/Documents\/Claude/, 'no hardcoded vault path');
  assert.doesNotMatch(text, /\/Users\/stewardc/, 'no absolute user path');
});

test('the skill names no specific project', () => {
  assert.doesNotMatch(body(), /whatsupfv/i);
});

test('the skill carries the proactive-capture protocol itself', () => {
  const text = body();
  assert.match(text, /proactiv/i);
  assert.match(text, /decision/i);
  assert.match(text, /plan/i);
  assert.match(text, /todo/i);
  assert.doesNotMatch(
    text,
    /~\/\.claude\/CLAUDE\.md/,
    'the protocol lives here now, not delegated to user CLAUDE.md'
  );
});

test('the skill defers filing policy to the vault CLAUDE.md', () => {
  assert.match(body(), /CLAUDE\.md/);
});

test('the skill documents the resolver fallback and the setup escape hatch', () => {
  const text = body();
  assert.match(text, /CLAUDE_PLUGIN_ROOT.*resolve-vault\.js|resolve-vault\.js/);
  assert.match(text, /\/vault-setup/);
});

test('the skill tells Claude to look before writing and to use the real date', () => {
  const text = body();
  assert.match(text, /grep|glob/i);
  assert.match(text, /placeholder/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/stewardc/claude && node --test test/skill.test.js`
Expected: FAIL — several assertions fail against the old skill (`ClaudeVault` present, `whatsupfv` present, `~/.claude/CLAUDE.md` present).

- [ ] **Step 3: Rewrite the skill**

Replace the entire contents of `skills/obsidian-vault/SKILL.md` with:

```markdown
---
name: obsidian-vault
description: Use when saving, capturing, looking up, or organizing notes, plans, ideas, meeting notes, decisions, journal entries, or reference material — or when the user refers to "my vault", "my notes", or "the vault". Also use proactively, without being asked, when a session produces a decision, a plan, or a todo list worth keeping.
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/stewardc/claude && node --test test/skill.test.js`
Expected: PASS — `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add skills/obsidian-vault/SKILL.md test/skill.test.js
git commit -m "refactor: rewrite skill to carry mechanism, deferring policy to the vault"
```

---

### Task 10: The `/vault-setup` command

**Files:**
- Create: `commands/vault-setup.md`
- Test: `test/command.test.js`

**Interfaces:**
- Consumes: `scripts/resolve-vault.js --all` (Task 6), `scaffoldVault` (Task 8), `writeConfig` (Task 5).
- Produces: the `/vault-setup` slash command. This is a prompt file, so its "test" verifies structure and that the commands it instructs Claude to run actually exist and work.

The command is deliberately a prompt rather than a script: steps 2 and 5 require judgment and consent (choosing among candidates, agreeing to a permission change), which a non-interactive script can't ask for.

- [ ] **Step 1: Write the failing test**

Create `test/command.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CMD = path.join(__dirname, '..', 'commands', 'vault-setup.md');
const ROOT = path.join(__dirname, '..');

test('the command file has frontmatter with a description', () => {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(CMD, 'utf8'));
  assert.ok(m, 'frontmatter present');
  assert.match(m[1], /^description: .{20,}/m);
});

test('the command covers all seven setup steps', () => {
  const text = fs.readFileSync(CMD, 'utf8');
  for (const needle of [
    'resolve-vault.js',      // 1 resolve
    '"open": true',          // 2 confirm, defaulting to the open vault
    '.obsidian',             // 2 create-from-scratch marker
    'scaffold',              // 3+4 folders, templates, CLAUDE.md
    'settings.json',         // 5 permissions
    'obsidian-vault.json',   // 6 cache
  ]) {
    assert.ok(text.includes(needle), `command must mention ${needle}`);
  }
  assert.match(text, /summary/i, '7 print a summary');
});

test('the command never instructs an overwrite of a vault CLAUDE.md', () => {
  const text = fs.readFileSync(CMD, 'utf8');
  assert.match(text, /skip|never overwrite|already exists/i);
});

test('the scaffold entry point the command invokes actually runs', () => {
  const vault = fs.mkdtempSync(path.join(require('os').tmpdir(), 'obscmd-'));
  const out = execFileSync(
    'node',
    ['-e', `const {scaffoldVault}=require(process.argv[1]);console.log(JSON.stringify(scaffoldVault(process.argv[2])))`,
     path.join(ROOT, 'scripts', 'lib', 'scaffold.js'), vault],
    { encoding: 'utf8' }
  );
  const { created } = JSON.parse(out);
  assert.ok(created.includes('CLAUDE.md'));
  assert.ok(fs.existsSync(path.join(vault, 'Notes')));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/stewardc/claude && node --test test/command.test.js`
Expected: FAIL — `ENOENT ... commands/vault-setup.md`

- [ ] **Step 3: Write the command**

Create `commands/vault-setup.md`:

```markdown
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/stewardc/claude && node --test test/command.test.js`
Expected: PASS — `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add commands/vault-setup.md test/command.test.js
git commit -m "feat: add /vault-setup command"
```

---

### Task 11: README, full suite green, and a real macOS smoke test

**Files:**
- Create: `README.md`
- Test: the whole suite, plus a manual end-to-end run

**Interfaces:**
- Consumes: everything.
- Produces: an installable, documented plugin.

- [ ] **Step 1: Run the whole suite**

Run: `cd /Users/stewardc/claude && npm test`
Expected: PASS — `# fail 0` across all test files. Fix anything red before continuing.

- [ ] **Step 2: Write the README**

Create `README.md`:

```markdown
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
npm test        # node --test test/
```

Tests point `HOME`, `APPDATA`, and `XDG_CONFIG_HOME` at fixture directories under
`test/fixtures/`, so every platform's registry layout is covered from any machine.

**Known gap:** only macOS is executed in CI. Windows and WSL are covered by fixtures and
unit tests but still want a real-machine smoke test.

## License

MIT
```

- [ ] **Step 3: Smoke test the plugin end to end on this machine**

This exercises the real install path against the real vault at `~/Documents/Claude`.

```bash
cd /Users/stewardc/claude

# 1. The resolver finds the real vault.
node scripts/resolve-vault.js --all

# 2. The hook nudges, because setup hasn't run yet.
node hooks/session-start.js

# 3. Scaffolding the real vault is a near-no-op — it is already populated.
node -e "const {scaffoldVault}=require('./scripts/lib/scaffold.js');console.log(JSON.stringify(scaffoldVault(process.env.HOME+'/Documents/Claude'),null,2))"
```

Expected:
1. `vaultPath` is `/Users/stewardc/Documents/Claude`, `platform` is `darwin`.
2. JSON mentioning `/vault-setup`.
3. `created` is exactly `["CLAUDE.md"]` — the nine folders and six templates already
   exist, so everything else lands in `skipped`. The vault's `README.md` is untouched.

Verify nothing else changed in the vault:

```bash
cd ~/Documents/Claude && ls && head -5 CLAUDE.md
```

Expected: the pre-existing folders plus the new `CLAUDE.md`; `README.md` still present and
unmodified.

- [ ] **Step 4: Verify the manifests parse as a marketplace**

Run: `cd /Users/stewardc/claude && node -e "const m=require('./.claude-plugin/marketplace.json');const p=require('./.claude-plugin/plugin.json');console.log(m.plugins[0].name===p.name?'OK':'MISMATCH')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add README with install, architecture, and known platform gap"
```

- [ ] **Step 6: Install the plugin locally and confirm the hook fires**

This is the only check that proves the wiring — the manifests, hook registration, and shim
are otherwise untested in a real session.

```bash
cd /Users/stewardc/claude
/plugin marketplace add /Users/stewardc/claude
/plugin install obsidian-vault
```

Then run `/vault-setup`, and start a fresh session (`/clear`). Expected: the new session's
context contains the `<obsidian-vault>` block naming
`/Users/stewardc/Documents/Claude`, and `~/.claude/obsidian-vault.json` exists.

If it fires, the plugin now supplies the proactive-capture protocol, and the copy in
`~/.claude/CLAUDE.md` is redundant. **Ask the user** before touching that file — it is
outside this repo — then remove the `## Knowledge capture protocol (Obsidian vault)`
section, leaving the rest of the file intact.

- [ ] **Step 7: Update the vault project note**

Check off the completed tasks in `~/Documents/Claude/01-Projects/obsidian-vault-plugin/obsidian-vault-plugin.md`,
add a link to this plan under `## Plans`, and log any decisions made during
implementation that differ from the spec.

---

## Deviations from the spec

Recorded here so a reviewer can see they were deliberate:

1. **Templates live in `scripts/lib/templates/`**, not `skills/obsidian-vault/templates/`.
   `scaffold.js` is their only consumer; the skill reads templates from the *vault*, not
   from the plugin.
2. **`run-hook.cmd` invokes `node`, not `bash`.** The spec says "the same approach the
   `superpowers` plugin uses" — that plugin's hook is a bash script, ours is Node, so the
   polyglot shim's Windows branch locates `node.exe` instead of `bash.exe`.
3. **Two extra lib modules** the spec folded into `resolve-vault.js`: `glob.js` and
   `config.js`. Each is separately testable and the resolver stays readable.
4. **`Library` is skipped during globbing** on macOS (the iCloud Obsidian directory is an
   explicit root instead), so scanning `~` doesn't crawl the whole Library tree.
