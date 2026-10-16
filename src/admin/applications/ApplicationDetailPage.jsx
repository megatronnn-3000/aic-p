import {
  Building2,
  ClipboardCheck,
  Download,
  FileArchive,
  Mail,
  Phone,
  Plus,
  Printer,
  Trash2,
  Users,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { PrintBrand } from "../../components/Brand";
import { ConfirmDialog } from "../../components/Dialog";
import { FileList } from "../../components/FileList";
import { TextField } from "../../components/fields";
import { Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, StatusBadge, Switch } from "../../components/ui";
import { api, downloadFile } from "../../lib/api";
import { formatDate, formatDateTime, formatTime, safeUrl } from "../../lib/format";
import { FORMS_BY_KEY, allFields, isVisible } from "../../lib/formSchemas";
import options, { PROGRAMS } from "../../lib/options";
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

function RecordSections({ form, record }) {
  return form.steps.map((step) => {
    const fields = step.fields.filter((f) => f.type !== "file" && isVisible(f, record));
    if (!fields.length) return null;
    return (
      <Card key={step.id} title={step.title}>
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
      </Card>
    );
  });
}

export function ApplicationDetailPage({ program: programKey }) {
  const { id } = useParams();
  const program = PROGRAMS[programKey];
  const form = FORMS_BY_KEY[programKey];
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshCounts } = useOutletContext() || {};
  const { data: record, error, loading, reload, setData } = useApi(`/api/admin/${programKey}/applications/${id}`);
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
              Print
            </Button>
            <Button iconOnly icon={Download} onClick={savePdf} loading={pdfBusy}>
              Download PDF
            </Button>
          </>
        }
      />

      <div className="detail-grid">
        <div className="detail-main stack" ref={printRef}>
          <div className="print-only">
            <PrintBrand />
            <h1 className="print-title">
              {title} <span className="muted">· {record.reference}</span>
            </h1>
          </div>
          <RecordSections form={form} record={record} />
        </div>

        <aside className="detail-aside stack no-print">
          {programKey === "preincubation" && <PitchCard record={record} onSave={patch} />}
          {programKey === "preincubation" && <PreEvaluationCard record={record} />}
          {programKey === "incubation" && <IncubationEvaluationsCard record={record} onChanged={reload} />}
          {programKey === "preincubation" && ["Approved", "Graduated"].includes(record.status) && (
            <Card title="Program">
              <div className="stack">
                <Switch
                  checked={record.is_active}
                  label="Active in the program"
                  onChange={(value) => patch({ is_active: value }, `Marked ${value ? "active" : "inactive"}.`).catch(() => {})}
                />
                <Switch
                  checked={record.certificate_issued}
                  label="Certificate issued"
                  onChange={(value) =>
                    patch({ certificate_issued: value }, value ? "Certificate marked as issued." : "Certificate marked as not issued.").catch(() => {})
                  }
                />
              </div>
            </Card>
          )}
          {programKey === "incubation" && record.status === "Approved" && (
            <Card title="Incubation record">
              <p className="muted" style={{ marginBottom: 12 }}>
                Create the startup's incubation record, pre-filled from this application.
              </p>
              <Button as={Link} to={`/admin/incubation/startups/new?from=${record.id}`} icon={Building2} block>
                Create startup record
              </Button>
            </Card>
          )}

          <DocumentsCard
            files={record.files}
            labels={fileLabels}
            zipPath={`/api/admin/${programKey}/applications/${id}/documents.zip`}
            zipName={`${record.reference} documents.zip`}
          />

          <Card title="Delete application" className="danger-card">
            <p className="muted" style={{ marginBottom: 12 }}>
              Permanently removes this application{programKey === "incubation" ? ", its documents and evaluations" : " and its documents"}.
            </p>
            <Button variant="danger-ghost" icon={Trash2} onClick={() => setDeleting(true)}>
              Delete application
            </Button>
          </Card>
        </aside>
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
        description="This permanently deletes the application and all of its documents. It can't be undone."
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

export function DocumentsCard({ files, labels, zipPath, zipName, onDelete, emptyText = "No documents were attached." }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Card
      title="Documents"
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
