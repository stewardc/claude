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
