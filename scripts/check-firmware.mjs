// Type-check each board's MakeCode firmware against MakeCode's own declarations (see firmware-check/).
// Catches errors like "Operator '==' cannot be applied to types '0' and '1'" before MakeCode does.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const posix = (p) => p.split(sep).join('/');
const root = resolve(import.meta.dirname, '..');
const decl = join(root, 'firmware-check', 'makecode');
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
let failed = false;

for (const board of ['stembot_fw_boardA.ts', 'stembot_fw_boardB.ts']) {
  // Each board is a global script, so check them one at a time (they share names).
  const dir = mkdtempSync(join(tmpdir(), 'fwcheck-'));
  copyFileSync(join(root, board), join(dir, board));
  const files = readdirSync(decl).map((f) => posix(join(decl, f)));
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      extends: posix(join(root, 'firmware-check', 'tsconfig.json')),
      include: [],
      files: [...files, board],
    }),
  );
  try {
    execFileSync(process.execPath, [tsc, '-p', join(dir, 'tsconfig.json')], { stdio: 'pipe' });
    console.log(`${board}: OK`);
  } catch (e) {
    failed = true;
    const out = `${e.stdout?.toString() ?? ''}${e.stderr?.toString() ?? ''}`;
    console.error(`${board}: type errors`);
    console.error(
      out
        .split(posix(dir) + '/')
        .join('')
        .split(dir + sep)
        .join(''),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
process.exit(failed ? 1 : 0);
