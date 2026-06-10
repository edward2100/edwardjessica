"use client";

import { ImagePlus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import type { ChangeEvent } from "react";
import type {
  DiscoverMedanGuideItem,
  DiscoverMedanGuideSection,
  DiscoverMedanSectionId,
  Language,
  WeddingContent,
} from "@/lib/types";

interface DiscoverMedanEditorProps {
  content: WeddingContent;
  onChange: (content: WeddingContent) => void;
  onUploadItemImage: (
    event: ChangeEvent<HTMLInputElement>,
    itemId: string,
  ) => void;
  uploadingItemId: string;
}

export function DiscoverMedanEditor({
  content,
  onChange,
  onUploadItemImage,
  uploadingItemId,
}: DiscoverMedanEditorProps) {
  const discover = content.discoverMedan;

  function updateDiscover(update: Partial<WeddingContent["discoverMedan"]>) {
    onChange({
      ...content,
      discoverMedan: {
        ...discover,
        ...update,
      },
    });
  }

  function updateLocalizedField(
    field:
      | "heroKicker"
      | "heroTitle"
      | "heroSubtitle"
      | "heroButton"
      | "introEyebrow"
      | "introTitle",
    language: Language,
    value: string,
  ) {
    updateDiscover({
      [field]: {
        ...discover[field],
        [language]: value,
      },
    });
  }

  function updateIntroParagraphs(language: Language, value: string) {
    updateDiscover({
      introParagraphs: {
        ...discover.introParagraphs,
        [language]: value
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      },
    });
  }

  function updateSection(
    sectionId: DiscoverMedanSectionId,
    update: Partial<DiscoverMedanGuideSection>,
  ) {
    updateDiscover({
      sections: discover.sections.map((section) =>
        section.id === sectionId ? { ...section, ...update } : section,
      ),
    });
  }

  function updateSectionLocalized(
    sectionId: DiscoverMedanSectionId,
    field: "eyebrow" | "title" | "intro",
    language: Language,
    value: string,
  ) {
    updateDiscover({
      sections: discover.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              [field]: {
                ...section[field],
                [language]: value,
              },
            }
          : section,
      ),
    });
  }

  function updateItem(
    sectionId: DiscoverMedanSectionId,
    itemId: string,
    update: Partial<DiscoverMedanGuideItem>,
  ) {
    updateSection(sectionId, {
      items:
        discover.sections
          .find((section) => section.id === sectionId)
          ?.items.map((item) =>
            item.id === itemId ? { ...item, ...update } : item,
          ) || [],
    });
  }

  function updateItemLocalized(
    sectionId: DiscoverMedanSectionId,
    itemId: string,
    field: "name" | "note",
    language: Language,
    value: string,
  ) {
    updateSection(sectionId, {
      items:
        discover.sections
          .find((section) => section.id === sectionId)
          ?.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  [field]: {
                    ...item[field],
                    [language]: value,
                  },
                }
              : item,
          ) || [],
    });
  }

  function addItem(sectionId: DiscoverMedanSectionId) {
    const section = discover.sections.find((item) => item.id === sectionId);
    if (!section) return;
    let nextIndex = section.items.length + 1;
    let nextId = `${sectionId}-custom-${nextIndex}`;
    while (section.items.some((item) => item.id === nextId)) {
      nextIndex += 1;
      nextId = `${sectionId}-custom-${nextIndex}`;
    }
    updateSection(sectionId, {
      items: [
        ...section.items,
        {
          id: nextId,
          name: { en: "New place", id: "Tempat baru" },
          note: { en: "", id: "" },
        },
      ],
    });
  }

  function removeItem(sectionId: DiscoverMedanSectionId, itemId: string) {
    const section = discover.sections.find((item) => item.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      items: section.items.filter((item) => item.id !== itemId),
    });
  }

  return (
    <div className="admin-panel" style={{ marginTop: 28 }}>
      <div className="section-heading" style={{ marginBottom: 12 }}>
        <div>
          <p className="eyebrow">Discover Medan Content</p>
          <h3 className="serif" style={{ fontSize: "1.8rem", marginTop: 6 }}>
            Guide copy and item images
          </h3>
          <p className="muted" style={{ marginTop: 6 }}>
            Edit the guest-facing Discover Medan page. Images uploaded here are
            draft-only until you publish.
          </p>
        </div>
      </div>

      <div className="grid-2">
        <LocalizedTextInput
          label="Hero small text"
          value={discover.heroKicker}
          onChange={(language, value) =>
            updateLocalizedField("heroKicker", language, value)
          }
        />
        <LocalizedTextInput
          label="Hero title"
          value={discover.heroTitle}
          onChange={(language, value) =>
            updateLocalizedField("heroTitle", language, value)
          }
        />
        <LocalizedTextArea
          label="Hero subtitle"
          value={discover.heroSubtitle}
          onChange={(language, value) =>
            updateLocalizedField("heroSubtitle", language, value)
          }
        />
        <LocalizedTextInput
          label="Hero button"
          value={discover.heroButton}
          onChange={(language, value) =>
            updateLocalizedField("heroButton", language, value)
          }
        />
        <LocalizedTextInput
          label="Intro eyebrow"
          value={discover.introEyebrow}
          onChange={(language, value) =>
            updateLocalizedField("introEyebrow", language, value)
          }
        />
        <LocalizedTextInput
          label="Intro title"
          value={discover.introTitle}
          onChange={(language, value) =>
            updateLocalizedField("introTitle", language, value)
          }
        />
        <label className="form-field">
          <span>Intro paragraphs EN</span>
          <textarea
            className="textarea"
            value={discover.introParagraphs.en.join("\n")}
            onChange={(event) =>
              updateIntroParagraphs("en", event.target.value)
            }
          />
        </label>
        <label className="form-field">
          <span>Intro paragraphs ID</span>
          <textarea
            className="textarea"
            value={discover.introParagraphs.id.join("\n")}
            onChange={(event) =>
              updateIntroParagraphs("id", event.target.value)
            }
          />
        </label>
      </div>

      <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
        {discover.sections.map((section) => (
          <div className="invite-panel" key={section.id}>
            <div className="section-heading" style={{ marginBottom: 14 }}>
              <div>
                <p className="eyebrow">{section.id}</p>
                <h4
                  className="serif"
                  style={{ fontSize: "1.55rem", marginTop: 6 }}
                >
                  {section.title.en}
                </h4>
              </div>
              <button
                className="button button-muted"
                type="button"
                onClick={() => addItem(section.id)}
              >
                <Plus size={15} />
                Add Item
              </button>
            </div>

            <div className="grid-2">
              <LocalizedTextInput
                label="Section eyebrow"
                value={section.eyebrow}
                onChange={(language, value) =>
                  updateSectionLocalized(
                    section.id,
                    "eyebrow",
                    language,
                    value,
                  )
                }
              />
              <LocalizedTextInput
                label="Section title"
                value={section.title}
                onChange={(language, value) =>
                  updateSectionLocalized(section.id, "title", language, value)
                }
              />
              <LocalizedTextArea
                label="Section intro"
                value={section.intro}
                onChange={(language, value) =>
                  updateSectionLocalized(section.id, "intro", language, value)
                }
              />
            </div>

            <div className="discover-admin-items">
              {section.items.map((item, index) => (
                <div className="discover-admin-item" key={item.id}>
                  <div className="discover-admin-item-preview">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt=""
                        width={150}
                        height={110}
                        unoptimized
                      />
                    ) : (
                      <div className="discover-admin-item-empty">
                        No image
                      </div>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p className="eyebrow">Item {index + 1}</p>
                    <div className="grid-2" style={{ marginTop: 10 }}>
                      <LocalizedTextInput
                        label="Name"
                        value={item.name}
                        onChange={(language, value) =>
                          updateItemLocalized(
                            section.id,
                            item.id,
                            "name",
                            language,
                            value,
                          )
                        }
                      />
                      <LocalizedTextArea
                        label="Description"
                        value={item.note}
                        onChange={(language, value) =>
                          updateItemLocalized(
                            section.id,
                            item.id,
                            "note",
                            language,
                            value,
                          )
                        }
                      />
                    </div>
                    <div className="flow-preview-actions">
                      <label className="button button-muted">
                        <ImagePlus size={15} />
                        {uploadingItemId === item.id
                          ? "Uploading..."
                          : "Upload Item Image"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            onUploadItemImage(event, item.id)
                          }
                          style={{ display: "none" }}
                        />
                      </label>
                      {item.imageUrl ? (
                        <button
                          className="button button-muted"
                          type="button"
                          onClick={() =>
                            updateItem(section.id, item.id, {
                              imageUrl: undefined,
                            })
                          }
                        >
                          <Trash2 size={15} />
                          Clear Image
                        </button>
                      ) : null}
                      <button
                        className="button button-muted"
                        type="button"
                        onClick={() => removeItem(section.id, item.id)}
                      >
                        <Trash2 size={15} />
                        Remove Item
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LocalizedTextInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (language: Language, value: string) => void;
  value: { en: string; id: string };
}) {
  return (
    <>
      <label className="form-field">
        <span>{label} EN</span>
        <input
          className="input"
          value={value.en}
          onChange={(event) => onChange("en", event.target.value)}
        />
      </label>
      <label className="form-field">
        <span>{label} ID</span>
        <input
          className="input"
          value={value.id}
          onChange={(event) => onChange("id", event.target.value)}
        />
      </label>
    </>
  );
}

function LocalizedTextArea({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (language: Language, value: string) => void;
  value: { en: string; id: string };
}) {
  return (
    <>
      <label className="form-field">
        <span>{label} EN</span>
        <textarea
          className="textarea"
          value={value.en}
          onChange={(event) => onChange("en", event.target.value)}
        />
      </label>
      <label className="form-field">
        <span>{label} ID</span>
        <textarea
          className="textarea"
          value={value.id}
          onChange={(event) => onChange("id", event.target.value)}
        />
      </label>
    </>
  );
}
