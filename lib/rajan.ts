import type { Chapter } from "./types";

export const rajanSlug = "rajan-the-thor-curse";

const pages = [
  "Rajan and his classmates talk outside school at the end of the day.",
  "Rajan tells Vivek he needs to catch his bus while Mrs. Sharma calls him back.",
  "Mrs. Sharma speaks to Vivek, and Rajan realizes he has missed his bus.",
  "Rajan takes a quiet path through the trees and discovers an unfamiliar temple.",
  "Rajan approaches the old temple and examines its entrance.",
  "A circle lights up beneath Rajan and the temple floor breaks open.",
  "Rajan falls into a dark chamber and hears a mysterious voice.",
  "A horned figure speaks to Rajan from a throne in the chamber.",
  "The figure describes the power of Thor as lightning fills the panels.",
  "Lightning surrounds Rajan, then he drops to his knees at the end of the chapter.",
].map((alt, index) => {
  const filename = `page-${String(index + 1).padStart(2, "0")}.webp`;
  return { asset_id: `/manga/${rajanSlug}/chapter-1/${filename}`, width: 1024, height: 1536, filename, alt };
});

export const rajanChapter: Chapter = {
  id: "chapter-1", series_id: rajanSlug, number: 1, title: "The Forbidden Temple", note: "",
  release_at: "2026-11-20T00:30:00+05:30", published: true, cover_id: null, revision: 1,
  likes: 0, views: 0, first_page: pages[0].asset_id,
  thumbnail_id: `/manga/${rajanSlug}/chapter-1/thumbnail.webp`, pages,
};
