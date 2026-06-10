import { discoverMedanCopy } from "@/lib/guest-page-copy";
import type {
  DiscoverMedanContent,
  DiscoverMedanGuideItem,
  DiscoverMedanGuideSection,
  DiscoverMedanSectionId,
  LocalizedString,
} from "@/lib/types";

const sectionOrder: DiscoverMedanSectionId[] = ["localFood", "supper", "cafe"];

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

function itemsForSection(
  sectionId: DiscoverMedanSectionId,
): DiscoverMedanGuideItem[] {
  const englishItems =
    sectionId === "localFood"
      ? discoverMedanCopy.en.localFoodItems
      : sectionId === "supper"
        ? discoverMedanCopy.en.supperItems
        : discoverMedanCopy.en.cafeItems;
  const indonesianItems =
    sectionId === "localFood"
      ? discoverMedanCopy.id.localFoodItems
      : sectionId === "supper"
        ? discoverMedanCopy.id.supperItems
        : discoverMedanCopy.id.cafeItems;

  return englishItems.map((item, index) => ({
    id: itemId(sectionId, item.name, index),
    name: localized(item.name, indonesianItems[index]?.name || item.name),
    note: localized(item.note, indonesianItems[index]?.note || item.note),
  }));
}

function sectionFor(
  sectionId: DiscoverMedanSectionId,
): DiscoverMedanGuideSection {
  if (sectionId === "localFood") {
    return {
      id: sectionId,
      eyebrow: localized(
        discoverMedanCopy.en.localFoodEyebrow,
        discoverMedanCopy.id.localFoodEyebrow,
      ),
      title: localized(
        discoverMedanCopy.en.localFoodTitle,
        discoverMedanCopy.id.localFoodTitle,
      ),
      intro: localized(
        discoverMedanCopy.en.localFoodIntro,
        discoverMedanCopy.id.localFoodIntro,
      ),
      items: itemsForSection(sectionId),
    };
  }

  if (sectionId === "supper") {
    return {
      id: sectionId,
      eyebrow: localized(
        discoverMedanCopy.en.supperEyebrow,
        discoverMedanCopy.id.supperEyebrow,
      ),
      title: localized(
        discoverMedanCopy.en.supperTitle,
        discoverMedanCopy.id.supperTitle,
      ),
      intro: localized(
        discoverMedanCopy.en.supperIntro,
        discoverMedanCopy.id.supperIntro,
      ),
      items: itemsForSection(sectionId),
    };
  }

  return {
    id: sectionId,
    eyebrow: localized(
      discoverMedanCopy.en.cafeEyebrow,
      discoverMedanCopy.id.cafeEyebrow,
    ),
    title: localized(
      discoverMedanCopy.en.cafeTitle,
      discoverMedanCopy.id.cafeTitle,
    ),
    intro: localized(
      discoverMedanCopy.en.cafeIntro,
      discoverMedanCopy.id.cafeIntro,
    ),
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
