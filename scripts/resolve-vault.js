#!/usr/bin/env node
'use strict';

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
