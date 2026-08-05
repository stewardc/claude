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
