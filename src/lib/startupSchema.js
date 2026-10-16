/** Incubated-startup record fields (mirror backend INCUBATED_STARTUP_FIELDS). */
import options from "./options";

export const STARTUP_SECTIONS = [
  {
    id: "identity",
    title: "Startup",
    fields: [
      { name: "startup_name", label: "Startup name", required: true, maxLength: 150 },
      { name: "startup_code", label: "Startup ID", maxLength: 40, help: "Internal ID, if any." },
      { name: "founder", label: "Founder", maxLength: 120 },
      { name: "co_founder", label: "Co-founder(s)" },
      { name: "sector", label: "Sector", suggestions: options.sectors, maxLength: 150 },
      { name: "sub_sector", label: "Sub-sector", maxLength: 150 },
      { name: "technology", label: "Technology" },
      { name: "trl_level", label: "TRL level", type: "select", options: options.trlLevels },
    ],
  },
  {
    id: "contact",
    title: "Contact",
    fields: [
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone", type: "tel", required: true },
      { name: "website", label: "Website", type: "url" },
      { name: "linkedin", label: "LinkedIn", type: "url" },
      { name: "city", label: "City", maxLength: 80 },
      { name: "address", label: "Address" },
    ],
  },
  {
    id: "registration",
    title: "Registration",
    fields: [
      { name: "startup_india_number", label: "Startup India number", maxLength: 40 },
      { name: "dpiit_number", label: "DPIIT number", maxLength: 40 },
      { name: "cin", label: "CIN", maxLength: 40 },
      { name: "pan", label: "PAN", maxLength: 20 },
      { name: "gst", label: "GST", maxLength: 30 },
    ],
  },
  {
    id: "progress",
    title: "Progress",
    fields: [
      {
        name: "stage",
        label: "Business stage",
        type: "select",
        options: options.startupStages,
        help: `Startups at the “${options.graduatedStartupStage}” stage are listed as graduated.`,
      },
      { name: "incubation_stage", label: "Incubation stage", maxLength: 120 },
      { name: "employees", label: "Number of employees", inputMode: "numeric", maxLength: 20 },
      { name: "revenue", label: "Revenue", maxLength: 100 },
      { name: "valuation", label: "Valuation", maxLength: 100 },
      { name: "investment_raised", label: "Investment raised", maxLength: 100 },
      { name: "assigned_mentor", label: "Assigned mentor", maxLength: 120 },
      { name: "risk_score", label: "Risk score", maxLength: 40 },
      { name: "success_story", label: "Success story", type: "textarea", wide: true, rows: 3, maxLength: 4000 },
      { name: "remarks", label: "Remarks", type: "textarea", wide: true, rows: 3, maxLength: 4000 },
    ],
  },
];

export const DOCUMENT_TYPES = [
  ["pitch_deck", "Pitch deck"],
  ["pan", "PAN"],
  ["gst", "GST"],
  ["mou", "MoU"],
  ["product_pics", "Product pictures"],
  ["startup_india", "Startup India"],
  ["bank_statement", "Bank statement"],
  ["ip", "IP"],
  ["agreements", "Agreements"],
  ["reports", "Reports"],
  ["funding", "Funding"],
  ["investor_deck", "Investor deck"],
  ["meeting_minutes", "Meeting minutes"],
];

export const DOCUMENT_KINDS = ["pdf", "image", "word", "excel", "powerpoint", "text"];

export const FILE_LABELS = { photo: "Photo / logo", ...Object.fromEntries(DOCUMENT_TYPES) };

export const STARTUP_FIELDS = STARTUP_SECTIONS.flatMap((s) => s.fields);

export function emptyStartup() {
  return Object.fromEntries(STARTUP_FIELDS.map((f) => [f.name, ""]));
}
