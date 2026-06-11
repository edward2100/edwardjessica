import { describe, expect, it } from "vitest";
import { buildGuestCsvTemplate, parseGuestCsv, serializeInvitationsCsv } from "@/lib/csv";

describe("CSV parsing", () => {
  it("parses grouped guests with event eligibility", () => {
    const rows = parseGuestCsv(
      "groupName,greeting,name,phone,email,side,events\nHardwin Family,Dear Mr. Hardwin & Family,Hardwin Salim,+6281,test@example.com,bride,holy_matrimony|dinner",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      groupName: "Hardwin Family",
      side: "bride",
      flow: "generic",
      events: ["holy_matrimony", "dinner"],
    });
  });

  it("prefixes formula-injection characters with a single quote", () => {
    const csv = serializeInvitationsCsv([
      {
        formula: "=SUM(1,2)",
        plusStart: "+CMD",
        minusStart: "-1+1",
        atStart: "@foo",
        safe: "hello",
        number: 42,
      },
    ]);
    expect(csv).toContain("'=SUM(1,2)");
    expect(csv).toContain("'+CMD");
    expect(csv).toContain("'-1+1");
    expect(csv).toContain("'@foo");
    expect(csv).toContain("hello");
    expect(csv).toContain("42");
  });

  it("does not modify values that do not start with injection characters", () => {
    const csv = serializeInvitationsCsv([
      { name: "Alice", email: "alice@example.com", note: "no injection" },
    ]);
    // email should NOT be prefixed (does not start with @)
    expect(csv).toContain("alice@example.com");
    expect(csv).not.toContain("'alice@example.com");
  });

  it("builds an import template that parses back into example rows", () => {
    const template = buildGuestCsvTemplate();
    expect(template).toContain("groupName");
    expect(template).toContain("flow");
    expect(template).toContain("privateNotesEn");
    expect(template).toContain("holy_matrimony|tea_lunch|dinner");

    const rows = parseGuestCsv(template);
    expect(rows).toHaveLength(3);
    expect(rows[0].flow).toBe("family");
    expect(rows[2].flow).toBe("generic");
    expect(rows[0].events).toEqual(["holy_matrimony", "tea_lunch", "dinner"]);
    expect(rows[2].events).toEqual(["dinner"]);
  });
});
