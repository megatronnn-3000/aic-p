import { Save } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FileField } from "../../components/fields";
import { FileList } from "../../components/FileList";
import { SchemaField } from "../../components/SchemaField";
import { Alert, Button, Card, ErrorState, LoadingBlock, PageHeader } from "../../components/ui";
import { api, upload } from "../../lib/api";
import { acceptFor, hintFor, validateField } from "../../lib/formSchemas";
import { DOCUMENT_KINDS, DOCUMENT_TYPES, FILE_LABELS, STARTUP_FIELDS, STARTUP_SECTIONS, emptyStartup } from "../../lib/startupSchema";
import { useToast } from "../../lib/toast-context";
import { useApi } from "../../lib/useApi";

/** /admin/incubation/startups/new[?from=<applicationId>] and /:id/edit */
export function StartupFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const fromApplication = params.get("from");
  const existing = useApi(id ? `/api/admin/startups/${id}` : null);
  const source = useApi(!id && fromApplication ? `/api/admin/incubation/applications/${fromApplication}` : null);

  const pending = existing.loading || source.loading;
  const failure = existing.error || source.error;
  if (failure) return <ErrorState error={failure} onRetry={existing.error ? existing.reload : source.reload} />;
  if (pending) return <LoadingBlock />;

  let initial = emptyStartup();
  if (existing.data) {
    initial = Object.fromEntries(Object.keys(initial).map((key) => [key, existing.data[key] || ""]));
  } else if (source.data) {
    const app = source.data;
    initial = {
      ...initial,
      startup_name: app.startup_name,
      founder: app.founder_name,
      email: app.email,
      phone: app.mobile_no,
      sector: app.sector,
      city: app.city,
      address: [app.city, app.state].filter(Boolean).join(", "),
    };
  }

  return (
    <StartupForm
      key={id || fromApplication || "new"}
      startup={existing.data}
      initial={initial}
      sourceApplication={source.data}
    />
  );
}

function StartupForm({ startup, initial, sourceApplication }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [photo, setPhoto] = useState(null);
  const [documents, setDocuments] = useState({});
  const [existingFiles, setExistingFiles] = useState(startup?.files || []);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(null);
  const [formError, setFormError] = useState("");
  const editing = Boolean(startup);

  const set = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = {};
    STARTUP_FIELDS.forEach((field) => {
      const message = validateField(field, values[field.name], values);
      if (message) found[field.name] = message;
    });
    const photoError = photo && validateField({ type: "file", label: "Photo", kinds: ["image"] }, photo, values);
    if (photoError) found.photo = photoError;
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(`f-${Object.keys(found)[0]}`)?.focus();
      setFormError("Please correct the highlighted fields.");
      return;
    }

    const data = new FormData();
    Object.entries(values).forEach(([key, value]) => data.append(key, value ?? ""));
    if (sourceApplication) data.append("source_application_id", String(sourceApplication.id));
    if (photo) data.append("photo", photo);
    Object.entries(documents).forEach(([key, list]) => list.forEach((file) => data.append(key, file)));

    setSaving(true);
    setFormError("");
    try {
      const saved = await upload(editing ? `/api/admin/startups/${startup.id}` : "/api/admin/startups", data, {
        method: editing ? "PATCH" : "POST",
        onProgress: setProgress,
      });
      toast.success(editing ? "Startup updated." : `${saved.startup_name} added.`);
      navigate(`/admin/incubation/startups/${saved.id}`, { replace: true });
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.message);
      setSaving(false);
      setProgress(null);
    }
  };

  const cancelTo = editing ? `/admin/incubation/startups/${startup.id}` : "/admin/incubation/startups";

  return (
    <>
      <PageHeader
        back={{ to: cancelTo, label: editing ? startup.startup_name : "Incubated startups" }}
        title={editing ? `Edit ${startup.startup_name}` : "Add incubated startup"}
        description={
          sourceApplication
            ? `Pre-filled from incubation application ${sourceApplication.reference}. Check and complete the details.`
            : "Fields marked * are required."
        }
      />
      <form className="stack form-page" onSubmit={submit} noValidate>
        {STARTUP_SECTIONS.map((section) => (
          <Card key={section.id} title={section.title}>
            <div className="form-grid">
              {section.fields.map((field) => (
                <SchemaField
                  key={field.name}
                  field={field}
                  value={values[field.name]}
                  values={values}
                  onChange={(value) => set(field.name, value)}
                  error={errors[field.name]}
                  disabled={saving}
                />
              ))}
            </div>
          </Card>
        ))}

        <Card title="Photo and documents" subtitle="Add as many files per document type as you need.">
          {existingFiles.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 className="form-subheading">Uploaded</h3>
              <FileList
                files={existingFiles}
                labels={FILE_LABELS}
                onDelete={async (file) => {
                  await api(`/api/admin/files/${file.id}`, { method: "DELETE" });
                  setExistingFiles((list) => list.filter((f) => f.id !== file.id));
                  toast.success(`${file.original_name} deleted.`);
                }}
              />
            </div>
          )}
          <div className="form-grid">
            <FileField
              label={existingFiles.some((f) => f.field === "photo") ? "Replace photo / logo" : "Photo / logo"}
              accept={acceptFor(["image"])}
              hint={hintFor(["image"])}
              file={photo}
              onChange={setPhoto}
              error={errors.photo}
              disabled={saving}
              className="form-grid__wide"
            />
            {DOCUMENT_TYPES.map(([key, label]) => (
              <FileField
                key={key}
                label={label}
                accept={acceptFor(DOCUMENT_KINDS)}
                hint="PDF, image, Word, Excel or PowerPoint · up to 20 MB"
                multiple
                files={documents[key] || []}
                onChange={(list) => setDocuments((prev) => ({ ...prev, [key]: list }))}
                error={errors[key]}
                disabled={saving}
              />
            ))}
          </div>
        </Card>

        {formError && <Alert tone="error">{formError}</Alert>}

        <div className="form-actions">
          <Button onClick={() => navigate(cancelTo)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon={Save} loading={saving}>
            {saving && progress !== null && progress < 100 ? `Uploading ${progress}%` : editing ? "Save changes" : "Add startup"}
          </Button>
        </div>
      </form>
    </>
  );
}
