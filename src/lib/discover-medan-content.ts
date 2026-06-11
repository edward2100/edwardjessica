import { discoverMedanCopy } from "@/lib/guest-page-copy";
import type {
  DiscoverMedanContent,
  DiscoverMedanGuideItem,
  DiscoverMedanGuideSection,
  DiscoverMedanSectionId,
  LocalizedString,
} from "@/lib/types";

const sectionOrder: DiscoverMedanSectionId[] = [
  "localFood",
  "supper",
  "cafe",
  "placesToVisit",
];

function localized(en: string, id: string): LocalizedString {
  return { en, id };
}

function itemId(sectionId: DiscoverMedanSectionId, name: string, index: number) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${sectionId}-${slug || index + 1}`;
}

// Per-section copy keys, so adding a section is one entry rather than another
// ternary branch.
const sectionCopy: Record<
  DiscoverMedanSectionId,
  {
    eyebrow: [string, string];
    title: [string, string];
    intro: [string, string];
    items: { en: { name: string; note: string }[]; id: { name: string; note: string }[] };
  }
> = {
  localFood: {
    eyebrow: [discoverMedanCopy.en.localFoodEyebrow, discoverMedanCopy.id.localFoodEyebrow],
    title: [discoverMedanCopy.en.localFoodTitle, discoverMedanCopy.id.localFoodTitle],
    intro: [discoverMedanCopy.en.localFoodIntro, discoverMedanCopy.id.localFoodIntro],
    items: { en: discoverMedanCopy.en.localFoodItems, id: discoverMedanCopy.id.localFoodItems },
  },
  supper: {
    eyebrow: [discoverMedanCopy.en.supperEyebrow, discoverMedanCopy.id.supperEyebrow],
    title: [discoverMedanCopy.en.supperTitle, discoverMedanCopy.id.supperTitle],
    intro: [discoverMedanCopy.en.supperIntro, discoverMedanCopy.id.supperIntro],
    items: { en: discoverMedanCopy.en.supperItems, id: discoverMedanCopy.id.supperItems },
  },
  cafe: {
    eyebrow: [discoverMedanCopy.en.cafeEyebrow, discoverMedanCopy.id.cafeEyebrow],
    title: [discoverMedanCopy.en.cafeTitle, discoverMedanCopy.id.cafeTitle],
    intro: [discoverMedanCopy.en.cafeIntro, discoverMedanCopy.id.cafeIntro],
    items: { en: discoverMedanCopy.en.cafeItems, id: discoverMedanCopy.id.cafeItems },
  },
  placesToVisit: {
    eyebrow: [discoverMedanCopy.en.placesEyebrow, discoverMedanCopy.id.placesEyebrow],
    title: [discoverMedanCopy.en.placesTitle, discoverMedanCopy.id.placesTitle],
    intro: [discoverMedanCopy.en.placesIntro, discoverMedanCopy.id.placesIntro],
    items: { en: discoverMedanCopy.en.placesItems, id: discoverMedanCopy.id.placesItems },
  },
};

function itemsForSection(
  sectionId: DiscoverMedanSectionId,
): DiscoverMedanGuideItem[] {
  const { en: englishItems, id: indonesianItems } = sectionCopy[sectionId].items;
  return englishItems.map((item, index) => ({
    id: itemId(sectionId, item.name, index),
    name: localized(item.name, indonesianItems[index]?.name || item.name),
    note: localized(item.note, indonesianItems[index]?.note || item.note),
  }));
}

function sectionFor(
  sectionId: DiscoverMedanSectionId,
): DiscoverMedanGuideSection {
  const cp = sectionCopy[sectionId];
  return {
    id: sectionId,
    eyebrow: localized(cp.eyebrow[0], cp.eyebrow[1]),
    title: localized(cp.title[0], cp.title[1]),
    intro: localized(cp.intro[0], cp.intro[1]),
    items: itemsForSection(sectionId),
  };
}

export function createDefaultDiscoverMedanContent(): DiscoverMedanContent {
  return {
    heroKicker: localized(
      discoverMedanCopy.en.kicker,
      discoverMedanCopy.id.kicker,
    ),
    heroTitle: localized(discoverMedanCopy.en.title, discoverMedanCopy.id.title),
    heroSubtitle: localized(
      discoverMedanCopy.en.subtitle,
      discoverMedanCopy.id.subtitle,
    ),
    heroButton: localized(
      discoverMedanCopy.en.viewGuide,
      discoverMedanCopy.id.viewGuide,
    ),
    introEyebrow: localized(
      discoverMedanCopy.en.introEyebrow,
      discoverMedanCopy.id.introEyebrow,
    ),
    introTitle: localized(
      discoverMedanCopy.en.introTitle,
      discoverMedanCopy.id.introTitle,
    ),
    introParagraphs: {
      en: discoverMedanCopy.en.introParagraphs,
      id: discoverMedanCopy.id.introParagraphs,
    },
    sections: sectionOrder.map(sectionFor),
  };
}

export const discoverMedanSectionOrder = sectionOrder;
