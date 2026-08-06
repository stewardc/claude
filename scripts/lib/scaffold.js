'use strict';

const fs = require('fs');
const path = require('path');

const FOLDERS = [
  '00-Inbox',
  '01-Projects',
  '02-Areas',
  '03-Resources',
  '04-Archive',
  'Notes',
  'Daily',
  'Templates',
  'Attachments',
];

const POLICY_SEED = 'vault-CLAUDE.md';
const DEFAULT_TEMPLATE_DIR = path.join(__dirname, 'templates');

/**
 * Bring a vault up to the expected shape. Idempotent and strictly additive:
 * creates only what is absent, and never modifies or deletes existing content.
 * A vault-root CLAUDE.md is user-owned once it exists, so it is only ever
 * written when missing.
 */
function scaffoldVault(vaultPath, { templateDir = DEFAULT_TEMPLATE_DIR } = {}) {
  if (!fs.existsSync(vaultPath)) {
    throw new Error(`Vault path does not exist: ${vaultPath}`);
  }

  const created = [];
  const skipped = [];

  for (const folder of FOLDERS) {
    const dir = path.join(vaultPath, folder);
    if (fs.existsSync(dir)) {
      skipped.push(`${folder}/`);
    } else {
      fs.mkdirSync(dir, { recursive: true });
      created.push(`${folder}/`);
    }
  }

  const templates = fs
    .readdirSync(templateDir)
    .filter((name) => name.endsWith('.md') && name !== POLICY_SEED)
    .sort();

  for (const name of templates) {
    const dest = path.join(vaultPath, 'Templates', name);
    if (fs.existsSync(dest)) {
      skipped.push(`Templates/${name}`);
    } else {
      fs.copyFileSync(path.join(templateDir, name), dest);
      created.push(`Templates/${name}`);
    }
  }

  const claudeMd = path.join(vaultPath, 'CLAUDE.md');
  if (fs.existsSync(claudeMd)) {
    skipped.push('CLAUDE.md');
  } else {
    fs.copyFileSync(path.join(templateDir, POLICY_SEED), claudeMd);
    created.push('CLAUDE.md');
  }

  return { created, skipped };
}

module.exports = { scaffoldVault, FOLDERS };
