import { z } from 'zod';

const email = z.email().transform((value) => value.trim().toLowerCase());

export const updateMembershipRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'manager', 'analyst', 'viewer'])
});

export const provisionMembershipUserSchema = z.object({
  email,
  role: z.enum(['owner', 'admin', 'manager', 'analyst', 'viewer']),
  manager_membership_id: z.string().min(1).nullable()
});

export const assignMembershipManagerSchema = z.object({
  manager_membership_id: z.string().min(1)
});
