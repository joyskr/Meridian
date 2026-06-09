import { z } from 'zod';

export const listPayoutBatchesQuerySchema = z.object({
  status: z.enum(['draft', 'approved', 'exported', 'reconciled', 'all']).default('all')
});

export const listPayoutsQuerySchema = z.object({
  batch_id: z.string().trim().min(1).optional()
});
