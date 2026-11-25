// Shapes shared between server modules and components.

export type MediaType = 'movie' | 'tv';
export type MatchStatus = 'pending' | 'matched' | 'guess' | 'none';

export interface Provider {
	id: number;
	name: string;
	logo: string | null;
}

export interface Providers {
	link: string | null;
	stream: Provider[];
	free: Provider[];
	rent: Provider[];
	buy: Provider[];
}

export interface Title {
	mediaType: MediaType;
	tmdbId: number;
	title: string;
	originalTitle: string | null;
	releaseDate: string | null;
	status: string | null;
	runtime: number | null;
	seasons: number | null;
	genres: string[];
	overview: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	providers: Providers | null;
}

export interface DiaryEntry {
	id: number;
	itemId: number;
	userId: string;
	userName: string;
	watchedOn: string | null;
	rating: number | null;
	review: string | null;
	createdAt: string;
}

export interface Item {
	id: number;
	listId: number;
	/** What was typed or imported, tidied. */
	title: string;
	/** TMDB's title when matched, otherwise the typed one. */
	displayTitle: string;
	mediaType: MediaType | null;
	tmdbId: number | null;
	matchStatus: MatchStatus;
	kindHint: MediaType | null;
	yearHint: number | null;
	mentions: number;
	recommendedBy: string | null;
	note: string | null;
	releaseOverride: string | null;
	/** The release date to use: the override, else TMDB’s. */
	releaseDate: string | null;
	comingSoon: boolean;
	status: 'want' | 'watched';
	watchedAt: string | null;
	addedBy: string | null;
	addedByName: string | null;
	createdAt: string;
	details: Title | null;
	diary: DiaryEntry[];
}

export interface ListSummary {
	id: number;
	name: string;
	role: 'owner' | 'editor';
	ownerName: string;
	wantCount: number;
}

export interface TmdbSearchResult {
	mediaType: MediaType;
	tmdbId: number;
	title: string;
	year: number | null;
	posterPath: string | null;
	overview: string | null;
}

export interface MagnetResult {
	name: string;
	magnet: string;
	sizeBytes: number | null;
	seeders: number;
	source: string;
}
