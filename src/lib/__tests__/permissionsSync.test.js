import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DEFAULT_PERMISSIONS } from '../modulePerms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * guardedEntityWrite/entry.ts (a Deno function) can't import from src/, so it
 * carries a hand-copied `DEFAULT_PERMISSIONS` object that has to be kept in
 * sync with src/lib/modulePerms.js's copy by hand — nothing enforced that
 * until now (acacia-app-standard Module 3 audit, 2026-08-26). This test reads
 * the Deno file's own source text, extracts its `DEFAULT_PERMISSIONS` object
 * literal, and asserts it deep-equals the client copy — a future edit to one
 * copy without the other now fails `npm test` instead of shipping silent
 * drift (a dispatcher/mechanic/driver default that differs between what the
 * UI shows and what the server actually enforces).
 */

function extractDefaultPermissions(source) {
  const marker = 'const DEFAULT_PERMISSIONS';
  const markerIdx = source.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error('DEFAULT_PERMISSIONS declaration not found in guardedEntityWrite/entry.ts');
  }
  const eqIdx = source.indexOf('=', markerIdx);
  const braceStart = source.indexOf('{', eqIdx);
  if (braceStart === -1) throw new Error('Could not locate opening brace of DEFAULT_PERMISSIONS');

  // Balanced-brace scan rather than a regex to a literal '};' — robust to
  // reordering/reformatting as long as the object stays well-formed.
  let depth = 0;
  let i = braceStart;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  const objectSource = source.slice(braceStart, i);

  // Safe here: this is the repo's own trusted source file (guardedEntityWrite/entry.ts),
  // not external input. `Function` (not `eval`) keeps it out of the local scope.
  // eslint-disable-next-line no-new-func
  return new Function(`return (${objectSource});`)();
}

describe('DEFAULT_PERMISSIONS stays in sync between client and server copies', () => {
  it('guardedEntityWrite/entry.ts matches src/lib/modulePerms.js exactly', () => {
    const entryPath = path.resolve(__dirname, '../../../base44/functions/guardedEntityWrite/entry.ts');
    const source = readFileSync(entryPath, 'utf8');
    const serverCopy = extractDefaultPermissions(source);
    expect(serverCopy).toEqual(DEFAULT_PERMISSIONS);
  });
});
