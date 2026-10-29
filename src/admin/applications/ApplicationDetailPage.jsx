import {
  Building2,
  ClipboardCheck,
  Download,
  FileArchive,
  FileBadge,
  Files,
  HandCoins,
  Mail,
  Mic,
  Phone,
  Plus,
  Printer,
  Trash2,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { AicDocuments } from "../../components/AicDocuments";
import { PrintBrand } from "../../components/Brand";
import { ConfirmDialog } from "../../components/Dialog";
import { FileList } from "../../components/FileList";
import { StartupSupport } from "../../components/StartupSupport";
import { TabBar } from "../../components/TabBar";
import { TextField } from "../../components/fields";
import { Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, StatusBadge, Switch } from "../../components/ui";
import { api, downloadFile } from "../../lib/api";
import { formatAmount, formatDate, formatDateTime, formatTime, safeUrl } from "../../lib/format";
import { FORMS_BY_KEY, allFields, isVisible } from "../../lib/formSchemas";
import options, { PROGRAMS, STATUS_LABEL } from "../../lib/options";
import { exportElementToPdf } from "../../lib/pdf";
import { useToast } from "../../lib/toast-context";
import { useApi } from "../../lib/useApi";

const TRANSITIONS = {
  preincubation: {
    Pending: [
      { to: "Approved", label: "Approve", variant: "primary", description: "The startup joins the pre-incubation program." },
      { to: "Rejected", label: "Reject", description: "The application is closed." },
    ],
    Approved: [
      { to: "Graduated", label: "Mark graduated", variant: "primary", description: "The startup moves to Graduated." },
      { to: "Pending", label: "Move back to review" },
    ],
    Graduated: [{ to: "Approved", label: "Move back to program" }],
    Rejected: [{ to: "Pending", label: "Reopen review" }],
  },
  incubation: {
    Pending: [
      { to: "Approved", label: "Accept", variant: "primary", description: "The startup is accepted for incubation." },
      { to: "Rejected", label: "Reject", description: "The application is closed." },
    ],
    Approved: [{ to: "Pending", label: "Move back to review" }],
    Rejected: [{ to: "Pending", label: "Reopen review" }],
  },
  internship: {
    Applied: [
      { to: "Selected", label: "Select", variant: "primary", description: "The applicant becomes a current intern." },
      { to: "Rejected", label: "Not selected", description: "The application is closed." },
    ],
    Selected: [
      { to: "Completed", label: "Mark completed", variant: "primary", description: "They move to Past interns." },
      { to: "Applied", label: "Move back to review" },
    ],
    Completed: [{ to: "Selected", label: "Move back to current" }],
    Rejected: [{ to: "Applied", label: "Reopen review" }],
  },
};

// Status changes that send the applicant an email (mirrors backend notifications.py).
const EMAILED = {
  preincubation: ["Approved", "Rejected", "Graduated"],
  incubation: ["Approved", "Rejected"],
  internship: ["Selected", "Rejected"],
};

// Key facts shown on the Overview tab.
const SUMMARY_FIELDS = {
  preincubation: ["startup_name", "name", "founder_name", "email", "contact_number", "sector", "startup_stage", "company_type"],
  incubation: ["startup_name", "founder_name", "email", "mobile_no", "sector", "incubatee_level", "city", "state"],
  internship: ["name", "email", "phone", "department", "year_of_study", "preferred_role", "hosteller_status", "willing_late"],
};

function displayValue(field, value) {
  if (value === undefined || value === null || value === "") return null;
  if (field.type === "date") return formatDate(value);
  if (field.type === "url") {
    const url = safeUrl(value);
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {value}
      </a>
    ) : (
      value
    );
  }
  return value;
}

function sectionFields(step, record) {
  return step.fields.filter((f) => f.type !== "file" && isVisible(f, record));
}

function FieldList({ fields, record }) {
  return (
    <dl className="details">
      {fields.map((field) => {
        const value = displayValue(field, record[field.name]);
        // Long answers get a full row; short or empty ones share rows.
        const raw = String(record[field.name] || "");
        const wide = field.type === "textarea" ? raw.length > 60 : field.wide && raw.length > 40;
        return (
          <div key={field.name} className={wide ? "is-wide" : undefined}>
            <dt>{field.label}</dt>
            <dd className={value ? undefined : "is-empty"}>{value || "Not provided"}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function SectionCard({ step, record }) {
  return (
    <Card title={step.title}>
      <FieldList fields={sectionFields(step, record)} record={record} />
    </Card>
  );
}

/** Pre-incubated (or graduated) startups track their investors and mentors. */
function inProgram(programKey, record) {
  return programKey === "preincubation" && ["Approved", "Graduated"].includes(record.status);
}

function buildTabs(programKey, form, record) {
  const tabs = [{ id: "overview", label: "Overview" }];
  form.steps.forEach((step) => {
    if (sectionFields(step, record).length) tabs.push({ id: step.id, label: step.title, step });
  });
  tabs.push({ id: "documents", label: "Submitted documents", count: record.files.length });
  if (programKey === "preincubation") tabs.push({ id: "pitch", label: "Pitch" }, { id: "evaluation", label: "Evaluation" });
  if (inProgram(programKey, record)) {
    tabs.push({ id: "investors", label: "Investors", count: record.investors.length }, { id: "mentors", label: "Mentors", count: record.mentors.length });
  }
  if (programKey === "incubation") tabs.push({ id: "evaluations", label: "Evaluations", count: record.eval_count });
  tabs.push({ id: "aic", label: "Issued by AIC", count: record.aic_documents.length });
  return tabs;
}

export function ApplicationDetailPage({ program: programKey }) {
  const { id } = useParams();
  const program = PROGRAMS[programKey];
  const form = FORMS_BY_KEY[programKey];
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { refreshCounts } = useOutletContext() || {};
  const { data: loaded, error, loading, reload, setData } = useApi(`/api/admin/${programKey}/applications/${id}`);
  // Older API versions don't send these lists; never let a missing field crash the page.
  const record = loaded && { ...loaded, files: loaded.files || [], aic_documents: loaded.aic_documents || [], evaluations: loaded.evaluations || [], investors: loaded.investors || [], mentors: loaded.mentors || [] };
  const [transition, setTransition] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const printRef = useRef(null);

  if (error && !record) {
    return <ErrorState error={error} onRetry={reload} title={error.status === 404 ? "Application not found" : undefined} />;
  }
  if (loading && !record) return <LoadingBlock label="Loading application…" />;

  const listPath = `${program.adminBase}/applications`;
  const title = record.startup_name || record.name;
  const fileLabels = Object.fromEntries(allFields(form).map((f) => [f.name, f.label]));
  const phone = record.contact_number || record.mobile_no || record.phone;
  const tabs = buildTabs(programKey, form, record);
  const activeTab = tabs.some((t) => t.id === params.get("tab")) ? params.get("tab") : "overview";
  const current = tabs.find((t) => t.id === activeTab);

  const selectTab = (tabId) => {
    const next = new URLSearchParams(params);
    if (tabId === "overview") next.delete("tab");
    else next.set("tab", tabId);
    setParams(next, { replace: true });
  };

  const patch = async (changes, message) => {
    try {
      const updated = await api(`/api/admin/${programKey}/applications/${id}`, { method: "PATCH", json: changes });
      setData(updated);
      refreshCounts?.();
      toast.success(updated.email_sent ? `${message} The applicant has been emailed.` : message);
      return updated;
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  const savePdf = async () => {
    setPdfBusy(true);
    try {
      await exportElementToPdf(printRef.current, `${record.reference} ${title}.pdf`);
    } catch {
      toast.error("The PDF couldn't be created. Use Print and choose “Save as PDF” instead.");
    } finally {
      setPdfBusy(false);
    }
  };

  let panel;
  if (activeTab === "overview") {
    panel = (
      <Overview
        programKey={programKey}
        form={form}
        record={record}
        onSelectTab={selectTab}
        onPatch={patch}
        onDelete={() => setDeleting(true)}
      />
    );
  } else if (current?.step) {
    panel = <SectionCard step={current.step} record={record} />;
  } else if (activeTab === "documents") {
    panel = (
      <DocumentsCard
        title="Submitted documents"
        files={record.files}
        labels={fileLabels}
        zipPath={`/api/admin/${programKey}/applications/${id}/documents.zip`}
        zipName={`${record.reference} documents.zip`}
      />
    );
  } else if (activeTab === "pitch") {
    panel = <PitchCard record={record} onSave={patch} />;
  } else if (activeTab === "evaluation") {
    panel = <PreEvaluationCard record={record} />;
  } else if (activeTab === "evaluations") {
    panel = <IncubationEvaluationsCard record={record} onChanged={reload} />;
  } else if (activeTab === "investors" || activeTab === "mentors") {
    panel = (
      <StartupSupport
        key={activeTab}
        kind={activeTab}
        ownerType={programKey}
        ownerId={record.id}
        entries={record[activeTab]}
        onChange={(list) => setData((prev) => ({ ...prev, [activeTab]: list }))}
      />
    );
  } else if (activeTab === "aic") {
    panel = (
      <AicDocuments
        ownerType={programKey}
        ownerId={record.id}
        documents={record.aic_documents}
        recipient={record.email}
        onChange={(list) => setData((prev) => ({ ...prev, aic_documents: list }))}
      />
    );
  }

  return (
    <>
      <PageHeader
        back={{ to: listPath, label: `${program.name} applications` }}
        title={title}
        meta={
          <>
            <StatusBadge status={record.status} program={programKey} />
            <span className="tabular">{record.reference}</span>
            <span>Submitted {formatDateTime(record.submitted_at)}</span>
            <a href={`mailto:${record.email}`} className="meta-link">
              <Mail aria-hidden="true" />
              {record.email}
            </a>
            {phone && (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="meta-link">
                <Phone aria-hidden="true" />
                {phone}
              </a>
            )}
          </>
        }
        actions={
          <>
            {(TRANSITIONS[programKey][record.status] || []).map((t) => (
              <Button key={t.to} variant={t.variant} onClick={() => setTransition(t)}>
                {t.label}
              </Button>
            ))}
            <Button iconOnly icon={Printer} onClick={() => window.print()}>
              Print full application
            </Button>
            <Button iconOnly icon={Download} onClick={savePdf} loading={pdfBusy}>
              Download full application as PDF
            </Button>
          </>
        }
      />

      <TabBar tabs={tabs} active={activeTab} onSelect={selectTab} label="Application sections" idPrefix="app" />
      <div className="tab-panel no-print" role="tabpanel" id="app-panel" aria-labelledby={`app-tab-${activeTab}`}>
        {panel}
      </div>

      {/* The complete application for Print / PDF, whichever tab is open.
          Kept off-screen (not display:none) so the PDF renderer can draw it. */}
      <div className="print-record" ref={printRef} aria-hidden="true" inert>
        <PrintBrand />
        <h1 className="print-title">
          {title} <span className="muted">· {record.reference}</span>
        </h1>
        <p className="print-meta">
          {STATUS_LABEL[programKey][record.status] || record.status} · Submitted {formatDateTime(record.submitted_at)}
        </p>
        <div className="stack">
          {form.steps
            .filter((step) => sectionFields(step, record).length)
            .map((step) => (
              <SectionCard key={step.id} step={step} record={record} />
            ))}
          {record.files.length > 0 && (
            <Card title="Submitted documents">
              <ul className="print-files">
                {record.files.map((f) => (
                  <li key={f.id}>
                    <strong>{fileLabels[f.field] || f.field}:</strong> {f.original_name}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {transition && (
        <ConfirmDialog
          open
          onClose={() => setTransition(null)}
          title={`${transition.label}: ${title}?`}
          description={transition.description}
          confirmLabel={transition.label}
          checkboxLabel={EMAILED[programKey].includes(transition.to) ? `Email ${record.email} about this decision` : undefined}
          onConfirm={(notify) =>
            patch(
              { status: transition.to, notify: EMAILED[programKey].includes(transition.to) && Boolean(notify) },
              `Status changed to “${transition.label}”.`,
            )
          }
        />
      )}

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete ${title}?`}
        description="This permanently deletes the application and all of its documents, including those issued by AIC. It can't be undone."
        confirmLabel="Delete permanently"
        tone="danger"
        onConfirm={async () => {
          try {
            await api(`/api/admin/${programKey}/applications/${id}`, { method: "DELETE" });
            refreshCounts?.();
            toast.success(`${title} was deleted.`);
            navigate(listPath, { replace: true });
          } catch (err) {
            toast.error(err.message);
            throw err;
          }
        }}
      />
    </>
  );
}

function OverviewTile({ icon: Icon, label, value, hint, onClick }) {
  return (
    <button type="button" className="overview-tile" onClick={onClick}>
      <span className="overview-tile__label">
        <Icon aria-hidden="true" />
        {label}
      </span>
      <span className="overview-tile__value">{value}</span>
      {hint && <span className="overview-tile__hint">{hint}</span>}
    </button>
  );
}

function Overview({ programKey, form, record, onSelectTab, onPatch, onDelete }) {
  const fields = allFields(form);
  const summary = SUMMARY_FIELDS[programKey].map((name) => fields.find((f) => f.name === name)).filter(Boolean);
  const emailedCount = record.aic_documents.filter((d) => d.emailed_at).length;
  const raised = record.investors.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const activeMentors = record.mentors.filter((m) => m.status !== "Completed").length;
  const preMax = options.preIncubationCriteria.length * options.preIncubationScale.length;
  const incMax = options.incubationCriteria.length * options.incubationScaleMax;

  return (
    <div className="stack">
      <div className="overview-tiles">
        <OverviewTile
          icon={Files}
          label="Submitted documents"
          value={record.files.length}
          hint={record.files.length ? "View and download" : "None attached"}
          onClick={() => onSelectTab("documents")}
        />
        {programKey === "preincubation" && (
          <OverviewTile
            icon={Mic}
            label="Pitch"
            value={record.pitch_date ? formatDate(record.pitch_date) : "Not scheduled"}
            hint={record.pitch_time ? formatTime(record.pitch_time) : "Schedule a pitch"}
            onClick={() => onSelectTab("pitch")}
          />
        )}
        {programKey === "preincubation" && (
          <OverviewTile
            icon={ClipboardCheck}
            label="Evaluation"
            value={record.evaluation ? `${record.evaluation_total} / ${preMax}` : "Not evaluated"}
            hint={record.evaluation?.finalRecommendation || (record.evaluation ? "No recommendation" : "Start the evaluation")}
            onClick={() => onSelectTab("evaluation")}
          />
        )}
        {programKey === "incubation" && (
          <OverviewTile
            icon={Users}
            label="Evaluations"
            value={record.eval_count ? `${record.eval_avg} / ${incMax}` : "None yet"}
            hint={
              record.eval_count
                ? `Average of ${record.eval_count} evaluator${record.eval_count === 1 ? "" : "s"}`
                : "Add the first evaluation"
            }
            onClick={() => onSelectTab("evaluations")}
          />
        )}
        {inProgram(programKey, record) && (
          <OverviewTile
            icon={HandCoins}
            label="Investors"
            value={record.investors.length || "None yet"}
            hint={raised ? `${formatAmount(raised)} raised` : "Record an investment"}
            onClick={() => onSelectTab("investors")}
          />
        )}
        {inProgram(programKey, record) && (
          <OverviewTile
            icon={UserRoundCheck}
            label="Mentors"
            value={record.mentors.length || "None yet"}
            hint={record.mentors.length ? `${activeMentors} active` : "Assign a mentor"}
            onClick={() => onSelectTab("mentors")}
          />
        )}
        <OverviewTile
          icon={FileBadge}
          label="Issued by AIC"
          value={record.aic_documents.length}
          hint={record.aic_documents.length ? `${emailedCount} emailed` : "Letters & certificates"}
          onClick={() => onSelectTab("aic")}
        />
      </div>

      <Card title="Summary" subtitle="Key details — use the buttons above to open each section of the application.">
        <FieldList fields={summary} record={record} />
      </Card>

      {programKey === "preincubation" && ["Approved", "Graduated"].includes(record.status) && (
        <Card title="Program">
          <div className="row row--wrap" style={{ gap: 24 }}>
            <Switch
              checked={record.is_active}
              label="Active in the program"
              onChange={(value) => onPatch({ is_active: value }, `Marked ${value ? "active" : "inactive"}.`).catch(() => {})}
            />
            <Switch
              checked={record.certificate_issued}
              label="Certificate issued"
              onChange={(value) =>
                onPatch(
                  { certificate_issued: value },
                  value ? "Certificate marked as issued." : "Certificate marked as not issued.",
                ).catch(() => {})
              }
            />
          </div>
        </Card>
      )}

      {programKey === "incubation" && record.status === "Approved" && (
        <Card title="Incubation record">
          <div className="row row--wrap overview-row">
            <p className="muted">Create the startup's incubation record, pre-filled from this application.</p>
            <Button as={Link} to={`/admin/incubation/startups/new?from=${record.id}`} icon={Building2}>
              Create startup record
            </Button>
          </div>
        </Card>
      )}

      <Card title="Delete application" className="danger-card">
        <div className="row row--wrap overview-row">
          <p className="muted">
            Permanently removes this application
            {programKey === "incubation" ? ", its documents and evaluations" : " and its documents"}.
          </p>
          <Button variant="danger-ghost" icon={Trash2} onClick={onDelete}>
            Delete application
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function DocumentsCard({ title = "Documents", files, labels, zipPath, zipName, onDelete, emptyText = "No documents were attached." }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Card
      title={title}
      subtitle={files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : undefined}
      actions={
        files.length > 1 && (
          <Button
            size="sm"
            icon={FileArchive}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await downloadFile(zipPath, zipName);
              } catch (err) {
                toast.error(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Download all
          </Button>
        )
      }
    >
      {files.length ? <FileList files={files} labels={labels} onDelete={onDelete} /> : <p className="muted">{emptyText}</p>}
    </Card>
  );
}

function PitchCard({ record, onSave }) {
  const [values, setValues] = useState({
    pitch_date: record.pitch_date || "",
    pitch_time: record.pitch_time || "",
    pitch_link: record.pitch_link || "",
  });
  const [notify, setNotify] = useState(true);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const scheduled = Boolean(record.pitch_date);
  const link = safeUrl(record.pitch_link);

  const save = async (event) => {
    event.preventDefault();
    if (!values.pitch_date) {
      setErrors({ pitch_date: "Choose a date for the pitch" });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await onSave({ ...values, notify_pitch: notify }, "Pitch schedule saved.");
    } catch (err) {
      setErrors(err.fields || {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Evaluation pitch" subtitle={scheduled ? `${formatDate(record.pitch_date)}${record.pitch_time ? ` at ${formatTime(record.pitch_time)}` : ""}` : "Not scheduled yet"}>
      {link && (
        <p style={{ marginBottom: 12 }}>
          <a href={link} target="_blank" rel="noopener noreferrer">
            Open meeting link
          </a>
        </p>
      )}
      <form className="stack" onSubmit={save} noValidate>
        <div className="form-grid form-grid--tight">
          <TextField
            label="Date"
            type="date"
            value={values.pitch_date}
            onChange={(e) => setValues((v) => ({ ...v, pitch_date: e.target.value }))}
            error={errors.pitch_date}
            disabled={busy}
          />
          <TextField
            label="Time"
            type="time"
            value={values.pitch_time}
            onChange={(e) => setValues((v) => ({ ...v, pitch_time: e.target.value }))}
            error={errors.pitch_time}
            disabled={busy}
          />
          <TextField
            label="Meeting link"
            className="form-grid__wide"
            placeholder="https://meet.google.com/…"
            inputMode="url"
            value={values.pitch_link}
            onChange={(e) => setValues((v) => ({ ...v, pitch_link: e.target.value }))}
            error={errors.pitch_link}
            disabled={busy}
          />
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={busy} />
          <span>Email the schedule to {record.email}</span>
        </label>
        <Button type="submit" loading={busy}>
          {scheduled ? "Update schedule" : "Schedule pitch"}
        </Button>
      </form>
    </Card>
  );
}

function PreEvaluationCard({ record }) {
  const evaluation = record.evaluation;
  const max = options.preIncubationCriteria.length * options.preIncubationScale.length;
  const path = `/admin/pre-incubation/applications/${record.id}/evaluation`;
  return (
    <Card title="Evaluation">
      {evaluation ? (
        <div className="stack">
          <div className="score-summary">
            <span className="score-summary__value tabular">{record.evaluation_total}</span>
            <span className="muted">/ {max}</span>
          </div>
          <dl className="details">
            <div>
              <dt>Recommendation</dt>
              <dd className={evaluation.finalRecommendation ? undefined : "is-empty"}>{evaluation.finalRecommendation || "Not given"}</dd>
            </div>
            <div>
              <dt>Evaluator</dt>
              <dd className={evaluation.evaluatorName ? undefined : "is-empty"}>{evaluation.evaluatorName || "Not named"}</dd>
            </div>
          </dl>
          <Button as={Link} to={path} icon={ClipboardCheck}>
            Open evaluation sheet
          </Button>
        </div>
      ) : (
        <div className="stack">
          <p className="muted">No evaluation has been recorded yet.</p>
          <Button as={Link} to={path} variant="primary" icon={ClipboardCheck}>
            Start evaluation
          </Button>
        </div>
      )}
    </Card>
  );
}

function IncubationEvaluationsCard({ record, onChanged }) {
  const toast = useToast();
  const [deleting, setDeleting] = useState(null);
  const max = options.incubationCriteria.length * options.incubationScaleMax;
  const base = `/admin/incubation/applications/${record.id}`;
  return (
    <Card
      title="Evaluations"
      subtitle={record.eval_count ? `Average ${record.eval_avg} / ${max} from ${record.eval_count} evaluator${record.eval_count === 1 ? "" : "s"}` : "Not evaluated yet"}
      bodyClassName={null}
    >
      {record.evaluations.length === 0 ? (
        <EmptyState icon={Users} title="No evaluations yet">
          Each panel member records their own scores.
        </EmptyState>
      ) : (
        <ul className="evaluator-list">
          {record.evaluations.map((entry) => (
            <li key={entry.id}>
              <Link to={`${base}/evaluations/${entry.id}`} className="evaluator-list__main">
                <span className="table__primary">{entry.evaluator_name}</span>
                <span className="table__secondary">Updated {formatDate(entry.updated_at)}</span>
              </Link>
              <span className="tabular evaluator-list__score">
                {entry.total}
                <span className="muted"> / {max}</span>
              </span>
              <Button size="sm" variant="danger-ghost" iconOnly icon={Trash2} onClick={() => setDeleting(entry)}>
                Delete {entry.evaluator_name}'s evaluation
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="card__footer" style={{ justifyContent: "stretch" }}>
        {record.evaluations.length > 0 && (
          <Button as={Link} to={`${base}/report`} style={{ flex: 1 }}>
            Combined report
          </Button>
        )}
        <Button as={Link} to={`${base}/evaluations/new`} variant="primary" icon={Plus} style={{ flex: 1 }}>
          Add evaluation
        </Button>
      </div>
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={deleting ? `Delete ${deleting.evaluator_name}'s evaluation?` : ""}
        description="Their scores and comments are removed and the average is recalculated."
        confirmLabel="Delete evaluation"
        tone="danger"
        onConfirm={async () => {
          try {
            await api(`/api/admin/incubation/evaluations/${deleting.id}`, { method: "DELETE" });
            toast.success("Evaluation deleted.");
            onChanged();
          } catch (err) {
            toast.error(err.message);
            throw err;
          }
        }}
      />
    </Card>
  );
}
