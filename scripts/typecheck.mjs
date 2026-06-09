import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const tscPath = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const projects = [
  'apps/api/tsconfig.json',
  'apps/web/tsconfig.json',
  'apps/worker/tsconfig.json',
  'packages/contracts/tsconfig.json'
];

for (const project of projects) {
  execFileSync(process.execPath, [tscPath, '--noEmit', '-p', project], {
    cwd: root,
    stdio: 'inherit'
  });
}
