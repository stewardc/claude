'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

test('plugin.json declares the plugin identity', () => {
  const plugin = read('.claude-plugin/plugin.json');
  assert.equal(plugin.name, 'obsidian-vault');
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  assert.ok(plugin.description.length > 20);
  assert.equal(plugin.license, 'MIT');
});

test('marketplace.json advertises exactly this plugin from the repo root', () => {
  const market = read('.claude-plugin/marketplace.json');
  assert.equal(market.plugins.length, 1);
  assert.equal(market.plugins[0].name, 'obsidian-vault');
  assert.equal(market.plugins[0].source, './');
});

test('marketplace and plugin versions agree', () => {
  assert.equal(
    read('.claude-plugin/marketplace.json').plugins[0].version,
    read('.claude-plugin/plugin.json').version
  );
});

test('package.json pulls in no dependencies and is CommonJS', () => {
  const pkg = read('package.json');
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
  assert.notEqual(pkg.type, 'module');
});
