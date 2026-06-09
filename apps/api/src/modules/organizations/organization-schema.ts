import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

export const selectActiveOrganizationSchema = z.object({
  organization_id: z.string().trim().min(1)
});
