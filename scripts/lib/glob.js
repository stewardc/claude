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
