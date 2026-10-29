import { Download, Eye, FileBadge, Send, Trash2, Upload } from "lucide-react";
import { useId, useState } from "react";
import { api, downloadFile, openFile, upload } from "../lib/api";
import { formatBytes, formatDate } from "../lib/format";
import { acceptFor, validateField } from "../lib/formSchemas";
import { useToast } from "../lib/toast-context";
import { ConfirmDialog } from "./Dialog";
import { FileField, TextField } from "./fields";
import { Button, Card, EmptyState } from "./ui";

const KINDS = ["pdf", "image", "word"];
const PREVIEWABLE = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

/** Typical documents AIC issues, offered as suggestions (any name is allowed). */
const AIC_DOCUMENT_SUGGESTIONS = {
  preincubation: ["Pre-incubation offer letter", "Pre-incubation agreement", "Pre-incubation certificate", "Graduation certificate"],
  incubation: ["Incubation offer letter", "Incubation agreement", "MoU"],
  internship: ["Internship offer letter", "Internship completion certificate", "Experience letter"],
  startup: ["Incubation offer letter", "Incubation agreement", "MoU", "Graduation certificate"],
};

/**
 * Documents AIC issues to an applicant or startup — kept apart from what they
 * submitted, and optionally emailed to them as an attachment.
 */
export function AicDocuments({ ownerType, ownerId, documents, recipient, onChange }) {
  const toast = useToast();
  const listId = useId();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [sendEmail, setSendEmail] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [emailing, setEmailing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    const found = {};
    if (!title.trim()) found.title = "Give the document a name, e.g. “Pre-incubation offer letter”";
    const fileError = validateField({ type: "file", label: "Document", kinds: KINDS, required: true }, file, {});
    if (fileError) found.document = fileError;
    setErrors(found);
    if (Object.keys(found).length) return;

    const data = new FormData();
    data.append("owner_type", ownerType);
    data.append("owner_id", String(ownerId));
    data.append("title", title.trim());
    data.append("document", file);
    if (sendEmail) data.append("email", "1");

    setSaving(true);
    setProgress(0);
    try {
      const result = await upload("/api/admin/aic-documents", data, { onProgress: setProgress });
      onChange([...documents, result.document]);
      setTitle("");
      setFile(null);
      setSendEmail(false);
      if (result.email_sent) toast.success(`${result.document.title} uploaded and emailed to ${recipient}.`);
      else if (result.email_unavailable) toast.error("Uploaded, but email isn't set up on the server, so it wasn't sent.");
      else toast.success(`${result.document.title} uploaded.`);
    } catch (err) {
      setErrors(err.fields || {});
      toast.error(err.message);
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  const run = async (doc, action) => {
    setBusyId(doc.id);
    try {
      await action();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card
      title="Issued by AIC"
      subtitle="Letters, certificates and agreements AIC shares with them — kept separate from their own documents."
      bodyClassName={null}
    >
      {documents.length === 0 ? (
        <EmptyState icon={FileBadge} title="Nothing issued yet">
          Upload an offer letter, certificate or agreement below.
        </EmptyState>
      ) : (
        <ul className="aic-docs">
          {documents.map((doc) => (
            <li key={doc.id}>
              <span className="aic-docs__icon" aria-hidden="true">
                <FileBadge />
              </span>
              <span className="aic-docs__text">
                <span className="aic-docs__title">{doc.title || doc.original_name}</span>
                <span className="aic-docs__meta">
                  {doc.original_name} · {formatBytes(doc.size)} · Uploaded {formatDate(doc.uploaded_at)}
                </span>
                <span className={`aic-docs__sent ${doc.emailed_at ? "is-sent" : ""}`}>
                  {doc.emailed_at ? `Emailed to ${doc.emailed_to} on ${formatDate(doc.emailed_at)}` : "Not emailed"}
                </span>
              </span>
              <span className="aic-docs__actions">
                {PREVIEWABLE.has(doc.content_type) && (
                  <Button size="sm" variant="ghost" iconOnly icon={Eye} disabled={busyId === doc.id} onClick={() => run(doc, () => openFile(`/api/admin/files/${doc.id}`))}>
                    Open {doc.title}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  icon={Download}
                  loading={busyId === doc.id}
                  onClick={() => run(doc, () => downloadFile(`/api/admin/files/${doc.id}`, doc.original_name))}
                >
                  Download {doc.title}
                </Button>
                <Button size="sm" icon={Send} onClick={() => setEmailing(doc)}>
                  {doc.emailed_at ? "Email again" : "Email"}
                </Button>
                <Button size="sm" variant="danger-ghost" iconOnly icon={Trash2} onClick={() => setDeleting(doc)}>
                  Delete {doc.title}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form className="aic-docs__form" onSubmit={submit} noValidate>
        <h3 className="form-subheading">Upload a document</h3>
        <div className="form-grid">
          <TextField
            label="Document name"
            required
            list={listId}
            autoComplete="off"
            placeholder="e.g. Pre-incubation offer letter"
            maxLength={150}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
            }}
            error={errors.title}
            disabled={saving}
          />
          <datalist id={listId}>
            {(AIC_DOCUMENT_SUGGESTIONS[ownerType] || []).map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <FileField
            label="File"
            required
            accept={acceptFor(KINDS)}
            hint="PDF, image or Word · up to 20 MB (10 MB to email)"
            file={file}
            onChange={(value) => {
              setFile(value);
              if (errors.document) setErrors((prev) => ({ ...prev, document: undefined }));
            }}
            error={errors.document}
            disabled={saving}
          />
        </div>
        <div className="aic-docs__submit">
          <label className="checkbox">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} disabled={saving} />
            <span>
              Email this document to <strong>{recipient}</strong>
            </span>
          </label>
          <Button type="submit" variant="primary" icon={sendEmail ? Send : Upload} loading={saving}>
            {saving && progress !== null && progress < 100 ? `Uploading ${progress}%` : sendEmail ? "Upload and email" : "Upload"}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={Boolean(emailing)}
        onClose={() => setEmailing(null)}
        title={emailing ? `Email “${emailing.title}”?` : ""}
        description={emailing ? `It will be sent to ${recipient} as an attachment.` : ""}
        confirmLabel="Send email"
        onConfirm={async () => {
          try {
            const result = await api(`/api/admin/aic-documents/${emailing.id}/email`, { method: "POST" });
            onChange(documents.map((d) => (d.id === result.document.id ? result.document : d)));
            toast.success(`${result.document.title} emailed to ${recipient}.`);
          } catch (err) {
            toast.error(err.message);
            throw err;
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={deleting ? `Delete “${deleting.title}”?` : ""}
        description="The document is removed from the portal. Copies already emailed are not affected."
        confirmLabel="Delete document"
        tone="danger"
        onConfirm={async () => {
          try {
            await api(`/api/admin/files/${deleting.id}`, { method: "DELETE" });
            onChange(documents.filter((d) => d.id !== deleting.id));
            toast.success("Document deleted.");
          } catch (err) {
            toast.error(err.message);
            throw err;
          }
        }}
      />
    </Card>
  );
}
