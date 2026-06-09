import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const targetDirectory = process.argv[2];

if (!targetDirectory) {
  throw new Error('A test directory is required.');
}

const root = process.cwd();
const absoluteTarget = path.join(root, targetDirectory);

function collectTests(directory) {
  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const absoluteEntry = path.join(directory, entry);
    const stats = statSync(absoluteEntry);

    if (stats.isDirectory()) {
      files.push(...collectTests(absoluteEntry));
      continue;
    }

    if (absoluteEntry.endsWith('.test.mjs')) {
      files.push(absoluteEntry);
    }
  }

  return files;
}

const tests = collectTests(absoluteTarget);

if (tests.length === 0) {
  console.log(`No tests found in ${targetDirectory}`);
  process.exit(0);
}

for (const testFile of tests) {
  execFileSync(process.execPath, [testFile], {
    cwd: root,
    stdio: 'inherit'
  });
}
