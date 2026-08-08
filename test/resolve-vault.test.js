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

// The CLI is a subprocess: unlike the in-process tests above it cannot be
// handed `platform`, so it detects the real one. Three consequences, all
// handled by cliEnv() + homeWithVaultEverywhere():
//   - the registry it reads depends on the host, so seed all of them;
//   - on WSL it also scans <mntRoot>/*/Users/* for Windows-side registries,
//     a path with no relation to HOME -- point mntRoot at an empty dir;
//   - a stray OBSIDIAN_VAULT or XDG_CONFIG_HOME in the ambient env would win.

/** A temp home carrying a registry for every platform's location at once. */
function homeWithVaultEverywhere() {
  const { home, vault } = homeWithVault(); // darwin registry + the vault itself
  const registry = JSON.stringify({
    vaults: { a1: { path: vault, ts: 1690000000000, open: true } },
  });

  for (const parts of [
    ['.config', 'obsidian'], // linux / wsl, via XDG_CONFIG_HOME below
    ['AppData', 'Roaming', 'obsidian'], // win32, via APPDATA below
  ]) {
    const dir = path.join(home, ...parts);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'obsidian.json'), registry);
  }

  return { home, vault };
}

/** Env that pins every host-dependent lookup at the fixture home. */
function cliEnv(home, overrides = {}) {
  return {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    OBSIDIAN_VAULT: '',
    XDG_CONFIG_HOME: path.join(home, '.config'),
    APPDATA: path.join(home, 'AppData', 'Roaming'),
    // An empty directory: no Windows-side registry exists under it, so a WSL
    // host resolves from the fixture home like every other platform.
    OBSIDIAN_VAULT_MNT_ROOT: fs.mkdtempSync(path.join(os.tmpdir(), 'obsmnt-')),
    ...overrides,
  };
}

test('the CLI prints valid JSON on stdout and exits 0', () => {
  const { home, vault } = homeWithVaultEverywhere();
  const out = execFileSync('node', [SCRIPT], { encoding: 'utf8', env: cliEnv(home) });
  const parsed = JSON.parse(out);
  assert.equal(parsed.vaultPath, vault);
  assert.equal(parsed.source, 'registry');
});

test('the CLI honours OBSIDIAN_VAULT and --all', () => {
  const { home, vault } = homeWithVaultEverywhere();
  const out = execFileSync('node', [SCRIPT, '--all'], {
    encoding: 'utf8',
    env: cliEnv(home, { OBSIDIAN_VAULT: vault }),
  });
  const parsed = JSON.parse(out);
  assert.equal(parsed.source, 'env');
  assert.ok(parsed.candidates.length >= 1, '--all scans even on an env hit');
});
