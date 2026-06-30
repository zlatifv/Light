import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { verifyOAuthToken, type OAuthProvider } from '../auth/oauthProviders.js';
import { exchangeCodeForAccessToken } from '../auth/oauthExchange.js';
import { issueSessionToken, verifySessionToken } from '../auth/session.js';

const VALID_PROVIDERS: OAuthProvider[] = ['google', 'github', 'discord'];

/** Shared logic: given a verified profile, find-or-create the User and issue a session. */
async function loginWithProfile(provider: string, profile: {
  providerAccountId: string;
  email: string | null;
  displayName: string;
  pfpUrl: string | null;
}) {
  const existingAccount = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    include: { user: true },
  });

  const user = existingAccount
    ? existingAccount.user
    : await prisma.user.create({
        data: {
          displayName: profile.displayName,
          pfpUrl: profile.pfpUrl,
          accounts: {
            create: {
              provider,
              providerAccountId: profile.providerAccountId,
              email: profile.email,
            },
          },
        },
      });

  const sessionToken = issueSessionToken({ userId: user.id, displayName: user.displayName });
  return {
    sessionToken,
    user: { id: user.id, displayName: user.displayName, pfpUrl: user.pfpUrl },
  };
}

export async function registerAuthRoutes(app: FastifyInstance) {
  /**
   * POST /auth/exchange/:provider
   * body: { code: string, redirectUri: string }
   *
   * Used by the WEB app's redirect-based OAuth flow. Exchanges the
   * authorization `code` for an access token server-side (using the
   * client secret), verifies it, and returns our session token.
   */
  app.post<{ Params: { provider: string }; Body: { code: string; redirectUri: string } }>(
    '/auth/exchange/:provider',
    async (request, reply) => {
      const { provider } = request.params;
      const { code, redirectUri } = request.body;

      if (!VALID_PROVIDERS.includes(provider as OAuthProvider)) {
        return reply.code(400).send({ error: `Unsupported provider: ${provider}` });
      }
      if (!code || !redirectUri) {
        return reply.code(400).send({ error: 'code and redirectUri are required' });
      }

      try {
        const accessToken = await exchangeCodeForAccessToken(provider as OAuthProvider, {
          code,
          redirectUri,
        });
        const profile = await verifyOAuthToken(provider as OAuthProvider, accessToken);
        const result = await loginWithProfile(provider, profile);
        return reply.send(result);
      } catch (err) {
        app.log.warn({ err }, 'OAuth code exchange failed');
        return reply.code(401).send({ error: 'OAuth login failed' });
      }
    }
  );

  /**
   * POST /auth/login
   * body: { provider: "google" | "github" | "discord", accessToken: string }
   *
   * Used by the MOBILE app, which obtains an access token directly via
   * expo-auth-session's native browser flow (no client secret needed on
   * mobile for the implicit/PKCE flow Expo uses) and sends it straight here.
   */
  app.post<{ Body: { provider: string; accessToken: string } }>('/auth/login', async (request, reply) => {
    const { provider, accessToken } = request.body;

    if (!VALID_PROVIDERS.includes(provider as OAuthProvider)) {
      return reply.code(400).send({ error: `Unsupported provider: ${provider}` });
    }
    if (!accessToken) {
      return reply.code(400).send({ error: 'accessToken is required' });
    }

    try {
      const profile = await verifyOAuthToken(provider as OAuthProvider, accessToken);
      const result = await loginWithProfile(provider, profile);
      return reply.send(result);
    } catch (err) {
      app.log.warn({ err }, 'OAuth token verification failed');
      return reply.code(401).send({ error: 'Invalid or expired OAuth token' });
    }
  });

  /**
   * GET /auth/me
   * header: Authorization: Bearer <sessionToken>
   *
   * Lets the client verify a stored session token is still valid and fetch
   * the current user's profile — used on app startup before showing the
   * "sign in" screen, so returning users skip straight past it.
   */
  app.get('/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return reply.code(401).send({ error: 'Missing Authorization header' });
    }

    try {
      const payload = verifySessionToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });

      if (!user) {
        return reply.code(401).send({ error: 'User no longer exists' });
      }

      return reply.send({ user: { id: user.id, displayName: user.displayName, pfpUrl: user.pfpUrl } });
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired session token' });
    }
  });

  /**
   * POST /auth/device-token
   * header: Authorization: Bearer <sessionToken>
   * body: { token: string, platform: "android" | "ios" | "web" }
   *
   * Registers/updates an FCM device token for the authenticated user.
   * Replaces the in-memory fcmTokens Map in the signaling server — this
   * persists across restarts/deploys.
   */
  app.post<{ Body: { token: string; platform: string } }>(
    '/auth/device-token',
    async (request, reply) => {
      const authHeader = request.headers.authorization;
      const sessionToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!sessionToken) {
        return reply.code(401).send({ error: 'Missing Authorization header' });
      }

      let payload;
      try {
        payload = verifySessionToken(sessionToken);
      } catch {
        return reply.code(401).send({ error: 'Invalid or expired session token' });
      }

      const { token, platform } = request.body;
      if (!token || !platform) {
        return reply.code(400).send({ error: 'token and platform are required' });
      }

      await prisma.deviceToken.upsert({
        where: { token },
        create: { token, platform, userId: payload.userId },
        update: { userId: payload.userId, platform },
      });

      return reply.send({ ok: true });
    }
  );
}
