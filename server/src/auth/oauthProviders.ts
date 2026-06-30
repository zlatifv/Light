// These functions verify an OAuth access token (sent up by the client after
// it completes the provider's login flow) and return basic profile info.
// The actual "redirect user to Google's login page" flow happens on the
// CLIENT (web/mobile) using each provider's SDK — the server's job is only
// to verify the resulting token and look up/create our own User record.
//
// This split (client does the OAuth dance, server just verifies the token)
// is the standard pattern for SPAs + mobile apps, and avoids needing
// server-side session/redirect handling for three different providers.

interface OAuthProfile {
  providerAccountId: string;
  email: string | null;
  displayName: string;
  pfpUrl: string | null;
}

export async function verifyGoogleToken(accessToken: string): Promise<OAuthProfile> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error('Invalid Google access token');
  const data = await res.json();

  return {
    providerAccountId: data.sub,
    email: data.email ?? null,
    displayName: data.name ?? data.email ?? 'Google User',
    pfpUrl: data.picture ?? null,
  };
}

export async function verifyGitHubToken(accessToken: string): Promise<OAuthProfile> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'light-app',
    },
  });

  if (!res.ok) throw new Error('Invalid GitHub access token');
  const data = await res.json();

  return {
    providerAccountId: String(data.id),
    email: data.email ?? null,
    displayName: data.name ?? data.login ?? 'GitHub User',
    pfpUrl: data.avatar_url ?? null,
  };
}

export async function verifyDiscordToken(accessToken: string): Promise<OAuthProfile> {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error('Invalid Discord access token');
  const data = await res.json();

  const pfpUrl = data.avatar
    ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
    : null;

  return {
    providerAccountId: data.id,
    email: data.email ?? null,
    displayName: data.global_name ?? data.username ?? 'Discord User',
    pfpUrl,
  };
}

export type OAuthProvider = 'google' | 'github' | 'discord';

export async function verifyOAuthToken(
  provider: OAuthProvider,
  accessToken: string
): Promise<OAuthProfile> {
  switch (provider) {
    case 'google':
      return verifyGoogleToken(accessToken);
    case 'github':
      return verifyGitHubToken(accessToken);
    case 'discord':
      return verifyDiscordToken(accessToken);
  }
}
