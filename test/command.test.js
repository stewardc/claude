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
