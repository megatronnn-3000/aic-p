import { ArrowLeft, ArrowRight, Check, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/Dialog";
import { SchemaField } from "../components/SchemaField";
import { Alert, Button } from "../components/ui";
import { upload } from "../lib/api";
import { FORMS, INTERNSHIP_ROLES, allFields, emptyValues, isVisible, validateStep } from "../lib/formSchemas";
import { NotFoundPage } from "./NotFoundPage";
import { Receipt } from "./Receipt";

export function ApplyPage() {
  const { program } = useParams();
  const form = FORMS[program];
  if (!form) return <NotFoundPage />;
  return <ApplicationWizard key={form.key} form={form} />;
}

function loadDraft(key, form) {
  const empty = emptyValues(form);
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && typeof saved === "object") {
      return { values: { ...empty, ...Object.fromEntries(Object.entries(saved).filter(([k]) => k in empty)) }, restored: true };
    }
  } catch {
    /* no usable draft */
  }
  return { values: empty, restored: false };
}

/**
 * Multi-step application form. Staff reuse it (`staff` set) to enter an
 * application on someone's behalf; `onSubmitted` then replaces the receipt.
 */
export function ApplicationWizard({ form, staff = false, backLink, onSubmitted }) {
  const draftKey = `aic.draft.${staff ? "staff." : ""}${form.key}`;
  const [initial] = useState(() => loadDraft(draftKey, form));
  const [values, setValues] = useState(initial.values);
  const [draftNotice, setDraftNotice] = useState(initial.restored);
  const [files, setFiles] = useState({});
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [declared, setDeclared] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const headingRef = useRef(null);
  const firstRender = useRef(true);

  const step = form.steps[stepIndex];
  const isLast = stepIndex === form.steps.length - 1;

  useEffect(() => {
    if (receipt) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(values));
    } catch {
      /* storage full or unavailable: drafts are a convenience only */
    }
  }, [draftKey, values, receipt]);

  // Move focus to the new step's heading so keyboard and screen-reader users follow along.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [stepIndex]);

  const setValue = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const setFile = (name, file) => {
    setFiles((prev) => ({ ...prev, [name]: file }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const focusField = (name) => {
    setTimeout(() => {
      const element =
        document.getElementById(`f-${name}`) || document.querySelector(`[name="${name}"]`)?.closest("fieldset");
      element?.focus();
      element?.scrollIntoView?.({ block: "center" });
    }, 0);
  };

  const goNext = () => {
    const found = validateStep(step, values, files);
    if (Object.keys(found).length) {
      setErrors((prev) => ({ ...prev, ...found }));
      focusField(Object.keys(found)[0]);
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  };

  const startOver = () => {
    clearDraft();
    setValues(emptyValues(form));
    setFiles({});
    setErrors({});
    setDraftNotice(false);
    setStepIndex(0);
  };

  const submit = async (confirmDuplicate = false) => {
    for (let index = 0; index < form.steps.length; index += 1) {
      const found = validateStep(form.steps[index], values, files);
      if (Object.keys(found).length) {
        setErrors(found);
        setStepIndex(index);
        focusField(Object.keys(found)[0]);
        return;
      }
    }
    if (!declared) {
      setErrors({ __declaration: "Please confirm the declaration to submit." });
      focusField("declaration");
      return;
    }

    const data = new FormData();
    allFields(form).forEach((field) => {
      if (field.type === "file") {
        if (files[field.name] && isVisible(field, values)) data.append(field.name, files[field.name]);
        return;
      }
      const value = isVisible(field, values) ? values[field.name] : "";
      if (Array.isArray(value)) value.forEach((item) => data.append(field.name, item));
      else data.append(field.name, value ?? "");
    });
    if (confirmDuplicate) data.append("confirm_duplicate", "1");

    setSubmitting(true);
    setSubmitError("");
    setProgress(0);
    try {
      const result = await upload(`/api/apply/${form.slug}`, data, { auth: staff, onProgress: setProgress });
      clearDraft();
      if (onSubmitted) {
        onSubmitted(result);
        return;
      }
      setReceipt({ ...result, values: { ...values } });
      window.scrollTo({ top: 0 });
    } catch (error) {
      if (error.status === 409 && error.data?.duplicate) {
        setDuplicateOpen(true);
      } else if (error.status === 422 && Object.keys(error.fields).length) {
        setErrors(error.fields);
        const firstField = Object.keys(error.fields)[0];
        const target = form.steps.findIndex((s) => s.fields.some((f) => f.name === firstField));
        if (target >= 0) setStepIndex(target);
        setSubmitError(error.message);
        focusField(firstField);
      } else {
        setSubmitError(error.message);
      }
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  if (receipt) return <Receipt form={form} receipt={receipt} />;

  const stepHasErrors = (s) => s.fields.some((f) => errors[f.name]);

  return (
    <div className={`apply ${staff ? "apply--staff" : "container"}`}>
      <aside className="apply__aside">
        <Link to={backLink?.to || "/#programs"} className="page-header__eyebrow">
          <ArrowLeft aria-hidden="true" />
          {backLink?.label || "All programs"}
        </Link>
        <h1 className="apply__title">{form.title}</h1>
        <p className="apply__intro">{form.intro}</p>

        <nav aria-label="Application steps" className="stepper">
          <ol>
            {form.steps.map((s, index) => {
              const state = index < stepIndex ? "done" : index === stepIndex ? "current" : "upcoming";
              return (
                <li key={s.id} className={`stepper__item is-${state} ${stepHasErrors(s) ? "has-error" : ""}`}>
                  <button
                    type="button"
                    onClick={() => index < stepIndex && setStepIndex(index)}
                    disabled={index > stepIndex || submitting}
                    aria-current={state === "current" ? "step" : undefined}
                  >
                    <span className="stepper__dot" aria-hidden="true">
                      {state === "done" ? <Check /> : index + 1}
                    </span>
                    <span className="stepper__label">{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {form.key === "internship" && (
          <details className="roles">
            <summary>Roles you can apply for</summary>
            <ul>
              {INTERNSHIP_ROLES.map((role) => (
                <li key={role.title}>
                  <strong>{role.title}</strong>
                  <span>{role.text}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </aside>

      <form
        className="apply__main card"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (isLast) submit(false);
          else goNext();
        }}
      >
        <div className="apply__progress" aria-hidden="true">
          <span style={{ width: `${((stepIndex + 1) / form.steps.length) * 100}%` }} />
        </div>
        <div className="card__body apply__body">
          <p className="apply__step-count">
            Step {stepIndex + 1} of {form.steps.length}
          </p>
          <h2 className="apply__step-title" tabIndex={-1} ref={headingRef}>
            {step.title}
          </h2>
          {step.description && <p className="apply__step-description">{step.description}</p>}

          {draftNotice && stepIndex === 0 && (
            <div className="apply__notice">
              <Alert
                tone="info"
                action={
                  <button type="button" className="link-button" onClick={startOver}>
                    Start over
                  </button>
                }
              >
                We restored your unfinished answers from this device. Attached files need to be added again.
              </Alert>
            </div>
          )}

          <div className="form-grid">
            {step.fields
              .filter((field) => isVisible(field, values))
              .map((field) => (
                <SchemaField
                  key={field.name}
                  field={field}
                  value={field.type === "file" ? files[field.name] : values[field.name]}
                  values={values}
                  onChange={(value) => (field.type === "file" ? setFile(field.name, value) : setValue(field.name, value))}
                  error={errors[field.name]}
                  disabled={submitting}
                />
              ))}
          </div>

          {isLast && (
            <div className="apply__declaration">
              <label className="checkbox">
                <input
                  id="f-declaration"
                  type="checkbox"
                  checked={declared}
                  disabled={submitting}
                  aria-invalid={errors.__declaration ? true : undefined}
                  aria-describedby={errors.__declaration ? "declaration-error" : undefined}
                  onChange={(e) => {
                    setDeclared(e.target.checked);
                    setErrors((prev) => ({ ...prev, __declaration: undefined }));
                  }}
                />
                <span>
                  {staff
                    ? "I'm entering this application on the applicant's behalf, with their consent. They'll receive the confirmation email."
                    : "I confirm the information in this application is accurate, and I agree to AIC MUJ contacting me about it."}
                </span>
              </label>
              {errors.__declaration && (
                <p className="field__error" id="declaration-error">
                  {errors.__declaration}
                </p>
              )}
            </div>
          )}

          {submitError && (
            <div className="apply__notice">
              <Alert tone="error" title="Your application wasn't submitted">
                {submitError}
              </Alert>
            </div>
          )}
        </div>

        <div className="apply__footer">
          {stepIndex > 0 ? (
            <Button icon={ArrowLeft} onClick={() => setStepIndex((i) => i - 1)} disabled={submitting}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {isLast ? (
            <Button type="submit" variant="primary" size="lg" icon={Send} loading={submitting}>
              {submitting
                ? progress !== null && progress < 100
                  ? `Uploading ${progress}%`
                  : "Submitting…"
                : "Submit application"}
            </Button>
          ) : (
            <Button type="submit" variant="primary" size="lg">
              Continue
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={duplicateOpen}
        onClose={() => setDuplicateOpen(false)}
        title="You've applied before"
        description={`We already have a ${form.title.toLowerCase()} from ${values.email}. Submit this one as a new application anyway?`}
        confirmLabel="Submit anyway"
        onConfirm={() => {
          setDuplicateOpen(false);
          return submit(true);
        }}
      />
    </div>
  );
}
