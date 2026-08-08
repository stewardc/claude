'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const HOOK = path.join(__dirname, '..', 'hooks', 'plan-mode.js');
const tmpHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'obsplan-'));

/** A HOME with a configured, existing vault. */
function configuredHome() {
  const home = tmpHome();
  const vault = path.join(home, 'Documents', 'Claude');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.mkdirSync(vault, { recursive: true });
  fs.writeFileSync(
    path.join(home, '.claude', 'obsidian-vault.json'),
    JSON.stringify({ vaultPath: vault, platform: 'darwin', configuredOn: '2026-08-05' })
  );
  return { home, vault };
}

/** Run the hook with a PreToolUse payload on stdin. Returns raw stdout. */
function runHook(home, payload) {
  return execFileSync('node', [HOOK], {
    encoding: 'utf8',
    input: JSON.stringify(payload),
    env: { ...process.env, HOME: home, OBSIDIAN_VAULT: '' },
  });
}

function contextOf(stdout) {
  return JSON.parse(stdout).hookSpecificOutput.additionalContext;
}

test('configured: names the vault and the project the repo maps to', () => {
  const { home, vault } = configuredHome();
  const ctx = contextOf(runHook(home, { cwd: '/home/someone/code/acme-api' }));

  assert.ok(ctx.includes(vault), 'context names the vault path');
  assert.ok(ctx.includes('acme-api'), 'context names the project derived from cwd');
  assert.match(ctx, /01-Projects/, 'context suggests a concrete destination');
});

test('configured: output parses as the Claude Code PreToolUse shape', () => {
  const { home } = configuredHome();
  const parsed = JSON.parse(runHook(home, { cwd: '/home/someone/code/acme-api' }));
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(typeof parsed.hookSpecificOutput.additionalContext, 'string');
});

test('the hook is advisory -- it never denies the tool call', () => {
  const { home } = configuredHome();
  const parsed = JSON.parse(runHook(home, { cwd: '/home/someone/code/acme-api' }));
  assert.equal(
    parsed.hookSpecificOutput.permissionDecision,
    undefined,
    'a broken or opinionated hook must never block a plan'
  );
});

test('the guidance contests the in-repo default and points at the skill', () => {
  const { home } = configuredHome();
  const ctx = contextOf(runHook(home, { cwd: '/home/someone/code/acme-api' }));
  assert.match(ctx, /not the repo|in-repo/i, 'names the failure mode it corrects');
  assert.match(ctx, /CLAUDE\.md/, 'defers to the vault CLAUDE.md for real policy');
  assert.match(ctx, /obsidian-vault/, 'points at the skill');
});

test('working inside the vault emits nothing -- there is nothing to redirect', () => {
  const { home, vault } = configuredHome();
  const out = runHook(home, { cwd: path.join(vault, '01-Projects', 'acme') });
  assert.equal(out.trim(), '');
});

test('unconfigured: emits nothing rather than guessing a path', () => {
  assert.equal(runHook(tmpHome(), { cwd: '/home/someone/code/acme' }).trim(), '');
});

test('a vault path that no longer exists emits nothing', () => {
  const home = tmpHome();
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.claude', 'obsidian-vault.json'),
    JSON.stringify({ vaultPath: path.join(home, 'deleted-vault') })
  );
  assert.equal(runHook(home, { cwd: '/home/someone/code/acme' }).trim(), '');
});

test('malformed or absent stdin still exits 0 and does not crash', () => {
  const { home } = configuredHome();
  for (const input of ['', '{ broken', 'null']) {
    const r = spawnSync('node', [HOOK], {
      encoding: 'utf8',
      input,
      env: { ...process.env, HOME: home, OBSIDIAN_VAULT: '' },
    });
    assert.equal(r.status, 0, `exit 0 for stdin=${JSON.stringify(input)}`);
  }
});

test('every config state exits 0', () => {
  const { home: good } = configuredHome();
  const broken = tmpHome();
  fs.mkdirSync(path.join(broken, '.claude'));
  fs.writeFileSync(path.join(broken, '.claude', 'obsidian-vault.json'), 'nope');

  for (const home of [good, broken, tmpHome()]) {
    const r = spawnSync('node', [HOOK], {
      encoding: 'utf8',
      input: JSON.stringify({ cwd: '/home/someone/code/acme' }),
      env: { ...process.env, HOME: home, OBSIDIAN_VAULT: '' },
    });
    assert.equal(r.status, 0, `exit 0 for HOME=${home}`);
  }
});

test('the shim runs plan-mode.js on Unix', () => {
  const shim = path.join(__dirname, '..', 'hooks', 'run-hook.cmd');
  const { home, vault } = configuredHome();
  const out = execFileSync('sh', ['-c', `"${shim}" plan-mode.js`], {
    encoding: 'utf8',
    input: JSON.stringify({ cwd: '/home/someone/code/acme-api' }),
    env: { ...process.env, HOME: home, OBSIDIAN_VAULT: '' },
  });
  assert.ok(contextOf(out).includes(vault));
});
