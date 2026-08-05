'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { globRoots, findVaults } = require('../scripts/lib/glob');

function tree(spec) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'obsglob-'));
  for (const dir of spec) fs.mkdirSync(path.join(root, dir), { recursive: true });
  return root;
}

test('globRoots covers Documents, home, iCloud, and OneDrive on darwin', () => {
  const roots = globRoots({ platform: 'darwin', env: {}, home: '/Users/me' });
  assert.ok(roots.includes('/Users/me/Documents'));
  assert.ok(roots.includes('/Users/me'));
  assert.ok(roots.some((r) => r.includes('iCloud~md~obsidian')));
});

test('globRoots honours the OneDrive env var when set', () => {
  const roots = globRoots({ platform: 'win32', env: { OneDrive: 'C:\\Users\\me\\OneDrive' }, home: 'C:\\Users\\me' });
  assert.ok(roots.includes('C:\\Users\\me\\OneDrive'));
});

test('findVaults finds a vault at depth 1', () => {
  const root = tree(['Documents/Vault/.obsidian']);
  assert.deepEqual(
    findVaults({ roots: [path.join(root, 'Documents')] }),
    [path.join(root, 'Documents', 'Vault')]
  );
});

test('findVaults finds a vault at the maximum depth', () => {
  const root = tree(['a/b/c/.obsidian']);
  assert.deepEqual(findVaults({ roots: [root], maxDepth: 3 }), [path.join(root, 'a', 'b', 'c')]);
});

test('findVaults does not find a vault beyond the maximum depth', () => {
  const root = tree(['a/b/c/d/.obsidian']);
  assert.deepEqual(findVaults({ roots: [root], maxDepth: 3 }), []);
});

test('findVaults skips dotfile directories and node_modules', () => {
  const root = tree(['.hidden/Vault/.obsidian', 'node_modules/pkg/.obsidian']);
  assert.deepEqual(findVaults({ roots: [root] }), []);
});

test('findVaults does not descend into a vault it already matched', () => {
  const root = tree(['Vault/.obsidian', 'Vault/Nested/.obsidian']);
  assert.deepEqual(findVaults({ roots: [root] }), [path.join(root, 'Vault')]);
});

test('findVaults deduplicates a vault reachable from two roots', () => {
  const root = tree(['Documents/Vault/.obsidian']);
  const found = findVaults({ roots: [root, path.join(root, 'Documents')] });
  assert.deepEqual(found, [path.join(root, 'Documents', 'Vault')]);
});

test('findVaults ignores roots that do not exist', () => {
  assert.deepEqual(findVaults({ roots: ['/nonexistent-root-xyz'] }), []);
});

test('findVaults ignores a .obsidian that is a file rather than a directory', () => {
  const root = tree(['Vault']);
  fs.writeFileSync(path.join(root, 'Vault', '.obsidian'), 'not a dir');
  assert.deepEqual(findVaults({ roots: [root] }), []);
});
