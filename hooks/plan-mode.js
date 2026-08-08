#!/usr/bin/env node
'use strict';

// PreToolUse hook on ExitPlanMode.
//
// The SessionStart hook tells Claude where the vault is, but it only helps once
// Claude has already decided the vault is the destination. At plan time the
// competing default -- write the plan into the repo under docs/ or plans/ --
// goes uncontested, so plans land in the repo instead of the vault.
//
// This fires at exactly that decision point and names the destination. It is
// advisory: it never denies the tool call. A plan the user explicitly asked to
// be an in-repo document still goes in the repo.
//
// Any failure path emits nothing and exits 0: a broken plugin must never block
// a plan.

const fs = require('fs');
const path = require('path');
const { readConfig } = require(path.join(__dirname, '..', 'scripts', 'lib', 'config.js'));

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

/** The project name a repo maps to: the basename of the working directory. */
function projectName(cwd) {
  if (typeof cwd !== 'string' || !cwd) return null;
  const base = path.basename(path.resolve(cwd));
  return base && base !== path.sep && base !== '.' ? base : null;
}

/** True when cwd is inside the vault -- then there is nothing to redirect. */
function insideVault(cwd, vaultPath) {
  if (typeof cwd !== 'string' || !cwd) return false;
  const rel = path.relative(path.resolve(vaultPath), path.resolve(cwd));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function guidance(vaultPath, project) {
  const dest = project
    ? `${vaultPath}${path.sep}01-Projects${path.sep}${project}${path.sep}`
    : vaultPath;

  return `<obsidian-vault-plan>
This plan is durable knowledge. Its home is the Obsidian vault, not the repo.

Vault: ${vaultPath}
${project ? `Working directory maps to project: ${project}\nLikely destination: ${dest}` : `Likely destination: ${dest}`}

Before or right after presenting this plan:
1. Read the vault's CLAUDE.md -- it is the authority on folder layout and
   overrides the path guessed above.
2. Write the plan as a note there, and link it from the project note's Plans
   section. Check the vault first for an existing note on this topic and update
   it rather than creating a near-duplicate.
3. Mirror the plan's actionable steps into the project note's Tasks section,
   and keep the checkboxes current as the work proceeds.

Write the plan into the repo only if the user asked for an in-repo document
(a committed design doc, an RFC, a README). "We are working in a repo" is not
by itself a reason -- that is the default this note exists to correct.

Use the 'obsidian-vault' skill for the full filing conventions. Be quiet about
it: one line confirming where it landed is enough.
</obsidian-vault-plan>`;
}

function main() {
  const config = readConfig();
  if (!config || !fs.existsSync(config.vaultPath)) return;

  const input = readStdin();
  const cwd = input.cwd || process.cwd();

  // Already working inside the vault: no redirection needed.
  if (insideVault(cwd, config.vaultPath)) return;

  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: guidance(config.vaultPath, projectName(cwd)),
      },
    })}\n`
  );
}

try {
  main();
} catch {
  // Emit nothing rather than risk malformed output.
}
process.exit(0);
