# Design

Watchlist keeps the films and series people keep recommending, for one person or a few people
sharing a list. It's opened on a phone in the moment ("you have to watch…") and on a laptop when
deciding what to put on. It should feel like the printed matter of a good independent cinema:
calm, specific, and about the films rather than the software.

Each person picks one of four themes in Settings. The themes share one layout and one set of
components; they differ in type, palette, shape and a few theme-only details. Every theme has its
own light and dark palette, and "Match device" follows the system setting.

## Themes

| Theme                                      | Reference                                             | Display / body type                                   | Palette                                                          | Radius   | Default view         |
| ------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------- | -------- | -------------------- |
| Repertory programme (`programme`, default) | A printed listings booklet from an independent cinema | Fraunces / Source Serif 4                             | Cream paper, warm ink, vermilion accent                          | 0        | List                 |
| Late-night screening (`screening`)         | A small screening room before the lights go down      | Instrument Serif italic / Schibsted Grotesk           | Oxblood black, brass accent, velvet red; light "matinee" variant | 0.25rem  | List, larger posters |
| Poster wall (`posters`)                    | A cinema lobby wall                                   | Big Shoulders (uppercase) / Schibsted Grotesk         | Off-white or near-black, marquee-yellow highlight                | 0        | Poster grid          |
| Collector’s catalogue (`catalogue`)        | A boutique Blu-ray catalogue                          | Newsreader / IBM Plex Sans, IBM Plex Mono for numbers | White and black, spine-green accent                              | 0.125rem | Numbered list        |

Tokens live in `src/routes/layout.css` under `[data-theme='…']` and `[data-theme='…'].dark`.
Beyond shadcn's tokens each theme sets `--highlight` (the one accent used for ×2 counts, ratings
and selection), the display font, weight, case and tracking, and `--poster-shadow`.

Theme-only details use the custom variants `programme:`, `screening:`, `posters:` and
`catalogue:` (for example the perforated row rule and dashed ticket-stub column in the programme,
and the spine numbers in the catalogue). Keep these few and purposeful.

## Rules

- **Type carries the identity.** Titles use `.display`. Section labels use `.label` (small,
  tracked capitals), not bold headings. Figures use `.figures` (tabular, lining).
- **One accent.** `--highlight` marks what matters: suggestion counts, ratings, release dates,
  selection. Don't use it for decoration.
- **Lists, not cards.** Titles are rows divided by hairlines, or a poster grid. No card around
  every item, no nested boxes.
- **Posters are the only imagery.** When TMDB has no poster, the title is set in type on a muted
  block.
- **Left-aligned, with a clear lead.** Each page has one large display heading and a small label
  above it naming the list.
- **Motion is quiet.** 150–200ms colour and opacity transitions on state changes only;
  `prefers-reduced-motion` turns them off.
- **Icons**: Lucide at stroke 1.5, only where they help (tick, add, search, view toggle).
- **Copy**: British English, plain sentences, typographic quotes and apostrophes, no exclamation
  marks or emoji. Empty states say what goes there and offer the one action that fills it.
- **Every screen works at 360px**, in all four themes, light and dark.
