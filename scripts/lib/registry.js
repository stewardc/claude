'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { winToWslPath, automountRoot } = require('./wsl');

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
function registryPaths({ env = process.env, platform = process.platform, home = os.homedir(), mntRoot } = {}) {
  const root = mntRoot || automountRoot({ env });
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
      return [...linuxPaths(env, home), ...windowsSidePaths(root)];
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
  const { exec, env = process.env, existsSync = fs.existsSync } = opts;
  const found = [];

  // Resolved once and handed down so the wslpath-less fallback lands under the
  // same mount root the registry paths were built from.
  const mntRoot = opts.mntRoot || automountRoot({ env });

  for (const { path: file, windowsSide } of registryPaths({ ...opts, mntRoot })) {
    for (const entry of parseRegistry(file)) {
      let resolved = entry.path;
      if (windowsSide) {
        resolved = winToWslPath(entry.path, { mntRoot, ...(exec ? { exec } : {}) });
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
