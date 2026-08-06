'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scaffoldVault, FOLDERS } = require('../scripts/lib/scaffold');

const TEMPLATE_DIR = path.join(__dirname, '..', 'scripts', 'lib', 'templates');
const TEMPLATE_NAMES = [
  'Area.md', 'Daily.md', 'Meeting.md', 'Permanent Note.md', 'Project.md', 'Resource.md',
];
const emptyVault = () => fs.mkdtempSync(path.join(os.tmpdir(), 'obsscaf-'));

test('FOLDERS is the nine expected folders', () => {
  assert.deepEqual(FOLDERS, [
    '00-Inbox', '01-Projects', '02-Areas', '03-Resources', '04-Archive',
    'Notes', 'Daily', 'Templates', 'Attachments',
  ]);
});

test('all six templates plus the policy seed ship with the plugin', () => {
  for (const name of TEMPLATE_NAMES) {
    assert.ok(fs.existsSync(path.join(TEMPLATE_DIR, name)), `${name} must exist`);
  }
  assert.ok(fs.existsSync(path.join(TEMPLATE_DIR, 'vault-CLAUDE.md')));
});

test('an empty vault gets every folder, every template, and a CLAUDE.md', () => {
  const vault = emptyVault();
  const { created, skipped } = scaffoldVault(vault);

  for (const f of FOLDERS) {
    assert.ok(fs.statSync(path.join(vault, f)).isDirectory(), `${f} created`);
    assert.ok(created.includes(`${f}/`), `${f}/ reported as created`);
  }
  for (const name of TEMPLATE_NAMES) {
    assert.ok(fs.existsSync(path.join(vault, 'Templates', name)), `${name} copied`);
    assert.ok(created.includes(`Templates/${name}`));
  }
  assert.ok(fs.existsSync(path.join(vault, 'CLAUDE.md')));
  assert.ok(created.includes('CLAUDE.md'));
  assert.deepEqual(skipped, []);
});

test('the copied CLAUDE.md is the policy seed, not the template filename', () => {
  const vault = emptyVault();
  scaffoldVault(vault);
  const written = fs.readFileSync(path.join(vault, 'CLAUDE.md'), 'utf8');
  assert.equal(written, fs.readFileSync(path.join(TEMPLATE_DIR, 'vault-CLAUDE.md'), 'utf8'));
  assert.ok(!fs.existsSync(path.join(vault, 'Templates', 'vault-CLAUDE.md')),
    'the policy seed is not itself a note template');
});

test('a fully populated vault is not rewritten at all', () => {
  const vault = emptyVault();
  scaffoldVault(vault);

  // Fingerprint every file, then re-scaffold.
  const before = new Map();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else before.set(p, fs.readFileSync(p, 'utf8'));
    }
  };
  walk(vault);

  const { created, skipped } = scaffoldVault(vault);
  assert.deepEqual(created, [], 'nothing created on a second run');
  assert.ok(skipped.includes('CLAUDE.md'));
  assert.ok(skipped.includes('Templates/Project.md'));
  for (const [p, content] of before) {
    assert.equal(fs.readFileSync(p, 'utf8'), content, `${p} unchanged`);
  }
});

test('a partially populated vault gets only what is missing', () => {
  const vault = emptyVault();
  fs.mkdirSync(path.join(vault, '00-Inbox'));
  fs.mkdirSync(path.join(vault, 'Templates'));
  fs.writeFileSync(path.join(vault, 'Templates', 'Project.md'), 'MINE');

  const { created, skipped } = scaffoldVault(vault);
  assert.ok(skipped.includes('00-Inbox/'));
  assert.ok(skipped.includes('Templates/'));
  assert.ok(skipped.includes('Templates/Project.md'));
  assert.ok(created.includes('Notes/'));
  assert.ok(created.includes('Templates/Daily.md'));
  assert.equal(fs.readFileSync(path.join(vault, 'Templates', 'Project.md'), 'utf8'), 'MINE');
});

test('a pre-existing CLAUDE.md is left byte-for-byte untouched', () => {
  const vault = emptyVault();
  const mine = '# My rules\n\nI do not use PARA.\n';
  fs.writeFileSync(path.join(vault, 'CLAUDE.md'), mine);

  const { created, skipped } = scaffoldVault(vault);
  assert.equal(fs.readFileSync(path.join(vault, 'CLAUDE.md'), 'utf8'), mine);
  assert.ok(skipped.includes('CLAUDE.md'));
  assert.ok(!created.includes('CLAUDE.md'));
});

test('scaffoldVault throws for a vault path that does not exist', () => {
  assert.throws(() => scaffoldVault('/nonexistent-vault-xyz'), /does not exist/);
});
