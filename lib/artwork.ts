export const artworkSpecs = {
  cover: { width: 1600, height: 2400, label: "Portrait cover" },
  hero: { width: 2400, height: 1350, label: "Hero banner" },
} as const;

export const heroSizes = "(max-width: 800px) calc(100vw - 34px), (max-width: 1040px) calc(100vw - 56px), (max-width: 1344px) calc(100vw - 96px), 1248px";
export const cardSizes = "(max-width: 580px) 48vw, (max-width: 800px) 50vw, (max-width: 1344px) 33vw, 412px";

export type ArtworkKind = keyof typeof artworkSpecs;
export type ArtworkVariant = "thumb" | "card" | "full" | "master";
export type Crop = { x: number; y: number; zoom: number };
export type Artwork = {
  kind: ArtworkKind;
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
  thumb: number;
  card?: number;
  blur: string;
  crop: Crop;
  bytes: number;
};

export function undersized(kind: ArtworkKind, width: number, height: number) {
  const target = artworkSpecs[kind];
  return width < target.width || height < target.height;
}

export const bundledArtwork: Record<string, { width: number; height: number; blur?: string; cardWidths?: number[] }> = {
  "/manga-world-banner.webp": { width: 1680, height: 780 },
  "/manga/rajan-the-thor-curse/backdrop.webp": { width: 547, height: 306 },
  "/manga/rajan-the-thor-curse/chapter-1/page-01.webp": { width: 1024, height: 1536, cardWidths: [256, 384, 480, 864],
    blur: "data:image/webp;base64,UklGRsQAAABXRUJQVlA4ILgAAADwAwCdASoPABYAPslSoksnpKMhsAgA8BkJaQAFgxF6DFkHPeRJuCDgAP6qGlGyo0EU59OyHtAubvg5HWhrwzVNpF2gpRwxQRJEeIrzz8PRRMebN7MmRn3wbK0nm80r1mZbuGr5tAcYsYdXNOS/xoHZBxt0GB9v09mTShrvEvv2gU1btn1q3srUfO66aXocdaWvnNA9dfjkZf+GegpHVlr9Kzb0EOD95yUYwNnLcte++tJJrMHmuAAA" },
  "/manga/the-drowned-city/cover.webp": { width: 585, height: 878, cardWidths: [256, 384, 480],
    blur: "data:image/webp;base64,UklGRpQAAABXRUJQVlA4IIgAAAAwBACdASoPABcAPslSoksnpKMhsAgA8BkJbACdAYwm1ec4/9HNu4+9XeAA/t4cl+ttqmYvaT4Cdo9gDbkBHb7V40rpiqjTX1mCYVT5dly01dBNM+WlRkmJCGl0ldMj/2WkL5r5/fR2v77BPybEcLLDeZjz77MD/+xvgoVH12IV55yvEOCFQAAA" },
};
