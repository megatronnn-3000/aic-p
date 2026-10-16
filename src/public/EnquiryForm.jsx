import { Send } from "lucide-react";
import { useState } from "react";
import { SelectField, TextAreaField, TextField } from "../components/fields";
import { Alert, Button } from "../components/ui";
import { api } from "../lib/api";
import { validateField } from "../lib/formSchemas";
import options from "../lib/options";

const FIELDS = [
  { name: "program", label: "Program", type: "select", required: true },
  { name: "name", label: "Your name", required: true, maxLength: 120 },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "message", label: "Message", type: "textarea", required: true, maxLength: 2000 },
];

const EMPTY = { program: "", name: "", email: "", phone: "", message: "", company_website: "" };

export function EnquiryForm() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ state: "idle", message: "" });

  const set = (name) => (event) => {
    const value = event.target.value;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = {};
    FIELDS.forEach((field) => {
      const message = validateField(field, values[field.name], values);
      if (message) found[field.name] = message;
    });
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(`enq-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setStatus({ state: "sending", message: "" });
    try {
      await api("/api/enquiries", { method: "POST", json: values, auth: false });
      setValues(EMPTY);
      setStatus({ state: "sent", message: "" });
    } catch (error) {
      if (error.fields) setErrors(error.fields);
      setStatus({ state: "error", message: error.message });
    }
  };

  if (status.state === "sent") {
    return (
      <div className="card card__body enquire__form">
        <Alert tone="success" title="Message sent">
          Thank you — the AIC MUJ team will reply to you by email.
        </Alert>
        <Button className="enquire__again" onClick={() => setStatus({ state: "idle", message: "" })}>
          Send another message
        </Button>
      </div>
    );
  }

  const sending = status.state === "sending";
  return (
    <form className="card card__body enquire__form" onSubmit={submit} noValidate>
      <div className="form-grid">
        <SelectField
          id="enq-program"
          label="Program"
          required
          value={values.program}
          onChange={set("program")}
          error={errors.program}
          disabled={sending}
          placeholder="Which program is this about?"
          options={Object.entries(options.enquiryPrograms).map(([value, label]) => ({ value, label }))}
          className="form-grid__wide"
        />
        <TextField id="enq-name" label="Your name" required autoComplete="name" value={values.name} onChange={set("name")} error={errors.name} disabled={sending} />
        <TextField id="enq-email" label="Email" type="email" required autoComplete="email" value={values.email} onChange={set("email")} error={errors.email} disabled={sending} />
        <TextField id="enq-phone" label="Phone" type="tel" optional autoComplete="tel" value={values.phone} onChange={set("phone")} error={errors.phone} disabled={sending} className="form-grid__wide" />
        <TextAreaField id="enq-message" label="Message" required rows={4} maxLength={2000} value={values.message} onChange={set("message")} error={errors.message} disabled={sending} className="form-grid__wide" />
        {/* Honeypot: hidden from people, filled in by bots. */}
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="enq-company-website">Company website</label>
          <input id="enq-company-website" tabIndex={-1} autoComplete="off" value={values.company_website} onChange={set("company_website")} />
        </div>
      </div>
      {status.state === "error" && (
        <div style={{ marginTop: 16 }}>
          <Alert tone="error">{status.message}</Alert>
        </div>
      )}
      <div className="enquire__actions">
        <Button type="submit" variant="dark" icon={Send} loading={sending}>
          Send message
        </Button>
      </div>
    </form>
  );
}
