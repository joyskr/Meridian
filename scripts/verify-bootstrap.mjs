import { execSync } from 'node:child_process';

const steps = [
  'node scripts/lint.mjs',
  'node scripts/typecheck.mjs',
  'node scripts/run-tsx-tests.mjs tests/integration',
  'node scripts/run-tsx-tests.mjs tests/contract'
];

for (const step of steps) {
  console.log(`\n==> ${step}`);
  execSync(step, {
    stdio: 'inherit'
  });
}

console.log('\nBuild verification must be run separately with `npm run build`.');
console.log('Bootstrap verification completed.');
