'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SKILL = path.join(__dirname, '..', 'skills', 'obsidian-vault', 'SKILL.md');
const body = () => fs.readFileSync(SKILL, 'utf8');

test('the skill has valid frontmatter with a name and description', () => {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(body());
  assert.ok(m, 'frontmatter block present');
  assert.match(m[1], /^name: obsidian-vault$/m);
  assert.match(m[1], /^description: .{40,}/m);
});

test('the skill hardcodes no vault path', () => {
  const text = body();
  assert.doesNotMatch(text, /ClaudeVault/, 'the old typo path must be gone');
  assert.doesNotMatch(text, /~\/Documents\/Claude/, 'no hardcoded vault path');
  assert.doesNotMatch(text, /\/Users\/stewardc/, 'no absolute user path');
});

test('the skill names no specific project', () => {
  assert.doesNotMatch(body(), /whatsupfv/i);
});

test('the skill carries the proactive-capture protocol itself', () => {
  const text = body();
  assert.match(text, /proactiv/i);
  assert.match(text, /decision/i);
  assert.match(text, /plan/i);
  assert.match(text, /todo/i);
  assert.doesNotMatch(
    text,
    /~\/\.claude\/CLAUDE\.md/,
    'the protocol lives here now, not delegated to user CLAUDE.md'
  );
});

test('the skill defers filing policy to the vault CLAUDE.md', () => {
  assert.match(body(), /CLAUDE\.md/);
});

test('the skill documents the resolver fallback and the setup escape hatch', () => {
  const text = body();
  assert.match(text, /CLAUDE_PLUGIN_ROOT.*resolve-vault\.js|resolve-vault\.js/);
  assert.match(text, /\/vault-setup/);
});

test('the skill tells Claude to look before writing and to use the real date', () => {
  const text = body();
  assert.match(text, /grep|glob/i);
  assert.match(text, /placeholder/i);
});
