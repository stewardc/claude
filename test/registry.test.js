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
  assert.deepEqual(paths, [
    '/home/me/.xdg/obsidian/obsidian.json',
    '/home/me/.var/app/md.obsidian.Obsidian/config/obsidian/obsidian.json',
    '/home/me/snap/obsidian/current/.config/obsidian/obsidian.json',
  ]);
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

/**
 * Write a second registry, at the flatpak location, listing the same vault the
 * `linux` fixture's XDG registry already lists — but with a different record.
 * Returns that shared vault path.
 */
function addFlatpakDuplicate(home, record) {
  const xdgFile = path.join(home, '.config', 'obsidian', 'obsidian.json');
  const vaultPath = Object.values(JSON.parse(fs.readFileSync(xdgFile, 'utf8')).vaults)[0].path;
  const flatpak = path.join(home, '.var', 'app', 'md.obsidian.Obsidian', 'config', 'obsidian');
  fs.mkdirSync(flatpak, { recursive: true });
  fs.writeFileSync(
    path.join(flatpak, 'obsidian.json'),
    JSON.stringify({ vaults: { dup: { path: vaultPath, ...record } } })
  );
  return vaultPath;
}

test('readRegistry deduplicates a vault listed in two registries', () => {
  const home = materialize('linux');
  addFlatpakDuplicate(home, { ts: 1690000000000, open: true });
  const vaults = readRegistry({ platform: 'linux', env: {}, home });
  assert.equal(vaults.length, 1);
});

test('readRegistry keeps the richer of two records for the same vault', () => {
  // XDG (read first) has open:true and a newer ts; the flatpak duplicate is
  // poorer on both counts, so the first record must survive.
  const home = materialize('linux');
  addFlatpakDuplicate(home, { ts: 1600000000000, open: false });

  const vaults = readRegistry({ platform: 'linux', env: {}, home });
  assert.equal(vaults.length, 1);
  assert.equal(vaults[0].id, 'c1', 'the open record wins over the closed one');
  assert.equal(vaults[0].open, true);
  assert.equal(vaults[0].ts, 1690000000000);
});

test('readRegistry lets a later, newer record displace an earlier one', () => {
  // Both records are open, so the tie breaks on ts — and the newer one is the
  // flatpak duplicate, read second.
  const home = materialize('linux');
  addFlatpakDuplicate(home, { ts: 1700000000000, open: true });

  const vaults = readRegistry({ platform: 'linux', env: {}, home });
  assert.equal(vaults.length, 1);
  assert.equal(vaults[0].id, 'dup', 'the newer record replaces the older one');
  assert.equal(vaults[0].ts, 1700000000000);
});
