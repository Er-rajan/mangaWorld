import type { Chapter } from "./types";

export const rajanSlug = "rajan-the-thor-curse";
export const rajanBackdrop = `/manga/${rajanSlug}/backdrop.webp`;

type Pages = { width: number; height: number; descriptions: string[] };

function createChapter(number: number, title: string, releaseAt: string, groups: Pages[]): Chapter {
  const id = `chapter-${number}`;
  const folder = `/manga/${rajanSlug}/${id}`;
  const pages = groups.flatMap(({ width, height, descriptions }) => descriptions.map((alt) => ({ width, height, alt })))
    .map((page, index) => {
      const filename = `page-${String(index + 1).padStart(2, "0")}.webp`;
      return { ...page, asset_id: `${folder}/${filename}`, filename };
    });
  return {
    id, series_id: rajanSlug, number, title, note: "", release_at: releaseAt, published: true, cover_id: null,
    revision: 1, likes: 0, views: 0, first_page: pages[0].asset_id, thumbnail_id: `${folder}/thumbnail.webp`, pages,
  };
}

export const rajanChapters = [
  createChapter(1, "The Forbidden Temple", "2026-11-20T00:30:00+05:30", [{
    width: 1024, height: 1536,
    descriptions: [
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
    ],
  }]),
  createChapter(2, "The First Blood", "2026-11-20T00:55:00+05:30", [{
    width: 1055, height: 1491,
    descriptions: [
      "The First Blood title page shows Rajan beneath a full moon as lightning streaks over a ruined fort.",
      "Rajan wakes with the mark on his chest. Daitayaa speaks to him as his mother calls him for school.",
      "Rajan tries to get through class, but the mark flares when a classmate reaches toward him.",
      "On the school rooftop, Daitayaa warns Rajan that one of the gods has already found him.",
      "Rajan arrives at the abandoned Devgarh Fort, where a spear crashes into the ground.",
      "Ranaksh, the God of War, introduces himself and demands that Rajan come with him.",
      "Ranaksh shatters a wall during the fight. Rajan asks why the gods fear his curse.",
      "Lightning surrounds Rajan as he calls on Thor to awaken.",
      "Ranaksh summons a sky full of weapons over the ruins while Rajan stands below.",
    ],
  }, {
    width: 1024, height: 1536,
    descriptions: [
      "Rajan dodges a strike, blocks Ranaksh's spear and retaliates with lightning.",
      "Rajan and Ranaksh summon their strongest powers, and the two forces collide.",
      "Weapons rain down on the fort as the mark on Rajan's chest begins to glow again.",
      "Rajan refuses to surrender and unleashes Thor's power in a final clash.",
      "Ranaksh lies defeated in the ruins and tells Rajan that Heaven has kept a secret.",
      "Ranaksh's divine essence flows into Rajan, and a new seal appears beside the Thor mark.",
      "At the celestial court, God King Viraj orders the gods to capture Rajan alive.",
    ],
  }, {
    width: 1086, height: 1448,
    descriptions: [
      "Rajan finds the divine order in the ruins, while a chained Daitayaa declares that the curse is awakening.",
    ],
  }]),
];
