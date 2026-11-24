// The first account needs no invite, so until it exists anyone who finds the site could claim
// it. A one-time setup code, printed to the server log, closes that window.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import { BUILDING, DATA_DIR } from './config';
import { userCount } from './lists';

const PATH = join(DATA_DIR, '.setup-code');

function readOrCreate(): string {
	if (existsSync(PATH)) {
		const existing = readFileSync(PATH, 'utf8').trim();
		if (existing.length >= 12) return existing;
	}
	const code = randomBytes(9).toString('base64url');
	writeFileSync(PATH, code, { mode: 0o600 });
	return code;
}

/** Logs the setup code while there are no accounts yet. Called once at startup. */
export function announceSetupCode() {
	if (BUILDING || userCount() > 0) return;
	console.log(
		`[setup] No accounts yet. To create the first one, open /signup and enter setup code: ${readOrCreate()}`
	);
}

export function checkSetupCode(given: string): boolean {
	const expected = Buffer.from(readOrCreate());
	const actual = Buffer.from(given.trim());
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function clearSetupCode() {
	rmSync(PATH, { force: true });
}
