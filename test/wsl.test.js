'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isWSL, winToWslPath, detectPlatform, automountRoot } = require('../scripts/lib/wsl');

const throwsENOENT = () => { throw new Error('ENOENT'); };

test('isWSL is true when WSL_DISTRO_NAME is set', () => {
  assert.equal(isWSL({ env: { WSL_DISTRO_NAME: 'Ubuntu' }, readFile: throwsENOENT }), true);
});

test('isWSL is true when /proc/version mentions Microsoft in any case', () => {
  assert.equal(isWSL({ env: {}, readFile: () => 'Linux version 5.15 (Microsoft@Microsoft)' }), true);
  assert.equal(isWSL({ env: {}, readFile: () => 'linux version 5.15 microsoft-standard-WSL2' }), true);
});

test('isWSL is false on ordinary Linux', () => {
  assert.equal(isWSL({ env: {}, readFile: () => 'Linux version 6.1.0 (gcc 12)' }), false);
});

test('isWSL is false when /proc/version is unreadable', () => {
  assert.equal(isWSL({ env: {}, readFile: throwsENOENT }), false);
});

test('winToWslPath prefers wslpath output', () => {
  const exec = (cmd, args) => {
    assert.equal(cmd, 'wslpath');
    assert.deepEqual(args, ['-u', 'C:\\Users\\me\\Vault']);
    return '/mnt/c/Users/me/Vault\n';
  };
  assert.equal(winToWslPath('C:\\Users\\me\\Vault', { exec }), '/mnt/c/Users/me/Vault');
});

test('winToWslPath falls back to regex when wslpath is absent', () => {
  const exec = () => { throw new Error('spawn wslpath ENOENT'); };
  assert.equal(winToWslPath('C:\\Users\\me\\Vault', { exec, mntRoot: '/mnt' }), '/mnt/c/Users/me/Vault');
});

test('winToWslPath fallback handles a non-C drive and lowercases the letter', () => {
  const exec = () => { throw new Error('ENOENT'); };
  assert.equal(winToWslPath('D:\\Notes\\Vault', { exec, mntRoot: '/mnt' }), '/mnt/d/Notes/Vault');
});

test('winToWslPath fallback preserves spaces in paths', () => {
  const exec = () => { throw new Error('ENOENT'); };
  assert.equal(
    winToWslPath('C:\\Users\\Chris Steward\\My Vault', { exec, mntRoot: '/mnt' }),
    '/mnt/c/Users/Chris Steward/My Vault'
  );
});

test('winToWslPath fallback accepts a forward-slash separator', () => {
  const exec = () => { throw new Error('ENOENT'); };
  assert.equal(winToWslPath('C:/Users/me/Vault', { exec, mntRoot: '/mnt' }), '/mnt/c/Users/me/Vault');
});

test('winToWslPath returns null for input that is not a Windows path', () => {
  const exec = () => { throw new Error('ENOENT'); };
  assert.equal(winToWslPath('/home/me/Vault', { exec }), null);
  assert.equal(winToWslPath('', { exec }), null);
  assert.equal(winToWslPath(null, { exec }), null);
});

test('winToWslPath ignores empty wslpath output and falls back', () => {
  const exec = () => '   \n';
  assert.equal(winToWslPath('C:\\Vault', { exec, mntRoot: '/mnt' }), '/mnt/c/Vault');
});

test('detectPlatform reports wsl for Linux under WSL, plain linux otherwise', () => {
  assert.equal(detectPlatform({ platform: 'linux', env: { WSL_DISTRO_NAME: 'Ubuntu' }, readFile: throwsENOENT }), 'wsl');
  assert.equal(detectPlatform({ platform: 'linux', env: {}, readFile: throwsENOENT }), 'linux');
});

test('detectPlatform passes through darwin and win32 without touching /proc', () => {
  const boom = () => { throw new Error('should not be read'); };
  assert.equal(detectPlatform({ platform: 'darwin', env: {}, readFile: boom }), 'darwin');
  assert.equal(detectPlatform({ platform: 'win32', env: {}, readFile: boom }), 'win32');
});

// --- automountRoot -----------------------------------------------------------
// WSL mounts Windows drives at /mnt by default, but /etc/wsl.conf can move it.
// Assuming /mnt on such a machine means never finding a Windows-side vault.

const wslConf = (text) => (p) => {
  if (p !== '/etc/wsl.conf') throw new Error(`unexpected read: ${p}`);
  return text;
};

test('automountRoot defaults to /mnt when /etc/wsl.conf is absent', () => {
  assert.equal(automountRoot({ env: {}, readFile: throwsENOENT }), '/mnt');
});

test('automountRoot honours [automount] root in /etc/wsl.conf', () => {
  const readFile = wslConf('[automount]\nroot = /windows/\noptions = "metadata"\n');
  assert.equal(automountRoot({ env: {}, readFile }), '/windows');
});

test('automountRoot strips quotes and trailing slashes from the value', () => {
  assert.equal(automountRoot({ env: {}, readFile: wslConf('[automount]\nroot = "/w/"\n') }), '/w');
  assert.equal(automountRoot({ env: {}, readFile: wslConf('[automount]\nroot=/w///\n') }), '/w');
});

test('automountRoot ignores a root key outside the [automount] section', () => {
  const readFile = wslConf('[network]\nroot = /nope/\n\n[boot]\nroot = /also-nope\n');
  assert.equal(automountRoot({ env: {}, readFile }), '/mnt');
});

test('automountRoot ignores comments and blank lines', () => {
  const readFile = wslConf('# a comment\n\n[automount]\n; root = /commented-out\nroot = /w  # trailing\n');
  assert.equal(automountRoot({ env: {}, readFile }), '/w');
});

test('automountRoot falls back to /mnt on a malformed or empty conf', () => {
  for (const text of ['', 'garbage', '[automount]\n', '[automount]\nroot =\n']) {
    assert.equal(automountRoot({ env: {}, readFile: wslConf(text) }), '/mnt', `text=${JSON.stringify(text)}`);
  }
});

test('OBSIDIAN_VAULT_MNT_ROOT overrides /etc/wsl.conf', () => {
  const boom = () => { throw new Error('should not be read'); };
  assert.equal(automountRoot({ env: { OBSIDIAN_VAULT_MNT_ROOT: '/custom/' }, readFile: boom }), '/custom');
});

test('automountRoot never returns an empty string for a bare slash', () => {
  assert.equal(automountRoot({ env: { OBSIDIAN_VAULT_MNT_ROOT: '/' }, readFile: throwsENOENT }), '/');
});

test('the wslpath-less fallback honours a custom mount root', () => {
  const noWslpath = () => { throw new Error('ENOENT: wslpath'); };
  assert.equal(
    winToWslPath('D:\\Obsidian\\Claude', { exec: noWslpath, mntRoot: '/windows' }),
    '/windows/d/Obsidian/Claude'
  );
  assert.equal(
    winToWslPath('D:\\Vault', { exec: noWslpath, env: { OBSIDIAN_VAULT_MNT_ROOT: '/w' } }),
    '/w/d/Vault'
  );
  // A bare-slash root must not produce a doubled separator.
  assert.equal(
    winToWslPath('C:\\Vault', { exec: noWslpath, mntRoot: '/' }),
    '/c/Vault'
  );
});
