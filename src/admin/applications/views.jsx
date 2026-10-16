/**
 * List views over the three application pipelines. Each view filters the same
 * API list and chooses its own columns, so cohort pages (pre-incubated startups,
 * current interns, …) are just different lenses on one data set.
 */
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/ui";
import { formatDate, todayIso } from "../../lib/format";
import options, { PROGRAMS } from "../../lib/options";

const PRE_MAX = options.preIncubationCriteria.length * options.preIncubationScale.length;
const INC_MAX = options.incubationCriteria.length * options.incubationScaleMax;

const href = (program) => (row) => `${PROGRAMS[program].adminBase}/applications/${row.id}`;

function primary(title, subtitle) {
  return function PrimaryCell(row, to) {
    return (
      <div>
        <Link to={to} className="table__primary table-link">
          {row[title] || row.reference}
        </Link>
        {subtitle && <div className="table__secondary">{row[subtitle]}</div>}
      </div>
    );
  };
}

const col = {
  reference: { key: "reference", header: "Ref", className: "nowrap tabular muted" },
  submitted: {
    key: "submitted_at",
    header: "Submitted",
    className: "nowrap",
    render: (row) => formatDate(row.submitted_at),
  },
  status: (program) => ({
    key: "status",
    header: "Status",
    render: (row) => <StatusBadge status={row.status} program={program} />,
  }),
};

function pitchCell(row) {
  if (!row.pitch_date) return <span className="muted">Not scheduled</span>;
  const past = row.pitch_date < todayIso();
  return <span className={past ? "muted nowrap" : "nowrap"}>{formatDate(row.pitch_date)}</span>;
}

function scoreCell(total, max) {
  return total === null || total === undefined ? <span className="muted">—</span> : <span className="tabular">{`${total} / ${max}`}</span>;
}

const PRE_SEARCH = ["startup_name", "name", "founder_name", "email", "reference", "sector"];
const INC_SEARCH = ["startup_name", "founder_name", "email", "reference", "sector", "city"];
const INTERN_SEARCH = ["name", "email", "reference", "department", "preferred_role"];

export const VIEWS = {
  "preincubation/applications": {
    program: "preincubation",
    title: "Pre-Incubation applications",
    description: "Every pre-incubation application. Open one to review documents, schedule a pitch, evaluate and decide.",
    statusTabs: true,
    canCreate: true,
    search: PRE_SEARCH,
    filters: [
      { key: "sector", label: "All sectors" },
      { key: "startup_stage", label: "All stages" },
    ],
    rowHref: href("preincubation"),
    columns: [
      { key: "startup_name", header: "Startup", render: primary("startup_name", "name") },
      col.reference,
      { key: "sector", header: "Sector" },
      { key: "startup_stage", header: "Stage" },
      col.submitted,
      { key: "pitch_date", header: "Pitch", render: pitchCell },
      { key: "evaluation_total", header: "Score", numeric: true, render: (row) => scoreCell(row.evaluation_total, PRE_MAX) },
      col.status("preincubation"),
    ],
  },
  "preincubation/startups": {
    program: "preincubation",
    title: "Pre-incubated startups",
    description: "Startups currently in the pre-incubation program (applications marked “In program”).",
    filter: (row) => row.status === "Approved",
    search: PRE_SEARCH,
    filters: [
      { key: "sector", label: "All sectors" },
      { key: "is_active", label: "Active and inactive", options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] },
    ],
    rowHref: href("preincubation"),
    cohortActions: "preincubation",
    emptyText: "Approve an application to add its startup to the program.",
    columns: [
      { key: "startup_name", header: "Startup", render: primary("startup_name", "founder_name") },
      { key: "sector", header: "Sector" },
      { key: "pitch_date", header: "Pitch", render: pitchCell },
      { key: "evaluation_total", header: "Score", numeric: true, render: (row) => scoreCell(row.evaluation_total, PRE_MAX) },
    ],
  },
  "preincubation/graduated": {
    program: "preincubation",
    title: "Graduated pre-incubated startups",
    description: "Startups that completed the pre-incubation program.",
    filter: (row) => row.status === "Graduated",
    search: PRE_SEARCH,
    filters: [{ key: "sector", label: "All sectors" }],
    rowHref: href("preincubation"),
    emptyText: "Mark a pre-incubated startup as graduated to list it here.",
    columns: [
      { key: "startup_name", header: "Startup", render: primary("startup_name", "founder_name") },
      { key: "sector", header: "Sector" },
      { key: "startup_stage", header: "Stage" },
      {
        key: "certificate_issued",
        header: "Certificate",
        render: (row) => (row.certificate_issued ? "Issued" : <span className="muted">Not issued</span>),
      },
      { key: "updated_at", header: "Last updated", render: (row) => formatDate(row.updated_at) },
    ],
  },
  "incubation/applications": {
    program: "incubation",
    title: "Incubation applications",
    description: "Applications for incubation. Each evaluator scores separately; the average appears here and on the leaderboard.",
    statusTabs: true,
    canCreate: true,
    search: INC_SEARCH,
    filters: [
      { key: "sector", label: "All sectors" },
      { key: "incubatee_level", label: "All levels" },
    ],
    rowHref: href("incubation"),
    columns: [
      { key: "startup_name", header: "Startup", render: primary("startup_name", "founder_name") },
      col.reference,
      { key: "sector", header: "Sector" },
      { key: "incubatee_level", header: "Level" },
      col.submitted,
      {
        key: "eval_avg",
        header: "Avg. score",
        numeric: true,
        render: (row) =>
          row.eval_count ? (
            <span className="tabular nowrap">
              {row.eval_avg} / {INC_MAX}
              <span className="muted"> · {row.eval_count}</span>
            </span>
          ) : (
            <span className="muted">Not evaluated</span>
          ),
      },
      col.status("incubation"),
    ],
  },
  "internship/applications": {
    program: "internship",
    title: "Internship applications",
    description: "Student applications for internships with AIC MUJ startups.",
    statusTabs: true,
    canCreate: true,
    search: INTERN_SEARCH,
    filters: [
      { key: "preferred_role", label: "All roles" },
      { key: "year_of_study", label: "All years" },
    ],
    rowHref: href("internship"),
    columns: [
      { key: "name", header: "Applicant", render: primary("name", "email") },
      col.reference,
      { key: "department", header: "Department" },
      { key: "year_of_study", header: "Year", className: "nowrap" },
      { key: "preferred_role", header: "Role" },
      col.submitted,
      col.status("internship"),
    ],
  },
  "internship/interns": {
    program: "internship",
    title: "Current interns",
    description: "Applicants selected for an internship.",
    filter: (row) => row.status === "Selected",
    search: INTERN_SEARCH,
    filters: [{ key: "preferred_role", label: "All roles" }],
    rowHref: href("internship"),
    cohortActions: "interns",
    emptyText: "Select an applicant to make them a current intern.",
    columns: [
      { key: "name", header: "Intern", render: primary("name", "email") },
      { key: "preferred_role", header: "Role" },
      { key: "department", header: "Department" },
      { key: "phone", header: "Phone", className: "nowrap" },
    ],
  },
  "internship/past": {
    program: "internship",
    title: "Past interns",
    description: "Interns whose internship has been completed.",
    filter: (row) => row.status === "Completed",
    search: INTERN_SEARCH,
    filters: [{ key: "preferred_role", label: "All roles" }],
    rowHref: href("internship"),
    cohortActions: "past",
    emptyText: "Mark a current intern as completed to list them here.",
    columns: [
      { key: "name", header: "Intern", render: primary("name", "email") },
      { key: "preferred_role", header: "Role" },
      { key: "department", header: "Department" },
      { key: "updated_at", header: "Completed", render: (row) => formatDate(row.updated_at) },
    ],
  },
};

/** Columns written to CSV exports, per program. */
export const EXPORT_COLUMNS = {
  preincubation: [
    { key: "reference", label: "Reference" },
    { key: "startup_name", label: "Startup" },
    { key: "name", label: "Applicant" },
    { key: "founder_name", label: "Founder" },
    { key: "email", label: "Email" },
    { key: "contact_number", label: "Phone" },
    { key: "sector", label: "Sector" },
    { key: "startup_stage", label: "Stage" },
    { key: "company_type", label: "Company type" },
    { key: "status", label: "Status" },
    { key: "is_active", label: "Active", value: (r) => (r.is_active ? "Yes" : "No") },
    { key: "certificate_issued", label: "Certificate issued", value: (r) => (r.certificate_issued ? "Yes" : "No") },
    { key: "pitch_date", label: "Pitch date" },
    { key: "evaluation_total", label: "Evaluation score" },
    { key: "submitted_at", label: "Submitted", value: (r) => formatDate(r.submitted_at) },
  ],
  incubation: [
    { key: "reference", label: "Reference" },
    { key: "startup_name", label: "Startup" },
    { key: "founder_name", label: "Founder" },
    { key: "email", label: "Email" },
    { key: "mobile_no", label: "Mobile" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "sector", label: "Sector" },
    { key: "incubatee_level", label: "Level" },
    { key: "status", label: "Status" },
    { key: "eval_count", label: "Evaluations" },
    { key: "eval_avg", label: "Average score" },
    { key: "submitted_at", label: "Submitted", value: (r) => formatDate(r.submitted_at) },
  ],
  internship: [
    { key: "reference", label: "Reference" },
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "department", label: "Department" },
    { key: "year_of_study", label: "Year" },
    { key: "preferred_role", label: "Role" },
    { key: "hosteller_status", label: "Hosteller / day scholar" },
    { key: "willing_late", label: "Willing to stay late" },
    { key: "status", label: "Status" },
    { key: "submitted_at", label: "Submitted", value: (r) => formatDate(r.submitted_at) },
  ],
};
