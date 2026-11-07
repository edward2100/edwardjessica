import { Fragment, type ReactNode } from "react";
import { text } from "@/lib/i18n";
import type { Language, WeddingEvent } from "@/lib/types";

type DressCodeLabels = {
  dressCode: string;
  dressCodeTitle: string;
  dressCodeText: string;
};

/** DC-1: keeps "Semi-formal" and "(tie optional)" from breaking inside. */
function keepTogether(value: string): ReactNode {
  return value.split(/(\([^)]*\)|\S*-\S*)/).map((part, index) =>
    part.startsWith("(") || part.includes("-") ? (
      <span className="dress-code-nowrap" key={index}>
        {part}
      </span>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

/**
 * DC-1: the dress code for the dinner reception, in a few words. Nothing
 * renders when the guest is not invited to the dinner.
 */
export function DressCodeSection({
  event,
  language,
  labels,
}: {
  event?: WeddingEvent;
  language: Language;
  labels: DressCodeLabels;
}) {
  if (!event) return null;

  return (
    <section
      className="section dress-code-section"
      id="dress-code"
      aria-labelledby="dress-code-title"
    >
      <div className="page-shell">
        <div className="section-heading section-heading-centered">
          <div>
            <p className="eyebrow">{labels.dressCode}</p>
            <h2 className="title serif dress-code-title" id="dress-code-title">
              {keepTogether(labels.dressCodeTitle)}
            </h2>
            <p className="muted dress-code-event">
              {text(event.title, language)} · {event.startTime}
            </p>
          </div>
        </div>
        <p className="dress-code-text">{keepTogether(labels.dressCodeText)}</p>
      </div>
    </section>
  );
}
