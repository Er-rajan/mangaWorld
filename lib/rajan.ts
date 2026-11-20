import type { Chapter } from "./types";

export const rajanSlug = "rajan-the-thor-curse";
export const rajanBackdrop = `/manga/${rajanSlug}/backdrop.webp`;

type Pages = { width: number; height: number; descriptions: string[] };

function createChapter(number: number, title: string, releaseAt: string, groups: Pages[],
  { omittedPages = [], revision = 1 }: { omittedPages?: number[]; revision?: number } = {}): Chapter {
  const id = `chapter-${number}`;
  const folder = `/manga/${rajanSlug}/${id}`;
  const pages = groups.flatMap(({ width, height, descriptions }) => descriptions.map((alt) => ({ width, height, alt })))
    .map((page, index) => {
      const filename = `page-${String(index + 1).padStart(2, "0")}.webp`;
      return { ...page, asset_id: `${folder}/${filename}`, filename };
    })
    .filter((_, index) => !omittedPages.includes(index + 1));
  return {
    id, series_id: rajanSlug, number, title, note: "", release_at: releaseAt, published: true, cover_id: null,
    revision, likes: 0, views: 0, first_page: pages[0].asset_id, thumbnail_id: `${folder}/thumbnail.webp`, pages,
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
  createChapter(3, "Heaven’s Judgment", "2026-11-20T01:18:00+05:30", [{
    width: 1024, height: 1536,
    descriptions: [
      "In Devalok, God King Viraj hears of Ranaksh’s defeat. Dandveer steps forward to deliver Heaven’s judgment.",
      "Rajan sits awake at home, talking to Daitayaa as Thor’s power grows.",
      "At Devgarh Public School, Rajan’s classmates notice a change in him, and Tara sees his injured hand.",
      "Rajan sits awake in his room and asks how many more gods Heaven will send.",
      "Rajan talks with Daitayaa about his growing power and how he feels after defeating Ranaksh.",
      "A glowing seal bearing scales appears in the school hallway and summons Rajan.",
      "Rajan’s classmates ask about his injuries. The summons leads him to an abandoned stepwell.",
      "Rajan enters the divine court beneath the stepwell and meets Dandveer, the God of Judgment.",
      "Dandveer reads the charges against Rajan and binds him with glowing chains.",
      "Rajan struggles against the verdict chains as Dandveer holds up the scales.",
      "The Scales of Sin bring back Ranaksh’s final moments, and verdict chains close around Rajan.",
      "Rajan strikes with lightning and defies Dandveer’s verdict.",
      "Rajan notices the court’s seals light up whenever Dandveer pronounces a judgment.",
      "Rajan strikes a pillar with lightning, and one of the court’s seals shatters.",
      "The divine court begins to collapse as Rajan and Dandveer rush toward each other.",
      "Glowing scales and chains surround Rajan as Dandveer tries to weigh his sins.",
      "Dandveer’s verdict sends Rajan across the court, but Rajan gets back up.",
      "Rajan and Dandveer trade blows amid chains, lightning and shattered stone.",
      "Rajan fights his way through a shower of glowing spears.",
      "Rajan’s lightning strike shatters Dandveer’s armor, and both fighters prepare to clash again.",
      "Dandveer removes his blindfold and attacks Rajan with a massive chain in the ruined court.",
      "Dandveer unleashes his final sentence, and Rajan realizes the pressure is coming from the scales.",
      "Rajan calls on Thor and clashes with Dandveer, who falls as the court crumbles.",
      "Rajan discovers a divine file revealing eight active god heirs at Devgarh Public School.",
    ],
  }], { omittedPages: [5, 6], revision: 3 }),
];
