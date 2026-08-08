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
 * Prefers `wslpath -u`, which already knows the configured mount root; falls
 * back to a regex when wslpath is unavailable, and that fallback has to look
 * the root up itself.
 * Returns null when the input is not a drive-letter path.
 */
function winToWslPath(winPath, opts = {}) {
  const { exec = defaultExec } = opts;
  if (!winPath || typeof winPath !== 'string') return null;

  try {
    const out = exec('wslpath', ['-u', winPath]);
    if (out && out.trim()) return out.trim();
  } catch {
    // wslpath missing or failed — fall through to the regex.
  }

  const m = /^([A-Za-z]):[\\/]/.exec(winPath);
  if (!m) return null;
  const root = opts.mntRoot || automountRoot(opts);
  const rest = winPath.slice(3).replace(/\\/g, '/');
  return `${root === '/' ? '' : root}/${m[1].toLowerCase()}/${rest}`;
}

/**
 * Where WSL mounts Windows drives. `/mnt` is the default, but `/etc/wsl.conf`
 * can move it:
 *
 *     [automount]
 *     root = /windows/
 *
 * Assuming `/mnt` on such a machine means never finding a Windows-side vault.
 * `OBSIDIAN_VAULT_MNT_ROOT` overrides both — an escape hatch for exotic setups,
 * and the seam that lets tests run hermetically on a real WSL host.
 */
function automountRoot({ env = process.env, readFile = defaultReadFile } = {}) {
  if (env.OBSIDIAN_VAULT_MNT_ROOT) return stripTrailingSlash(env.OBSIDIAN_VAULT_MNT_ROOT);

  try {
    let inAutomount = false;
    for (const raw of readFile('/etc/wsl.conf').split(/\r?\n/)) {
      const line = raw.replace(/[#;].*$/, '').trim();
      if (!line) continue;

      const section = /^\[(.+)\]$/.exec(line);
      if (section) {
        inAutomount = section[1].trim().toLowerCase() === 'automount';
        continue;
      }

      if (!inAutomount) continue;
      const kv = /^root\s*=\s*(.+)$/i.exec(line);
      if (kv) {
        const value = stripTrailingSlash(kv[1].trim().replace(/^["']|["']$/g, ''));
        if (value) return value;
      }
    }
  } catch {
    // No /etc/wsl.conf, or unreadable — the default is correct.
  }

  return '/mnt';
}

function stripTrailingSlash(p) {
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

/** Platform name used throughout the plugin: darwin | win32 | linux | wsl. */
function detectPlatform({ env = process.env, platform = process.platform, readFile = defaultReadFile } = {}) {
  if (platform === 'linux' && isWSL({ env, readFile })) return 'wsl';
  return platform;
}

module.exports = { isWSL, winToWslPath, detectPlatform, automountRoot };
