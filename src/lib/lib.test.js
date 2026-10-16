import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import { formatBytes, initials, safeUrl } from "./format";
import { FORMS, allFields, emptyValues, isRequired, isVisible, validateField, validateStep } from "./formSchemas";
import options from "./options";

const field = (name) => allFields(FORMS["pre-incubation"]).find((f) => f.name === name);
const file = (name, size = 100) => ({ name, size });

describe("validateField", () => {
  it("reports required text, select and radio fields", () => {
    expect(validateField(field("name"), "", {})).toBe("Full name is required");
    expect(validateField(field("sector"), "", {})).toMatch(/Choose an option/);
    expect(validateField(field("gender"), "", {})).toBeNull();
  });

  it("validates email and phone formats like the API", () => {
    expect(validateField(field("email"), "not-an-email", {})).toMatch(/valid email/);
    expect(validateField(field("email"), "a@b.co", {})).toBeNull();
    expect(validateField(field("contact_number"), "12345", {})).toMatch(/valid phone/);
    expect(validateField(field("contact_number"), "+91 98765-43210", {})).toBeNull();
  });

  it("accepts bare domains but rejects non-web URL schemes", () => {
    expect(validateField(field("website_url"), "greenloop.in", {})).toBeNull();
    expect(validateField(field("website_url"), "javascript:alert(1)", {})).toMatch(/http/);
    expect(validateField(field("website_url"), "not a url", {})).toMatch(/valid web address/);
  });

  it("rejects future dates for past-only fields", () => {
    expect(validateField(field("dob"), "2999-01-01", {})).toMatch(/future/);
  });

  it("checks file type and size", () => {
    expect(validateField(field("pitch_deck"), null, {})).toMatch(/Attach/);
    expect(validateField(field("pitch_deck"), file("deck.exe"), {})).toMatch(/PDF/);
    expect(validateField(field("pitch_deck"), file("deck.pdf", 25 * 1024 * 1024), {})).toMatch(/smaller than/);
    expect(validateField(field("pitch_deck"), file("Deck.PDF"), {})).toBeNull();
  });
});

describe("conditional fields", () => {
  it("only shows and requires registration details for registered companies", () => {
    const unregistered = { company_type: "Not Registered" };
    const registered = { company_type: "Private Limited" };
    expect(isVisible(field("cin"), unregistered)).toBe(false);
    expect(isVisible(field("cin"), registered)).toBe(true);
    expect(isRequired(field("certificate"), unregistered)).toBe(false);
    expect(isRequired(field("certificate"), registered)).toBe(true);
    expect(validateField(field("cin"), "x".repeat(500), unregistered)).toBeNull();
  });
});

describe("form definitions", () => {
  it("only offers options the API accepts", () => {
    expect(field("sector").options).toEqual(options.sectors);
    expect(field("company_type").options).toEqual(options.companyTypes);
  });

  it("starts with empty values for every non-file field", () => {
    const values = emptyValues(FORMS.incubation);
    expect(values.program_types).toEqual([]);
    expect(values.startup_name).toBe("");
    expect("pitch_deck" in values).toBe(false);
  });

  it("validates a whole step at once", () => {
    const step = FORMS.internship.steps[0];
    const errors = validateStep(step, emptyValues(FORMS.internship), {});
    expect(Object.keys(errors)).toEqual(["name", "email", "phone", "department", "year_of_study", "hosteller_status"]);
  });
});

describe("toCsv", () => {
  it("quotes values, adds a BOM and neutralises formula injection", () => {
    const csv = toCsv(
      [
        { key: "name", label: "Name" },
        { key: "note", label: "Note", value: (r) => r.note.toUpperCase() },
      ],
      [{ name: '=HYPERLINK("x")', note: 'say "hi"' }],
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [, row] = csv.slice(1).split("\r\n");
    expect(row).toBe(`"'=HYPERLINK(""x"")","SAY ""HI"""`);
  });
});

describe("format helpers", () => {
  it("only treats http(s) values as links", () => {
    expect(safeUrl("https://aic.example")).toBe("https://aic.example");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
  });

  it("formats sizes and initials", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
    expect(initials("asha verma rao")).toBe("AV");
  });
});
