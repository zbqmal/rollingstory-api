import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { extractCookieForRequest } from './cookie.helper';

interface RegisterPayload {
  email: string;
  username: string;
  password: string;
}

interface AuthResult {
  userId: string;
  accessTokenCookie: string; // "access_token=<jwt>" — ready for .set('Cookie', ...)
  refreshTokenCookie: string; // "refresh_token=<value>" — ready for .set('Cookie', ...)
  allCookies: string; // both cookies joined for .set('Cookie', ...)
}

/**
 * Registers a user and returns parsed cookie values.
 * Throws if registration fails.
 */
export async function registerUser(
  app: INestApplication,
  payload: RegisterPayload,
): Promise<AuthResult> {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send(payload);

  if (res.status !== 201) {
    throw new Error(
      `Registration failed with status ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }

  const setCookieHeader = res.headers['set-cookie'] as
    | string[]
    | string
    | undefined;
  const accessTokenCookie = extractCookieForRequest(
    setCookieHeader,
    'access_token',
  );
  const refreshTokenCookie = extractCookieForRequest(
    setCookieHeader,
    'refresh_token',
  );

  return {
    userId: res.body.user.id as string,
    accessTokenCookie,
    refreshTokenCookie,
    allCookies: `${accessTokenCookie}; ${refreshTokenCookie}`,
  };
}

/**
 * Logs in a user (by email or username) and returns parsed cookie values.
 * Throws if login fails.
 */
export async function loginUser(
  app: INestApplication,
  emailOrUsername: string,
  password: string,
): Promise<AuthResult> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ emailOrUsername, password });

  if (res.status !== 201) {
    throw new Error(
      `Login failed with status ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }

  const setCookieHeader = res.headers['set-cookie'] as
    | string[]
    | string
    | undefined;
  const accessTokenCookie = extractCookieForRequest(
    setCookieHeader,
    'access_token',
  );
  const refreshTokenCookie = extractCookieForRequest(
    setCookieHeader,
    'refresh_token',
  );

  return {
    userId: res.body.user.id as string,
    accessTokenCookie,
    refreshTokenCookie,
    allCookies: `${accessTokenCookie}; ${refreshTokenCookie}`,
  };
}

/**
 * Default test user credentials — use across all e2e specs for consistency.
 */
export const TEST_USER = {
  email: 'test@example.com',
  username: 'testuser',
  password: 'password123',
} as const;

export const TEST_USER_2 = {
  email: 'another@example.com',
  username: 'anotheruser',
  password: 'password123',
} as const;
