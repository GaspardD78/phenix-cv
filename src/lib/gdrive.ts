/**
 * Synchronisation Google Drive — OAuth2 PKCE + API REST Drive.
 *
 * Les identifiants OAuth ne sont jamais embarqués : voir `gdrive-config.ts`
 * (fournis au build par `.env`, ou saisis dans les options avancées).
 *
 * Portée demandée : drive.file — seulement les fichiers créés par l'application.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
import { getSetting, setSetting } from '@/lib/db';
import { resolveCredentials, CUSTOM_CLIENT_ID_KEY, CUSTOM_CLIENT_SECRET_KEY, type OAuthCredentials } from '@/lib/gdrive-config';

// ── Constants ─────────────────────────────────────────────────────────────────

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'Phénix CV Sauvegardes';

/** Identifiants disponibles (build ou saisie manuelle), ou null si la synchronisation n'est pas configurée. */
export async function getOAuthCredentials(): Promise<OAuthCredentials | null> {
  return resolveCredentials(
    { clientId: import.meta.env.VITE_GDRIVE_CLIENT_ID, clientSecret: import.meta.env.VITE_GDRIVE_CLIENT_SECRET },
    { clientId: await getSetting(CUSTOM_CLIENT_ID_KEY), clientSecret: await getSetting(CUSTOM_CLIENT_SECRET_KEY) },
  );
}

export async function isDriveConfigured(): Promise<boolean> {
  return (await getOAuthCredentials()) !== null;
}

async function requireCredentials(): Promise<OAuthCredentials> {
  const creds = await getOAuthCredentials();
  if (!creds) throw new Error("La synchronisation Google Drive n'est pas activée dans cette version.");
  return creds;
}

/** Champs `client_id` (+ `client_secret` s'il existe) d'une requête OAuth. */
function clientParams(c: OAuthCredentials): Record<string, string> {
  return c.clientSecret ? { client_id: c.clientId, client_secret: c.clientSecret } : { client_id: c.clientId };
}

// ── PKCE helpers ─────────────────────────────────────────────────────────────

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

async function sha256Base64Url(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── Token storage (SQLite settings) ──────────────────────────────────────────

export interface GDriveTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

export async function loadTokens(profileId?: string | null): Promise<GDriveTokens | null> {
  try {
    const key = profileId ? `gdrive_tokens_${profileId}` : 'gdrive_tokens';
    const raw = await getSetting(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GDriveTokens;
    // Validate shape
    if (!parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function persistTokens(tokens: GDriveTokens, profileId?: string | null): Promise<void> {
  const key = profileId ? `gdrive_tokens_${profileId}` : 'gdrive_tokens';
  await setSetting(key, JSON.stringify(tokens));
}

export async function clearTokens(profileId?: string | null): Promise<void> {
  const key = profileId ? `gdrive_tokens_${profileId}` : 'gdrive_tokens';
  await setSetting(key, '');
}

export async function isConnected(profileId?: string | null): Promise<boolean> {
  const t = await loadTokens(profileId);
  return t !== null;
}

// ── État OAuth (variables de module) ──────────────────────────────────────────

let _oauthVerifier = '';
let _oauthState = '';
let _oauthRedirectUri = '';

// ── OAuth2 flow ───────────────────────────────────────────────────────────────

/**
 * Kick off the OAuth2 PKCE flow.
 * - Desktop: starts a local HTTP server (Tauri command), uses loopback redirect.
 * - Redirection : serveur local sur la boucle locale.
 */
export async function startOAuthFlow(): Promise<void> {
  const creds = await requireCredentials();
  const verifier = randomString(64);
  const challenge = await sha256Base64Url(verifier);
  const state = randomString(16);

  _oauthVerifier = verifier;
  _oauthState = state;

  // Serveur local de rappel (boucle locale) ; Google autorise tous les ports.
  const port = await invoke<number>('start_oauth_server');
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  _oauthRedirectUri = redirectUri;

  const params = new URLSearchParams({
    ...clientParams(creds),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  await openUrl(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

/**
 * Wait for the OAuth2 callback event emitted by the local server (desktop)
 * 
 * Resolves with the auth code, or null on timeout / state mismatch.
 */
export function waitForOAuthCallback(timeoutMs = 120_000): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    let unlisten: (() => void) | null = null;

    const settle = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (unlisten) unlisten();
      resolve(value);
    };

    const timer = setTimeout(() => settle(null), timeoutMs);

    listen<string>('oauth://callback', (event) => {
      const payload = event.payload;
      // payload from desktop: "/callback?code=X&state=Y"
      // payload from mobile:  "?code=X&state=Y"
      const qs = payload.includes('?') ? payload.substring(payload.indexOf('?')) : payload;
      const params = new URLSearchParams(qs);

      if (params.get('state') !== _oauthState) {
        settle(null);
        return;
      }
      settle(params.get('code'));
    }).then(fn => {
      unlisten = fn;
      if (settled) fn(); // already settled before listen resolved
    });
  });
}

/** Exchange the auth code for tokens and persist them. */
export async function exchangeCode(code: string, profileId?: string | null): Promise<void> {
  const creds = await requireCredentials();
  const verifier = _oauthVerifier;
  const redirectUri = _oauthRedirectUri;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...clientParams(creds),
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!resp.ok) throw new Error(`Échange de token échoué : ${await resp.text()}`);

  const data = await resp.json();
  await persistTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? '',
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }, profileId);

  _oauthVerifier = '';
  _oauthState = '';
  _oauthRedirectUri = '';
}

async function refreshAccessToken(tokens: GDriveTokens, profileId?: string | null): Promise<GDriveTokens> {
  const creds = await requireCredentials();
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...clientParams(creds),
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!resp.ok) {
    await clearTokens(profileId);
    throw new Error('Session expirée — veuillez reconnecter Google Drive.');
  }

  const data = await resp.json();
  const updated: GDriveTokens = {
    ...tokens,
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  await persistTokens(updated, profileId);
  return updated;
}

async function getValidToken(profileId?: string | null): Promise<string> {
  const tokens = await loadTokens(profileId);
  if (!tokens) throw new Error('Non connecté à Google Drive.');
  if (Date.now() >= tokens.expiresAt) {
    const refreshed = await refreshAccessToken(tokens, profileId);
    return refreshed.accessToken;
  }
  return tokens.accessToken;
}

// ── Drive folder helper ───────────────────────────────────────────────────────

async function getOrCreateFolder(token: string): Promise<string> {
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const listResp = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const { files } = await listResp.json();
  if (files?.length) return files[0].id as string;

  const createResp = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const folder = await createResp.json();
  return folder.id as string;
}

// ── Public Drive API ──────────────────────────────────────────────────────────

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size: string;
}

export async function listDriveBackups(profileId?: string | null): Promise<DriveFile[]> {
  const token = await getValidToken(profileId);
  const folderId = await getOrCreateFolder(token);
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime+desc`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await resp.json();
  return (data.files ?? []) as DriveFile[];
}

export async function uploadToDrive(
  jsonContent: string,
  fileName: string,
  profileId?: string | null,
): Promise<void> {
  const token = await getValidToken(profileId);
  const folderId = await getOrCreateFolder(token);

  const boundary = '-------PhenixCV314159';
  const meta = JSON.stringify({ name: fileName, parents: [folderId] });
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    meta,
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    jsonContent,
    `--${boundary}--`,
  ].join('\r\n');

  const resp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body,
    }
  );
  if (!resp.ok) throw new Error(`Échec de l'envoi : ${await resp.text()}`);
}

export async function downloadFromDrive(fileId: string, profileId?: string | null): Promise<string> {
  const token = await getValidToken(profileId);
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) throw new Error(`Échec du téléchargement : ${resp.status}`);
  return resp.text();
}

