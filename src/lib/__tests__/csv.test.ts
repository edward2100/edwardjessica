import { describe, expect, it } from "vitest";
import { buildGuestCsvTemplate, parseGuestCsv } from "@/lib/csv";

describe("CSV parsing", () => {
  it("parses grouped guests with event eligibility", () => {
    const rows = parseGuestCsv(
      "groupName,greeting,name,phone,email,side,events\nHardwin Family,Dear Mr. Hardwin & Family,Hardwin Salim,+6281,test@example.com,bride,holy_matrimony|dinner"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      groupName: "Hardwin Family",
      side: "bride",
      events: ["holy_matrimony", "dinner"]
    });
  });

  it("builds an import template that parses back into example rows", () => {
    const template = buildGuestCsvTemplate();
    expect(template).toContain("groupName");
    expect(template).toContain("privateNotesEn");
    expect(template).toContain("holy_matrimony|tea_lunch|dinner");

    const rows = parseGuestCsv(template);
    expect(rows).toHaveLength(3);
    expect(rows[0].events).toEqual(["holy_matrimony", "tea_lunch", "dinner"]);
    expect(rows[2].events).toEqual(["dinner"]);
  });
});
