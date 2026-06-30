// Exchanges an OAuth `code` (from the redirect callback) for an access
// token. This MUST happen server-side because it requires each provider's
// client secret — never expose these in frontend code.

interface ExchangeParams {
  code: string;
  redirectUri: string;
}

async function exchangeGoogleCode({ code, redirectUri }: ExchangeParams): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) throw new Error('Google code exchange failed');
  const data = await res.json();
  return data.access_token;
}

async function exchangeGitHubCode({ code, redirectUri }: ExchangeParams): Promise<string> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GITHUB_CLIENT_ID!,
      client_secret: process.env.GITHUB_CLIENT_SECRET!,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) throw new Error('GitHub code exchange failed');
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || 'GitHub returned no access_token');
  return data.access_token;
}

async function exchangeDiscordCode({ code, redirectUri }: ExchangeParams): Promise<string> {
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) throw new Error('Discord code exchange failed');
  const data = await res.json();
  return data.access_token;
}

export async function exchangeCodeForAccessToken(
  provider: 'google' | 'github' | 'discord',
  params: ExchangeParams
): Promise<string> {
  switch (provider) {
    case 'google':
      return exchangeGoogleCode(params);
    case 'github':
      return exchangeGitHubCode(params);
    case 'discord':
      return exchangeDiscordCode(params);
  }
}
