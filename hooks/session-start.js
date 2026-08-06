#!/usr/bin/env node
'use strict';

// SessionStart hook. Reads only the cached config — no registry parse, no
// filesystem scan — so it adds no measurable latency to session start.
// Any failure path emits nothing and exits 0: a broken plugin must never
// break a session.

const fs = require('fs');
const path = require('path');
const { readConfig } = require(path.join(__dirname, '..', 'scripts', 'lib', 'config.js'));

const CONFIGURED = (vaultPath) => `<obsidian-vault>
Obsidian vault: ${vaultPath}
Proactively capture durable knowledge there as it emerges — decisions (with rationale), plans and specs, and todo lists — and keep those notes current, without being asked. Be proportional: durable value yes, transient chatter no.
Use the 'obsidian-vault' skill for filing conventions before writing.
</obsidian-vault>`;

const UNCONFIGURED = `<obsidian-vault>
No Obsidian vault is configured yet. Tell the user to run /vault-setup to set one up (it can also create a vault from scratch).
</obsidian-vault>`;

function main() {
  let context = UNCONFIGURED;

  const config = readConfig();
  if (config && fs.existsSync(config.vaultPath)) {
    context = CONFIGURED(config.vaultPath);
  }

  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: context,
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
