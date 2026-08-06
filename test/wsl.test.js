'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isWSL, winToWslPath, detectPlatform } = require('../scripts/lib/wsl');

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
  assert.equal(winToWslPath('C:\\Users\\me\\Vault', { exec }), '/mnt/c/Users/me/Vault');
});

test('winToWslPath fallback handles a non-C drive and lowercases the letter', () => {
  const exec = () => { throw new Error('ENOENT'); };
  assert.equal(winToWslPath('D:\\Notes\\Vault', { exec }), '/mnt/d/Notes/Vault');
});

test('winToWslPath fallback preserves spaces in paths', () => {
  const exec = () => { throw new Error('ENOENT'); };
  assert.equal(
    winToWslPath('C:\\Users\\Chris Steward\\My Vault', { exec }),
    '/mnt/c/Users/Chris Steward/My Vault'
  );
});

test('winToWslPath fallback accepts a forward-slash separator', () => {
  const exec = () => { throw new Error('ENOENT'); };
  assert.equal(winToWslPath('C:/Users/me/Vault', { exec }), '/mnt/c/Users/me/Vault');
});

test('winToWslPath returns null for input that is not a Windows path', () => {
  const exec = () => { throw new Error('ENOENT'); };
  assert.equal(winToWslPath('/home/me/Vault', { exec }), null);
  assert.equal(winToWslPath('', { exec }), null);
  assert.equal(winToWslPath(null, { exec }), null);
});

test('winToWslPath ignores empty wslpath output and falls back', () => {
  const exec = () => '   \n';
  assert.equal(winToWslPath('C:\\Vault', { exec }), '/mnt/c/Vault');
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
