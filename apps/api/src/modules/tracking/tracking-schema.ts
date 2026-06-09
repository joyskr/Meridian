import { z } from 'zod';

export const listClicksQuerySchema = z.object({
  assignment_id: z.string().trim().min(1).optional(),
  offer_id: z.string().trim().min(1).optional(),
  publisher_id: z.string().trim().min(1).optional(),
  advertiser_id: z.string().trim().min(1).optional()
});
