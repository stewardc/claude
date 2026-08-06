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
