// Every environment variable the app reads, validated once at startup.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { building } from '$app/env';

const env = process.env;
const production = env.NODE_ENV === 'production';

/** True while `vite build` analyses the app: nothing is read, written or validated then. */
export const BUILDING = building;

function fail(message: string): never {
	console.error(`[config] ${message}`);
	throw new Error(message);
}

/** Where the database, backups and generated secrets live. */
export const DATA_DIR = resolve(env.DATA_DIR || './data');
if (!building) {
	// The database, its backups and the secrets hold password hashes and sessions: files the app
	// creates are readable by its own user only.
	process.umask(0o077);
	mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
}

/** Reads a secret from env, or generates one into $DATA_DIR/.<name> on first start. */
function generatedSecret(envName: string, fileName: string): string {
	if (building) return 'x'.repeat(32);
	const fromEnv = env[envName]?.trim();
	if (fromEnv) {
		if (fromEnv.length < 32) fail(`${envName} must be at least 32 characters.`);
		return fromEnv;
	}
	const path = join(DATA_DIR, fileName);
	if (existsSync(path)) {
		const saved = readFileSync(path, 'utf8').trim();
		if (saved.length < 32) fail(`${path} holds a secret shorter than 32 characters.`);
		return saved;
	}
	const secret = randomBytes(32).toString('base64url');
	writeFileSync(path, secret, { mode: 0o600 });
	console.log(`[config] Generated ${envName} and saved it to ${path}`);
	return secret;
}

export const AUTH_SECRET = generatedSecret('BETTER_AUTH_SECRET', '.auth-secret');

/** The public URL people use to reach the app, e.g. https://films.example.com */
export const PUBLIC_URL = (() => {
	const value = env.BETTER_AUTH_URL?.trim() || env.ORIGIN?.trim();
	if (!value) {
		if (production && !building)
			fail('BETTER_AUTH_URL is required in production (the public https URL).');
		return 'http://localhost:5173';
	}
	let origin: string;
	try {
		origin = new URL(value).origin;
	} catch {
		fail(`BETTER_AUTH_URL is not a valid URL: ${value}`);
	}
	if (production && !building && !origin.startsWith('https:')) {
		console.warn(
			'[config] BETTER_AUTH_URL is not https: passwords and sign-in cookies would cross the network unencrypted.'
		);
	}
	return origin;
})();

/**
 * TMDB credentials. Either a v3 API key or a v4 read access token works.
 * Without one the app still runs, but titles get no posters, details or streaming info.
 */
export const TMDB_KEY = env.TMDB_API_KEY?.trim() || '';
export const TMDB_ENABLED = TMDB_KEY.length > 0;
if (!TMDB_ENABLED && !building) {
	console.warn('[config] TMDB_API_KEY is not set: posters, details and streaming info are off.');
}

/** Country for streaming availability and release dates. */
export const REGION = (env.WATCH_REGION?.trim() || 'GB').toUpperCase();
if (!/^[A-Z]{2}$/.test(REGION)) fail('WATCH_REGION must be a two-letter country code, e.g. GB.');

export const IS_PRODUCTION = production;
