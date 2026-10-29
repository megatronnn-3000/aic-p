"""Declarative field specs and validation for every form the API accepts.

Each spec lists the stored column name, a human label (used in error
messages), whether it is required and how it is validated. The same specs
drive the database columns in ``db.py`` so the two cannot disagree.
"""
import json
import re
from datetime import date
from pathlib import Path

OPTIONS = json.loads((Path(__file__).parent / "options.json").read_text(encoding="utf-8"))

SHORT_MAX = 300
LONG_MAX = 4000

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_ALLOWED_RE = re.compile(r"^[0-9+\-\s()]+$")


class Field:
    def __init__(self, name, label, required=False, kind="text", choices=None, max_length=None, multi=False):
        self.name = name
        self.label = label
        self.required = required
        self.kind = kind
        self.choices = choices
        self.multi = multi
        self.max_length = max_length or (LONG_MAX if kind == "long" else SHORT_MAX)


class FileField:
    def __init__(self, name, label, kinds, required=False, multiple=False):
        self.name = name
        self.label = label
        self.kinds = kinds  # keys of storage.FILE_KINDS
        self.required = required  # bool, or callable(clean_data) -> bool
        self.multiple = multiple

    def is_required(self, data):
        return self.required(data) if callable(self.required) else self.required


YES_NO = OPTIONS["yesNo"]

PRE_INCUBATION_FIELDS = [
    # Applicant
    Field("name", "Full name", required=True, max_length=120),
    Field("email", "Email", required=True, kind="email"),
    Field("gender", "Gender", choices=OPTIONS["gender"]),
    Field("dob", "Date of birth", kind="past_date"),
    Field("address", "Address for correspondence"),
    Field("contact_number", "Contact number", required=True, kind="phone"),
    Field("native_state", "Native state", max_length=80),
    Field("highest_qualification", "Highest qualification"),
    Field("professional_experience", "Professional experience", kind="long"),
    # Startup
    Field("startup_name", "Startup / brand name", required=True, max_length=150),
    Field("company_type", "Type of company", required=True, choices=OPTIONS["companyTypes"]),
    Field("incorporation_date", "Date of incorporation", kind="past_date"),
    Field("cin", "Corporate Identification Number", max_length=40),
    Field("office_address", "Registered office address"),
    Field("gst_number", "GST number", max_length=30),
    Field("dpiit_number", "DPIIT recognition number", max_length=40),
    Field("sector", "Sector", required=True, choices=OPTIONS["sectors"]),
    Field("startup_stage", "Stage of startup", required=True, choices=OPTIONS["preIncubationStages"]),
    Field("problem_statement", "Problem you are solving", required=True, kind="long"),
    Field("value_proposition", "Value proposition", kind="long"),
    Field("usp", "Unique selling point", kind="long"),
    Field("target_customer", "Target customer segment", kind="long"),
    Field("competitors", "Key competitors", kind="long"),
    Field("scale_up_plan", "Scale-up plan", kind="long"),
    Field("revenue_model", "Revenue model", kind="long"),
    Field("market_size", "Market size", kind="long"),
    Field("website_url", "Website", kind="url"),
    Field("social_media_links", "Social media links", kind="long", max_length=1000),
    Field("video_url", "Product / business model video", kind="url"),
    Field("govt_support", "Monetary support under a Central/State scheme", choices=YES_NO),
    Field("seed_support", "Seed support from an incubator", choices=YES_NO),
    # Team
    Field("founder_name", "Founder name", required=True, max_length=120),
    Field("co_founder_name", "Co-founder name(s)"),
    Field("team_emails", "Founder and co-founder emails"),
    Field("team_contacts", "Founder and co-founder contact numbers"),
    Field("linkedin_profiles", "LinkedIn profiles", kind="long", max_length=1000),
    Field("full_time_employees", "Full-time employees", max_length=20),
    # Requirement from the incubator
    Field("why_applying", "Why you are applying", required=True, kind="long"),
    Field("expectations", "Top three expectations", kind="long"),
    Field("funds_required", "Quantum of funds required", max_length=100),
    Field("funding_requirement", "Current funding requirement", kind="long"),
]

PRE_INCUBATION_FILES = [
    FileField("pitch_deck", "Pitch deck", ["pdf"], required=True),
    FileField("resume", "Resume / CV", ["pdf"], required=True),
    FileField("pan_card", "PAN card", ["pdf", "image"], required=True),
    FileField(
        "certificate",
        "Registration certificate",
        ["pdf", "image"],
        # Unregistered idea-stage teams cannot have a certificate yet.
        required=lambda data: data.get("company_type") not in ("", "Not Registered"),
    ),
    FileField("business_plan", "Business plan", ["pdf"], required=True),
    FileField("other_document", "Other supporting document", ["pdf", "image"]),
    FileField("passport_photo", "Passport-size photo", ["image"]),
]

INCUBATION_FIELDS = [
    Field("founder_name", "Founder / contact person", required=True, max_length=120),
    Field("startup_name", "Startup name", required=True, max_length=150),
    Field("email", "Email", required=True, kind="email"),
    Field("mobile_no", "Mobile number", required=True, kind="phone"),
    Field("state", "State", max_length=80),
    Field("city", "City", max_length=80),
    Field("sector", "Sector", required=True, choices=OPTIONS["sectors"]),
    Field("incubatee_level", "Current level", required=True, choices=OPTIONS["incubateeLevels"]),
    Field("program_types", "Support you are looking for", choices=OPTIONS["programTypes"], multi=True),
    Field("operational_model", "Operational model", choices=OPTIONS["operationalModels"]),
    Field("govt_programme", "Flagship government programme", choices=OPTIONS["govtProgrammes"]),
    Field("msme_registered", "MSME registered", choices=YES_NO),
    Field("dipp_registered", "DPIIT (DIPP) registered", choices=YES_NO),
    Field("sdg_goal", "Primary SDG goal", choices=OPTIONS["sdgGoals"]),
    Field("description", "Description of the startup", required=True, kind="long"),
]

INCUBATION_FILES = [
    FileField("pitch_deck", "Pitch deck", ["pdf"]),
]

INTERNSHIP_FIELDS = [
    Field("name", "Full name", required=True, max_length=120),
    Field("email", "Email", required=True, kind="email"),
    Field("phone", "Phone number", required=True, kind="phone"),
    Field("department", "Department / course", required=True, max_length=150),
    Field("year_of_study", "Year of study", required=True, choices=OPTIONS["yearsOfStudy"]),
    Field("preferred_role", "Preferred role", required=True, choices=OPTIONS["internshipRoles"]),
    Field("why_interested", "Why you are interested", required=True, kind="long"),
    Field("skills_experience", "Relevant skills or experience", required=True, kind="long"),
    Field("hosteller_status", "Hosteller or day scholar", required=True, choices=OPTIONS["hostellerStatus"]),
    Field("willing_late", "Willing to stay late when required", required=True, choices=YES_NO),
]

INTERNSHIP_FILES = [
    FileField("cv", "CV / portfolio", ["pdf", "word"]),
]

ENQUIRY_FIELDS = [
    Field("program", "Program", required=True, choices=list(OPTIONS["enquiryPrograms"].keys())),
    Field("name", "Name", required=True, max_length=120),
    Field("email", "Email", required=True, kind="email"),
    Field("phone", "Phone", kind="phone"),
    Field("message", "Message", required=True, kind="long", max_length=2000),
]

INCUBATED_STARTUP_FIELDS = [
    Field("startup_code", "Startup ID", max_length=40),
    Field("startup_name", "Startup name", required=True, max_length=150),
    Field("founder", "Founder", max_length=120),
    Field("co_founder", "Co-founder(s)"),
    Field("email", "Email", required=True, kind="email"),
    Field("phone", "Phone", required=True, kind="phone"),
    Field("website", "Website", kind="url"),
    Field("linkedin", "LinkedIn", kind="url"),
    Field("startup_india_number", "Startup India number", max_length=40),
    Field("dpiit_number", "DPIIT number", max_length=40),
    Field("cin", "CIN", max_length=40),
    Field("pan", "PAN", max_length=20),
    Field("gst", "GST", max_length=30),
    Field("sector", "Sector", max_length=150),
    Field("sub_sector", "Sub-sector", max_length=150),
    Field("technology", "Technology"),
    Field("trl_level", "TRL level", choices=OPTIONS["trlLevels"]),
    Field("incubation_stage", "Incubation stage", max_length=120),
    Field("stage", "Business stage", choices=OPTIONS["startupStages"]),
    Field("employees", "Number of employees", max_length=20),
    Field("revenue", "Revenue", max_length=100),
    Field("valuation", "Valuation", max_length=100),
    Field("investment_raised", "Investment raised", max_length=100),
    Field("assigned_mentor", "Assigned mentor", max_length=120),
    Field("success_story", "Success story", kind="long"),
    Field("risk_score", "Risk score", max_length=40),
    Field("city", "City", max_length=80),
    Field("address", "Address"),
    Field("remarks", "Remarks", kind="long"),
]

STARTUP_DOCUMENT_TYPES = [
    ("pitch_deck", "Pitch deck"),
    ("pan", "PAN"),
    ("gst", "GST"),
    ("mou", "MoU"),
    ("product_pics", "Product pictures"),
    ("startup_india", "Startup India"),
    ("bank_statement", "Bank statement"),
    ("ip", "IP"),
    ("agreements", "Agreements"),
    ("reports", "Reports"),
    ("funding", "Funding"),
    ("investor_deck", "Investor deck"),
    ("meeting_minutes", "Meeting minutes"),
]

INCUBATED_STARTUP_FILES = [FileField("photo", "Photo / logo", ["image"])] + [
    FileField(key, label, ["pdf", "image", "word", "excel", "powerpoint", "text"], multiple=True)
    for key, label in STARTUP_DOCUMENT_TYPES
]

RECORD_FIELDS = [
    Field("title", "Title", required=True, max_length=200),
    Field("record_date", "Date", kind="date"),
    Field("status", "Status", choices=OPTIONS["recordStatuses"]),
    Field("contact_name", "Contact name", max_length=120),
    Field("contact_email", "Contact email", kind="email"),
    Field("contact_phone", "Contact phone", kind="phone"),
    Field("description", "Description", kind="long"),
    Field("notes", "Notes", kind="long"),
]

RECORD_FILES = [
    FileField("attachment", "Attachment", ["pdf", "image", "word", "excel", "powerpoint", "text"]),
]

PITCH_FIELDS = [
    Field("pitch_date", "Pitch date", kind="date"),
    Field("pitch_time", "Pitch time", kind="time"),
    Field("pitch_link", "Meeting link", kind="url"),
]

INVESTMENT_FIELDS = [
    Field("investor_name", "Investor name", required=True, max_length=150),
    Field("investor_type", "Investor type", choices=OPTIONS["investorTypes"]),
    Field("instrument", "Instrument", choices=OPTIONS["investmentInstruments"]),
    Field("amount", "Amount (₹)", kind="amount"),
    Field("invested_on", "Date of investment", kind="past_date"),
    Field("contact_email", "Investor email", kind="email"),
    Field("notes", "Notes", kind="long"),
]

MENTOR_FIELDS = [
    Field("mentor_name", "Mentor name", required=True, max_length=150),
    Field("expertise", "Area of expertise", max_length=200),
    Field("organisation", "Organisation / designation", max_length=200),
    Field("email", "Email", kind="email"),
    Field("phone", "Phone", kind="phone"),
    Field("assigned_on", "Assigned on", kind="date"),
    Field("status", "Status", choices=OPTIONS["mentorStatuses"]),
    Field("notes", "Notes", kind="long"),
]

RECORD_MODULES = {
    "enquiry": ["preincubation", "incubation", "internship"],
    "events": ["upcoming", "past", "registrations"],
    "mou": ["active", "pending", "expired"],
    "aim": ["grants", "compliance", "milestones"],
    "sisfs": ["applications", "disbursements", "utilization"],
    "coworking": ["allotments", "requests", "usage"],
    "facility": ["inventory", "bookings", "usage"],
}


def _clean_text(value):
    # Normalise line endings and strip NUL bytes, which Postgres rejects.
    return str(value).replace("\r\n", "\n").replace("\x00", "").strip()


def normalize_url(value):
    """Return (url, error). Bare domains get https://; only http(s) schemes are allowed."""
    if not value:
        return "", None
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", value) and not re.match(r"^https?://", value, re.I):
        return value, "must be a web address starting with http:// or https://"
    if not re.match(r"^https?://", value, re.I):
        value = "https://" + value
    if " " in value or "." not in value.split("://", 1)[1]:
        return value, "doesn't look like a valid web address"
    return value, None


def validate(fields, source, partial=False):
    """Validate a mapping (request.form / dict) against ``fields``.

    Returns ``(clean, errors)``. With ``partial=True`` only keys present in the
    source are validated and returned (used for PATCH-style updates).
    """
    clean, errors = {}, {}
    getlist = getattr(source, "getlist", None)

    for field in fields:
        if partial and field.name not in source:
            continue

        if field.multi:
            raw = getlist(field.name) if getlist else source.get(field.name, [])
            if isinstance(raw, str):
                raw = [part for part in raw.split(",")]
            values = [_clean_text(v) for v in raw if _clean_text(v)]
            bad = [v for v in values if field.choices and v not in field.choices]
            if bad:
                errors[field.name] = f"{field.label} has an unknown option: {bad[0]}"
            elif field.required and not values:
                errors[field.name] = f"{field.label} is required"
            clean[field.name] = ", ".join(dict.fromkeys(values))
            continue

        value = source.get(field.name, "")
        value = _clean_text(value) if value is not None else ""

        if not value:
            if field.required:
                errors[field.name] = f"{field.label} is required"
            clean[field.name] = ""
            continue

        if len(value) > field.max_length:
            errors[field.name] = f"{field.label} must be {field.max_length} characters or fewer"
        elif field.choices is not None and value not in field.choices:
            errors[field.name] = f"{field.label} must be one of the listed options"
        elif field.kind == "email":
            if len(value) > 254 or not EMAIL_RE.match(value):
                errors[field.name] = f"{field.label} must be a valid email address"
        elif field.kind == "phone":
            digits = re.sub(r"\D", "", value)
            if not PHONE_ALLOWED_RE.match(value) or not 10 <= len(digits) <= 15:
                errors[field.name] = f"{field.label} must be a valid phone number (10–15 digits)"
        elif field.kind in ("date", "past_date"):
            try:
                parsed = date.fromisoformat(value)
                if field.kind == "past_date" and parsed > date.today():
                    errors[field.name] = f"{field.label} can't be in the future"
            except ValueError:
                errors[field.name] = f"{field.label} must be a valid date"
        elif field.kind == "amount":
            number = value.replace(",", "").replace("₹", "").strip()
            try:
                parsed = float(number)
                if parsed < 0 or parsed != parsed or parsed == float("inf"):
                    raise ValueError
                value = number
            except ValueError:
                errors[field.name] = f"{field.label} must be a number, e.g. 2500000"
        elif field.kind == "time":
            if not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", value):
                errors[field.name] = f"{field.label} must be a valid time (HH:MM)"
        elif field.kind == "url":
            value, problem = normalize_url(value)
            if problem:
                errors[field.name] = f"{field.label} {problem}"

        clean[field.name] = value

    return clean, errors
