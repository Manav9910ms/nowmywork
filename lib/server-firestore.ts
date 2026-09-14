import { createSign, createVerify } from 'node:crypto';

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

type ServiceToken = { access_token: string; expires_in: number };
let cachedAccessToken: { value: string; expiresAt: number } | null = null;
let cachedCerts: { keys: Record<string, string>; expiresAt: number } | null = null;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString('base64url');
}

function serviceAccountPrivateKey() {
  return requiredEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');
}

function signJwt(payload: Record<string, unknown>) {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64Url(JSON.stringify(payload));
  const unsigned = `${header}.${body}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(serviceAccountPrivateKey()).toString('base64url')}`;
}

async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.value;
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt({
    iss: requiredEnv('FIREBASE_CLIENT_EMAIL'),
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) throw new Error('Could not obtain Firebase server access token.');
  const data = (await response.json()) as ServiceToken;
  cachedAccessToken = { value: data.access_token, expiresAt: Date.now() + Math.max(60, data.expires_in - 60) * 1000 };
  return data.access_token;
}

async function getFirebaseCerts() {
  if (cachedCerts && cachedCerts.expiresAt > Date.now() + 60_000) return cachedCerts.keys;
  const response = await fetch(CERTS_URL);
  if (!response.ok) throw new Error('Could not obtain Firebase token verification certificates.');
  const keys = (await response.json()) as Record<string, string>;
  const cacheControl = response.headers.get('cache-control') ?? '';
  const match = cacheControl.match(/max-age=(\d+)/);
  const maxAgeMs = match ? Number(match[1]) * 1000 : 60 * 60 * 1000;
  cachedCerts = { keys, expiresAt: Date.now() + maxAgeMs };
  return keys;
}

function decodeJwtPart(value: string) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
}

export type VerifiedFirebaseToken = {
  uid: string;
  email?: string;
  phoneNumber?: string;
};

export async function verifyFirebaseIdToken(token: string): Promise<VerifiedFirebaseToken> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid Firebase ID token.');
  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Invalid Firebase ID token.');

  const projectId = requiredEnv('FIREBASE_PROJECT_ID');
  const issuer = `https://securetoken.google.com/${projectId}`;
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId || payload.iss !== issuer || typeof payload.sub !== 'string' || !payload.sub || Number(payload.exp) <= now) {
    throw new Error('Firebase ID token is not valid for this project.');
  }

  const certs = await getFirebaseCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error('Firebase ID token key is unknown.');
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  if (!verifier.verify(cert, Buffer.from(parts[2], 'base64url'))) throw new Error('Firebase ID token signature is invalid.');

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    phoneNumber: typeof payload.phone_number === 'string' ? payload.phone_number : undefined,
  };
}

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

function encodeValue(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item !== undefined) fields[key] = encodeValue(item);
    }
    return { mapValue: { fields } };
  }
  throw new Error(`Unsupported Firestore value: ${typeof value}`);
}

function decodeValue(value: FirestoreValue): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return new Date(value.timestampValue);
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ('mapValue' in value) {
    return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, item]) => [key, decodeValue(item)]));
  }
  return undefined;
}

function documentName(path: string) {
  const projectId = requiredEnv('FIREBASE_PROJECT_ID');
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${FIRESTORE_BASE}/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodedPath}`;
}

export async function getServerDocument<T>(path: string): Promise<{ exists: boolean; data: T | null; updateTime?: string }> {
  const response = await fetch(documentName(path), { headers: { authorization: `Bearer ${await getAccessToken()}` }, cache: 'no-store' });
  if (response.status === 404) return { exists: false, data: null };
  if (!response.ok) throw new Error(`Firestore read failed with ${response.status}.`);
  const document = (await response.json()) as { fields?: Record<string, FirestoreValue>; updateTime?: string };
  const data = Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, decodeValue(value)])) as T;
  return { exists: true, data, updateTime: document.updateTime };
}

export async function setServerDocument(path: string, data: Record<string, unknown>, updateTime?: string) {
  const body: Record<string, unknown> = {
    writes: [{
      update: {
        name: `projects/${requiredEnv('FIREBASE_PROJECT_ID')}/databases/(default)/documents/${path}`,
        fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeValue(value)])),
      },
    }],
  };
  if (updateTime) (body.writes as Array<Record<string, unknown>>)[0].currentDocument = { updateTime };

  const response = await fetch(`${FIRESTORE_BASE}/projects/${encodeURIComponent(requiredEnv('FIREBASE_PROJECT_ID'))}/databases/(default)/documents:commit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await getAccessToken()}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Firestore write failed with ${response.status}.`);
}
