import request from 'supertest';
import { createMembershipSeed, findUserByEmail } from './auth-test-context.mjs';

export async function createVerifiedUser(context, email, password = 'Password123!') {
  const signUpResponse = await request(context.app).post('/auth/signup').send({
    email,
    password
  });

  const verificationToken = signUpResponse.headers['x-debug-auth-token'];

  await request(context.app).post('/auth/verify-email').send({
    token: verificationToken
  });

  const user = await findUserByEmail(context.pool, email);

  return {
    email,
    password,
    userId: user.id
  };
}

export async function loginAgent(context, email, password = 'Password123!') {
  const agent = request.agent(context.app);
  const loginResponse = await agent.post('/auth/login').send({
    email,
    password
  });

  return {
    agent,
    loginResponse
  };
}

export async function createOrganization(agent, name) {
  const response = await agent.post('/organizations').send({
    name
  });

  return response.body;
}

export async function addOrganizationMember(
  context,
  {
    organizationId,
    email,
    role,
    status = 'active',
    managerMembershipId = null,
    password = 'Password123!'
  }
) {
  const user = await createVerifiedUser(context, email, password);
  const membershipId = await createMembershipSeed(context.pool, {
    organizationId,
    userId: user.userId,
    role,
    status,
    managerMembershipId
  });

  return {
    ...user,
    membershipId
  };
}
