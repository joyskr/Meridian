import { randomBytes } from 'node:crypto';

export function createPublicId(prefix: string) {
  return `${prefix}_${randomBytes(10).toString('hex')}`;
}
