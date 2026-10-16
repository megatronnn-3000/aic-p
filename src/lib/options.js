// Choice lists shared with the API's validators (single source of truth).
import options from "../../backend/aic/options.json";

export default options;

export const PROGRAMS = {
  preincubation: {
    key: "preincubation",
    slug: "pre-incubation",
    name: "Pre-Incubation",
    adminBase: "/admin/pre-incubation",
  },
  incubation: {
    key: "incubation",
    slug: "incubation",
    name: "Incubation",
    adminBase: "/admin/incubation",
  },
  internship: {
    key: "internship",
    slug: "internship",
    name: "Internship",
    adminBase: "/admin/internship",
  },
};

export const PROGRAM_BY_SLUG = Object.fromEntries(Object.values(PROGRAMS).map((p) => [p.slug, p]));

export const STATUS_TONE = {
  Pending: "amber",
  Applied: "amber",
  Approved: "green",
  Selected: "green",
  Graduated: "blue",
  Completed: "neutral",
  Rejected: "red",
  Open: "amber",
  "In Progress": "blue",
  Closed: "neutral",
};

export const STATUS_LABEL = {
  preincubation: { Pending: "Pending review", Approved: "In program", Graduated: "Graduated", Rejected: "Rejected" },
  incubation: { Pending: "Pending review", Approved: "Accepted", Rejected: "Rejected" },
  internship: { Applied: "New", Selected: "Current intern", Completed: "Completed", Rejected: "Not selected" },
};
