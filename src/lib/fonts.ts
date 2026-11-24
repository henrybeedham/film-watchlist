// The two faces each theme sets most of its text in (Latin subset), so the page can ask for them
// straight away instead of waiting for the stylesheet. Same files the @fontsource CSS points at,
// so the browser fetches each only once.
import fraunces from '@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2?url';
import sourceSerif from '@fontsource-variable/source-serif-4/files/source-serif-4-latin-opsz-normal.woff2?url';
import instrument from '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url';
import schibsted from '@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2?url';
import bigShoulders from '@fontsource-variable/big-shoulders/files/big-shoulders-latin-wght-normal.woff2?url';
import newsreader from '@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2?url';
import plexSans from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?url';
import type { ThemeId } from './themes';

export const THEME_FONTS: Record<ThemeId, string[]> = {
	programme: [fraunces, sourceSerif],
	screening: [instrument, schibsted],
	posters: [bigShoulders, schibsted],
	catalogue: [newsreader, plexSans]
};
