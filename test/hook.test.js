'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const HOOK = path.join(__dirname, '..', 'hooks', 'session-start.js');
const tmpHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'obshook-'));

/** Run the hook with a given HOME. Returns { stdout, status }. */
function runHook(home) {
  const stdout = execFileSync('node', [HOOK], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, OBSIDIAN_VAULT: '' },
  });
  return stdout;
}

function contextOf(stdout) {
  return JSON.parse(stdout).hookSpecificOutput.additionalContext;
}

test('configured: emits the vault path, a capture instruction, and a skill pointer', () => {
  const home = tmpHome();
  const vault = path.join(home, 'Documents', 'Claude');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.mkdirSync(vault, { recursive: true });
  fs.writeFileSync(
    path.join(home, '.claude', 'obsidian-vault.json'),
    JSON.stringify({ vaultPath: vault, platform: 'darwin', configuredOn: '2026-08-05' })
  );

  const ctx = contextOf(runHook(home));
  assert.ok(ctx.includes(vault), 'context names the vault path');
  assert.match(ctx, /proactiv/i, 'context instructs proactive capture');
  assert.match(ctx, /decisions/i);
  assert.match(ctx, /obsidian-vault/, 'context points at the skill');
});

test('configured: output parses as the Claude Code SessionStart shape', () => {
  const home = tmpHome();
  const vault = path.join(home, 'Vault');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.mkdirSync(vault);
  fs.writeFileSync(
    path.join(home, '.claude', 'obsidian-vault.json'),
    JSON.stringify({ vaultPath: vault })
  );

  const parsed = JSON.parse(runHook(home));
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(typeof parsed.hookSpecificOutput.additionalContext, 'string');
});

test('unconfigured: nudges the user to run /vault-setup', () => {
  const ctx = contextOf(runHook(tmpHome()));
  assert.match(ctx, /\/vault-setup/);
});

test('unreadable config: still exits 0 and nudges rather than crashing', () => {
  const home = tmpHome();
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'obsidian-vault.json'), '{ broken');
  const ctx = contextOf(runHook(home));
  assert.match(ctx, /\/vault-setup/);
});

test('a vault path that no longer exists is treated as unconfigured', () => {
  const home = tmpHome();
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.claude', 'obsidian-vault.json'),
    JSON.stringify({ vaultPath: path.join(home, 'deleted-vault') })
  );
  const ctx = contextOf(runHook(home));
  assert.match(ctx, /\/vault-setup/);
});

test('every config state exits 0', () => {
  const good = tmpHome();
  fs.mkdirSync(path.join(good, '.claude'));
  fs.mkdirSync(path.join(good, 'V'));
  fs.writeFileSync(
    path.join(good, '.claude', 'obsidian-vault.json'),
    JSON.stringify({ vaultPath: path.join(good, 'V') })
  );
  const broken = tmpHome();
  fs.mkdirSync(path.join(broken, '.claude'));
  fs.writeFileSync(path.join(broken, '.claude', 'obsidian-vault.json'), 'nope');

  for (const home of [good, broken, tmpHome()]) {
    const r = require('child_process').spawnSync('node', [HOOK], {
      encoding: 'utf8',
      env: { ...process.env, HOME: home, OBSIDIAN_VAULT: '' },
    });
    assert.equal(r.status, 0, `exit 0 for HOME=${home}`);
  }
});

test('hooks.json registers SessionStart for every session entry point via the shim', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'hooks', 'hooks.json'), 'utf8'));
  const entry = hooks.hooks.SessionStart[0];
  // `resume` matters as much as `startup`: without it, every `claude --resume`
  // and `claude -c` session runs with no vault context at all.
  for (const source of ['startup', 'resume', 'clear', 'compact']) {
    assert.ok(entry.matcher.split('|').includes(source), `matcher covers ${source}`);
  }
  assert.match(entry.hooks[0].command, /run-hook\.cmd/);
  assert.match(entry.hooks[0].command, /session-start\.js/);
  assert.match(entry.hooks[0].command, /CLAUDE_PLUGIN_ROOT/);
});

test('hooks.json registers the plan-mode hook on ExitPlanMode via the shim', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'hooks', 'hooks.json'), 'utf8'));
  const entry = hooks.hooks.PreToolUse[0];
  assert.equal(entry.matcher, 'ExitPlanMode');
  assert.match(entry.hooks[0].command, /run-hook\.cmd/);
  assert.match(entry.hooks[0].command, /plan-mode\.js/);
  assert.match(entry.hooks[0].command, /CLAUDE_PLUGIN_ROOT/);
});

test('the shim is executable and runs the named script on Unix', () => {
  const shim = path.join(__dirname, '..', 'hooks', 'run-hook.cmd');
  // The exec bit matters: Claude Code runs the hook command through a shell,
  // and a non-executable file fails there with EACCES before the ENOEXEC
  // fallback below can happen.
  assert.ok(fs.statSync(shim).mode & 0o111, 'run-hook.cmd must be executable');

  // Invoked via a shell, not execFileSync directly. The shim is a polyglot with
  // no shebang -- byte 0 must be `:` so cmd.exe's heredoc swallows the batch
  // block -- so a bare execve() returns ENOEXEC. A POSIX shell handles that by
  // rerunning the file with sh, which is exactly how Claude Code invokes it.
  const home = tmpHome();
  const out = execFileSync('sh', ['-c', `"${shim}" session-start.js`], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, OBSIDIAN_VAULT: '' },
  });
  assert.match(contextOf(out), /\/vault-setup/);
});
