import type { SessionUser } from '#lib/server/auth.js';
import type { ThemeId } from '#lib/themes.js';

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
			session: { id: string; expiresAt: Date } | null;
			themeOverride?: ThemeId;
		}
		interface PageState {
			pickId?: number;
		}
	}
}

export {};
