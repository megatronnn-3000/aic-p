import { CircleCheck, Download, Home, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PrintBrand } from "../components/Brand";
import { Alert, Button } from "../components/ui";
import { formatDateTime } from "../lib/format";
import { allFields } from "../lib/formSchemas";
import { exportElementToPdf } from "../lib/pdf";
import { useToast } from "../lib/toast-context";

const NEXT_STEPS = {
  preincubation: [
    "Our team reviews your application and documents.",
    "Shortlisted applicants are invited to pitch to the evaluation panel — we'll email the date, time and meeting link.",
    "You'll receive the decision by email.",
  ],
  incubation: [
    "The evaluation panel reviews your application and pitch deck.",
    "Shortlisted startups are contacted for a pitch and discussion.",
    "You'll receive the decision by email.",
  ],
  internship: [
    "We review applications and match them with roles at our startups.",
    "Shortlisted candidates are contacted for a short interview.",
    "Selected interns receive an email with next steps.",
  ],
};

const SUMMARY = {
  preincubation: ["name", "email", "contact_number", "startup_name", "sector", "startup_stage"],
  incubation: ["startup_name", "founder_name", "email", "mobile_no", "sector", "incubatee_level"],
  internship: ["name", "email", "phone", "department", "year_of_study", "preferred_role"],
};

export function Receipt({ form, receipt }) {
  const sheetRef = useRef(null);
  const titleRef = useRef(null);
  const toast = useToast();

  useEffect(() => titleRef.current?.focus(), []);
  const [saving, setSaving] = useState(false);
  const fields = Object.fromEntries(allFields(form).map((f) => [f.name, f]));
  const fileLabel = (name) => fields[name]?.label || name;

  const savePdf = async () => {
    setSaving(true);
    try {
      await exportElementToPdf(sheetRef.current, `${receipt.reference} application receipt.pdf`);
    } catch {
      toast.error("The PDF couldn't be created. Use Print and choose “Save as PDF” instead.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container receipt">
      <div className="card receipt__sheet" ref={sheetRef}>
        <PrintBrand />
        <div className="receipt__head">
          <span className="receipt__icon" aria-hidden="true">
            <CircleCheck />
          </span>
          <div>
            <h1 className="receipt__title" tabIndex={-1} ref={titleRef}>
              Application submitted
            </h1>
            <p className="muted">
              {form.title} · {formatDateTime(receipt.submitted_at)}
            </p>
          </div>
        </div>

        <div className="receipt__reference">
          <span>Your reference</span>
          <strong className="tabular">{receipt.reference}</strong>
          <small>Quote this if you contact us about your application.</small>
        </div>

        <dl className="details receipt__details">
          {SUMMARY[form.key].map((name) => (
            <div key={name}>
              <dt>{fields[name].label}</dt>
              <dd>{receipt.values[name] || "—"}</dd>
            </div>
          ))}
        </dl>

        {receipt.files?.length > 0 && (
          <div className="receipt__files">
            <h2>Documents received</h2>
            <ul>
              {receipt.files.map((file) => (
                <li key={file.field}>
                  <span>{fileLabel(file.field)}</span>
                  <span className="muted">{file.original_name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="receipt__next">
          <h2>What happens next</h2>
          <ol>
            {NEXT_STEPS[form.key].map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ol>
        </div>

        <div className="no-print">
          {receipt.email_enabled ? (
            <Alert tone="success">A confirmation has been emailed to {receipt.values.email}.</Alert>
          ) : (
            <Alert tone="info">Save or print this page for your records.</Alert>
          )}
        </div>
      </div>

      <div className="receipt__actions no-print">
        <Button icon={Printer} onClick={() => window.print()}>
          Print
        </Button>
        <Button icon={Download} onClick={savePdf} loading={saving}>
          Download PDF
        </Button>
        <Button as={Link} to="/" variant="dark" icon={Home}>
          Back to home
        </Button>
      </div>
    </div>
  );
}
