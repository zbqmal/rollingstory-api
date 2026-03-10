export const WORK_GENRES = [
  'fantasy',
  'sci-fi',
  'mystery',
  'romance',
  'horror',
  'historical-fiction',
  'thriller',
  'uncategorized',
] as const;

export type WorkGenre = (typeof WORK_GENRES)[number];
