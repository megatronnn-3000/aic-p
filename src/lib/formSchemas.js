/**
 * Application form definitions. Each program is a list of steps; each field
 * mirrors a backend spec in backend/aic/forms.py (same names, same rules).
 * The same definitions label the staff application detail pages.
 */
import options from "./options";

const isRegistered = (values) => Boolean(values.company_type) && values.company_type !== "Not Registered";

export const FILE_KINDS = {
  pdf: { extensions: [".pdf"], label: "PDF" },
  image: { extensions: [".png", ".jpg", ".jpeg", ".webp"], label: "PNG, JPG or WebP" },
  word: { extensions: [".doc", ".docx"], label: "Word" },
  excel: { extensions: [".xls", ".xlsx", ".csv"], label: "Excel or CSV" },
  powerpoint: { extensions: [".ppt", ".pptx"], label: "PowerPoint" },
  text: { extensions: [".txt"], label: "Text" },
};

export const MAX_FILE_MB = 20;

export function acceptFor(kinds) {
  return kinds.flatMap((kind) => FILE_KINDS[kind].extensions).join(",");
}

export function hintFor(kinds) {
  return `${kinds.map((kind) => FILE_KINDS[kind].label).join(", ")} · up to ${MAX_FILE_MB} MB`;
}

const PRE_INCUBATION = {
  key: "preincubation",
  slug: "pre-incubation",
  title: "Pre-Incubation application",
  intro:
    "For students, staff and early founders with an idea or prototype. Tell us about you, your startup and the support you need.",
  steps: [
    {
      id: "applicant",
      title: "About you",
      description: "The main applicant's contact and background details.",
      fields: [
        { name: "name", label: "Full name", required: true, autoComplete: "name", maxLength: 120 },
        { name: "email", label: "Email", type: "email", required: true, autoComplete: "email", help: "We'll send your confirmation and updates here." },
        { name: "contact_number", label: "Contact number", type: "tel", required: true, autoComplete: "tel", placeholder: "10-digit mobile number" },
        { name: "gender", label: "Gender", type: "select", options: options.gender },
        { name: "dob", label: "Date of birth", type: "date", past: true },
        { name: "native_state", label: "Native state", maxLength: 80 },
        { name: "highest_qualification", label: "Highest qualification", placeholder: "e.g. B.Tech, MBA" },
        { name: "address", label: "Address for correspondence", wide: true, autoComplete: "street-address" },
        { name: "professional_experience", label: "Professional experience", type: "textarea", wide: true, rows: 3, maxLength: 4000, help: "Roles, companies and years — leave blank if none." },
      ],
    },
    {
      id: "startup",
      title: "Your startup",
      description: "Basic facts about the venture and its registration.",
      fields: [
        { name: "startup_name", label: "Startup / brand name", required: true, maxLength: 150 },
        { name: "company_type", label: "Type of company", type: "select", required: true, options: options.companyTypes },
        { name: "sector", label: "Sector", type: "select", required: true, options: options.sectors },
        { name: "startup_stage", label: "Stage of startup", type: "select", required: true, options: options.preIncubationStages },
        { name: "incorporation_date", label: "Date of incorporation / registration", type: "date", past: true, showIf: isRegistered },
        { name: "cin", label: "Corporate Identification Number (CIN)", showIf: isRegistered, maxLength: 40 },
        { name: "office_address", label: "Registered office address", wide: true, showIf: isRegistered },
        { name: "gst_number", label: "GST number", help: "If registered.", maxLength: 30 },
        { name: "dpiit_number", label: "DPIIT recognition number", help: "If received.", maxLength: 40 },
        { name: "website_url", label: "Website", type: "url", placeholder: "example.com" },
        { name: "video_url", label: "Video showcasing the product or model", type: "url", placeholder: "YouTube or Drive link" },
        { name: "social_media_links", label: "Social media links", wide: true, maxLength: 1000 },
      ],
    },
    {
      id: "model",
      title: "Business model",
      description: "Short, specific answers work best — a few sentences each.",
      fields: [
        { name: "problem_statement", label: "What problem are you solving?", type: "textarea", required: true, wide: true, maxLength: 4000 },
        { name: "value_proposition", label: "What is your value proposition?", type: "textarea", wide: true, maxLength: 4000 },
        { name: "usp", label: "What is your unique selling point?", type: "textarea", wide: true, maxLength: 4000 },
        { name: "target_customer", label: "Who is your target customer segment?", type: "textarea", maxLength: 4000 },
        { name: "competitors", label: "Who are your key competitors?", type: "textarea", maxLength: 4000 },
        { name: "revenue_model", label: "What is your revenue model?", type: "textarea", maxLength: 4000 },
        { name: "market_size", label: "What is the market size of the opportunity?", type: "textarea", maxLength: 4000 },
        { name: "scale_up_plan", label: "How do you plan to scale up?", type: "textarea", wide: true, maxLength: 4000 },
        { name: "govt_support", label: "Have you received monetary support under a Central or State government scheme?", type: "radio", options: options.yesNo, wide: true, inline: true },
        { name: "seed_support", label: "Have you received seed support from any incubator before?", type: "radio", options: options.yesNo, wide: true, inline: true },
      ],
    },
    {
      id: "team",
      title: "Team",
      description: "Who is building this startup.",
      fields: [
        { name: "founder_name", label: "Founder name", required: true, maxLength: 120 },
        { name: "co_founder_name", label: "Co-founder name(s)", help: "Separate names with commas." },
        { name: "team_emails", label: "Founder and co-founder emails" },
        { name: "team_contacts", label: "Founder and co-founder contact numbers" },
        { name: "full_time_employees", label: "Number of full-time employees", inputMode: "numeric", maxLength: 20 },
        { name: "linkedin_profiles", label: "LinkedIn profiles of core team members", type: "textarea", wide: true, rows: 3, maxLength: 1000 },
      ],
    },
    {
      id: "support",
      title: "Support needed",
      description: "What you expect from AIC MUJ.",
      fields: [
        { name: "why_applying", label: "Why are you applying to this program?", type: "textarea", required: true, wide: true, maxLength: 4000 },
        { name: "expectations", label: "Your top three expectations from the program", type: "textarea", wide: true, maxLength: 4000 },
        { name: "funds_required", label: "Quantum of funds required", placeholder: "e.g. ₹5,00,000", maxLength: 100 },
        { name: "funding_requirement", label: "Current funding requirement", type: "textarea", maxLength: 4000, rows: 3 },
      ],
    },
    {
      id: "documents",
      title: "Documents",
      description: "Attach your documents. PDFs are preferred.",
      fields: [
        { name: "pitch_deck", label: "Pitch deck", type: "file", kinds: ["pdf"], required: true },
        { name: "business_plan", label: "Business plan", type: "file", kinds: ["pdf"], required: true },
        { name: "resume", label: "Resume / CV of the founder", type: "file", kinds: ["pdf"], required: true },
        { name: "pan_card", label: "PAN card", type: "file", kinds: ["pdf", "image"], required: true },
        { name: "certificate", label: "Registration certificate", type: "file", kinds: ["pdf", "image"], required: isRegistered, help: "Required for registered companies." },
        { name: "passport_photo", label: "Passport-size photo", type: "file", kinds: ["image"] },
        { name: "other_document", label: "Any other supporting document", type: "file", kinds: ["pdf", "image"] },
      ],
    },
  ],
};

const INCUBATION = {
  key: "incubation",
  slug: "incubation",
  title: "Incubation application",
  intro:
    "For startups with a proof of concept, prototype, MVP or early revenue looking for incubation, mentorship, networks and fundraising support.",
  steps: [
    {
      id: "contact",
      title: "Startup & contact",
      description: "Who we should get in touch with.",
      fields: [
        { name: "startup_name", label: "Startup name", required: true, maxLength: 150 },
        { name: "founder_name", label: "Founder / contact person", required: true, autoComplete: "name", maxLength: 120 },
        { name: "email", label: "Email", type: "email", required: true, autoComplete: "email" },
        { name: "mobile_no", label: "Mobile number", type: "tel", required: true, autoComplete: "tel" },
        { name: "state", label: "State", maxLength: 80, autoComplete: "address-level1" },
        { name: "city", label: "City", maxLength: 80, autoComplete: "address-level2" },
      ],
    },
    {
      id: "profile",
      title: "Startup profile",
      description: "Where the startup is today.",
      fields: [
        { name: "sector", label: "Sector", type: "select", required: true, options: options.sectors },
        { name: "incubatee_level", label: "Current level", type: "select", required: true, options: options.incubateeLevels },
        { name: "operational_model", label: "Operational model", type: "select", options: options.operationalModels },
        { name: "govt_programme", label: "Flagship government programme", type: "select", options: options.govtProgrammes },
        { name: "sdg_goal", label: "Primary Sustainable Development Goal", type: "select", options: options.sdgGoals, wide: true },
        { name: "program_types", label: "Support you are looking for", type: "checkboxes", options: options.programTypes, wide: true },
        { name: "msme_registered", label: "MSME registered?", type: "radio", options: options.yesNo, inline: true },
        { name: "dipp_registered", label: "DPIIT (DIPP) registered?", type: "radio", options: options.yesNo, inline: true },
      ],
    },
    {
      id: "pitch",
      title: "Pitch",
      description: "Describe the startup and share your deck.",
      fields: [
        { name: "description", label: "Description of the startup", type: "textarea", required: true, wide: true, rows: 6, maxLength: 4000, help: "What you do, for whom, and the traction so far." },
        { name: "pitch_deck", label: "Pitch deck", type: "file", kinds: ["pdf"], wide: true },
      ],
    },
  ],
};

export const INTERNSHIP_ROLES = [
  {
    title: "Graphic design intern",
    text: "Design marketing content — social media posts, blogs, videos, posters, outdoor creatives, packaging variations and proposals.",
  },
  {
    title: "Website developer intern",
    text: "Design and build website layouts from concept to completion using HTML, CSS and WordPress, integrate back-end services and maintain documentation.",
  },
  {
    title: "Social media marketing intern",
    text: "Plan monthly social media strategy, grow brand awareness and manage the editorial calendar across Instagram, Facebook, YouTube and LinkedIn.",
  },
  {
    title: "Content writer",
    text: "Research industry topics, generate ideas, and write and proofread blogs, case studies and short-form marketing content.",
  },
];

const INTERNSHIP = {
  key: "internship",
  slug: "internship",
  title: "Internship application",
  intro:
    "Work with startups incubated at AIC MUJ. Roles are work-from-home with flexible timings and an experience certificate.",
  steps: [
    {
      id: "about",
      title: "About you",
      description: "Your contact details and course.",
      fields: [
        { name: "name", label: "Full name", required: true, autoComplete: "name", maxLength: 120 },
        { name: "email", label: "Email", type: "email", required: true, autoComplete: "email" },
        { name: "phone", label: "Phone number", type: "tel", required: true, autoComplete: "tel", placeholder: "10-digit mobile number" },
        { name: "department", label: "Department / course", required: true, placeholder: "e.g. B.Tech CSE", maxLength: 150 },
        { name: "year_of_study", label: "Year of study", type: "radio", required: true, options: options.yearsOfStudy, wide: true },
        { name: "hosteller_status", label: "Are you a hosteller or a day scholar?", type: "radio", required: true, options: options.hostellerStatus, wide: true, inline: true },
      ],
    },
    {
      id: "role",
      title: "Role",
      description: "What you'd like to work on and why.",
      fields: [
        { name: "preferred_role", label: "Preferred role", type: "radio", required: true, options: options.internshipRoles, wide: true },
        { name: "why_interested", label: "Why are you interested in this role?", type: "textarea", required: true, wide: true, maxLength: 4000 },
        { name: "skills_experience", label: "What relevant skills or experience do you have?", type: "textarea", required: true, wide: true, maxLength: 4000 },
      ],
    },
    {
      id: "availability",
      title: "Availability & CV",
      description: "Last step.",
      fields: [
        { name: "willing_late", label: "Are you willing to stay late for work when required?", type: "radio", required: true, options: options.yesNo, wide: true, inline: true },
        { name: "cv", label: "CV or portfolio", type: "file", kinds: ["pdf", "word"], wide: true },
      ],
    },
  ],
};

export const FORMS = {
  "pre-incubation": PRE_INCUBATION,
  incubation: INCUBATION,
  internship: INTERNSHIP,
};

export const FORMS_BY_KEY = {
  preincubation: PRE_INCUBATION,
  incubation: INCUBATION,
  internship: INTERNSHIP,
};

export function allFields(form) {
  return form.steps.flatMap((step) => step.fields);
}

export function emptyValues(form) {
  const values = {};
  allFields(form).forEach((field) => {
    if (field.type === "file") return;
    values[field.name] = field.type === "checkboxes" ? [] : "";
  });
  return values;
}

export function isVisible(field, values) {
  return !field.showIf || field.showIf(values);
}

export function isRequired(field, values) {
  return typeof field.required === "function" ? field.required(values) : Boolean(field.required);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client-side mirror of the server rules; the server remains authoritative. */
export function validateField(field, value, values) {
  if (!isVisible(field, values)) return null;
  const required = isRequired(field, values);

  if (field.type === "file") {
    if (!value) return required ? `Attach your ${field.label.toLowerCase()}` : null;
    const ext = `.${value.name.split(".").pop().toLowerCase()}`;
    const allowed = field.kinds.flatMap((kind) => FILE_KINDS[kind].extensions);
    if (!allowed.includes(ext)) return `${field.label} must be a ${field.kinds.map((k) => FILE_KINDS[k].label).join(" or ")} file`;
    if (value.size > MAX_FILE_MB * 1024 * 1024) return `${field.label} must be smaller than ${MAX_FILE_MB} MB`;
    if (value.size === 0) return `${field.label} is empty`;
    return null;
  }

  if (field.type === "checkboxes") {
    return required && !(value || []).length ? `Choose at least one option` : null;
  }

  const text = String(value ?? "").trim();
  if (!text) {
    if (!required) return null;
    return field.type === "select" || field.type === "radio" ? `Choose an option for “${field.label}”` : `${field.label} is required`;
  }
  const max = field.maxLength || (field.type === "textarea" ? 4000 : 300);
  if (text.length > max) return `${field.label} must be ${max} characters or fewer`;
  if (field.type === "email" && !EMAIL_RE.test(text)) return "Enter a valid email address, like name@example.com";
  if (field.type === "tel") {
    const digits = text.replace(/\D/g, "");
    if (!/^[0-9+\-\s()]+$/.test(text) || digits.length < 10 || digits.length > 15) return "Enter a valid phone number (10–15 digits)";
  }
  if (field.type === "url") {
    if (/^[a-z][a-z0-9+.-]*:/i.test(text) && !/^https?:\/\//i.test(text)) return "Enter a web address starting with http:// or https://";
    if (/\s/.test(text) || !text.replace(/^https?:\/\//i, "").includes(".")) return "Enter a valid web address";
  }
  if (field.type === "date" && field.past && text > new Date().toISOString().slice(0, 10)) return `${field.label} can't be in the future`;
  return null;
}

export function validateStep(step, values, files) {
  const errors = {};
  step.fields.forEach((field) => {
    const value = field.type === "file" ? files[field.name] : values[field.name];
    const message = validateField(field, value, values);
    if (message) errors[field.name] = message;
  });
  return errors;
}
