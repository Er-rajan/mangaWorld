export type PageArt = {
  asset_id: string;
  width: number;
  height: number;
  filename: string;
  alt: string;
};

export type Series = {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  status: "ongoing" | "completed";
  cover_id: string | null;
  revision: number;
  created_at: string;
  hero?: string;
  chapters: ChapterSummary[];
};

export type ChapterSummary = {
  id: string;
  series_id: string;
  number: number;
  title: string;
  note: string;
  release_at: string;
  published: boolean;
  cover_id: string | null;
  revision: number;
  likes: number;
  views: number;
  first_page: string | null;
  thumbnail_id?: string;
};

export type Chapter = ChapterSummary & { pages: PageArt[] };
export type Character = { name: string; series: string; bio: string; image_id?: string | null };
export type ScheduledRelease = { number: number; release_at: string };
export type Settings = { author: string; about: string; watermark: boolean; comments: boolean; characters: Character[] };
export type Library = { series: Series[]; settings: Settings; demo: boolean; unavailable?: boolean };

export type ReaderMode = "vertical" | "single" | "spread";
export type Direction = "ltr" | "rtl" | "vertical";
export type ReaderLayout = { mode: ReaderMode; direction: Direction };
