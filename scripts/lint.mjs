import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const eslintPath = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');

execFileSync(process.execPath, [eslintPath, '.', '--max-warnings=0'], {
  cwd: root,
  stdio: 'inherit'
});
