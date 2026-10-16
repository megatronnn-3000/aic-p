import { Download, Inbox, Pencil, Plus, Search, SearchX, Trash2 } from "lucide-react";
import { useState } from "react";
import { NavLink, useOutletContext, useParams } from "react-router-dom";
import { DataTable } from "../../components/DataTable";
import { ConfirmDialog, Dialog } from "../../components/Dialog";
import { FileField, SelectField, TextAreaField, TextField } from "../../components/fields";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, StatusBadge } from "../../components/ui";
import { api, downloadFile, upload } from "../../lib/api";
import { downloadCsv } from "../../lib/csv";
import { formatDate, todayIso } from "../../lib/format";
import { acceptFor, validateField } from "../../lib/formSchemas";
import options from "../../lib/options";
import { RECORD_MODULES, recordPath } from "../../lib/records";
import { useToast } from "../../lib/toast-context";
import { useApi } from "../../lib/useApi";
import { NotFoundPage } from "../../public/NotFoundPage";

const ATTACHMENT_KINDS = ["pdf", "image", "word", "excel", "powerpoint", "text"];
const ATTACHMENT_HINT = "PDF, image, Word, Excel or PowerPoint · up to 20 MB";

export function RecordsRoute() {
  const { module, category } = useParams();
  return <RecordsPage module={module} category={category} />;
}

export function RecordsPage({ module, category }) {
  const meta = RECORD_MODULES[module];
  if (!meta?.categories[category]) return <NotFoundPage home="/admin" />;
  return <RecordsView key={`${module}/${category}`} module={module} category={category} meta={meta} />;
}

function RecordsView({ module, category, meta }) {
  const { data, error, loading, reload, setData } = useApi(`/api/admin/records?module=${module}&category=${category}`);
  const { refreshCounts } = useOutletContext() || {};
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | record
  const [deleting, setDeleting] = useState(null);
  const isEnquiry = module === "enquiry";
  const categoryLabel = meta.categories[category].label;

  const q = query.trim().toLowerCase();
  const rows = (data || []).filter(
    (r) =>
      (!statusFilter || (r.status || "") === statusFilter) &&
      (!q || ["title", "description", "notes", "contact_name", "contact_email"].some((k) => String(r[k] || "").toLowerCase().includes(q))),
  );

  const columns = [
    {
      key: "title",
      header: meta.titleLabel,
      render: (row) => (
        <div>
          <button type="button" className="table__primary table-link link-reset" onClick={() => setEditing(row)}>
            {row.title}
          </button>
          {(row.contact_email || row.contact_phone) && (
            <div className="table__secondary">
              {row.contact_email ? <a href={`mailto:${row.contact_email}`}>{row.contact_email}</a> : null}
              {row.contact_email && row.contact_phone ? " · " : ""}
              {row.contact_phone}
            </div>
          )}
        </div>
      ),
    },
    { key: "record_date", header: "Date", className: "nowrap", render: (row) => formatDate(row.record_date) || <span className="muted">—</span> },
    { key: "status", header: "Status", render: (row) => (row.status ? <StatusBadge status={row.status} /> : <span className="muted">—</span>) },
    {
      key: "description",
      header: meta.descriptionLabel,
      render: (row) => (row.description ? <span className="clamp-2">{row.description}</span> : <span className="muted">—</span>),
    },
    ...(isEnquiry
      ? [{ key: "source", header: "Source", render: (row) => <Badge tone={row.source === "public" ? "orange" : "neutral"}>{row.source === "public" ? "Website" : "Staff"}</Badge> }]
      : []),
    {
      key: "attachment",
      header: "File",
      sortable: false,
      render: (row) =>
        row.attachment ? (
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            icon={Download}
            onClick={() => downloadFile(`/api/admin/files/${row.attachment.id}`, row.attachment.original_name).catch((err) => toast.error(err.message))}
          >
            Download {row.attachment.original_name}
          </Button>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      sortable: false,
      className: "nowrap",
      render: (row) => (
        <>
          <Button size="sm" variant="ghost" iconOnly icon={Pencil} onClick={() => setEditing(row)}>
            Edit {row.title}
          </Button>
          <Button size="sm" variant="danger-ghost" iconOnly icon={Trash2} onClick={() => setDeleting(row)}>
            Delete {row.title}
          </Button>
        </>
      ),
    },
  ];

  const onSaved = (saved, isNew) => {
    setData((list) => {
      const others = (list || []).filter((r) => r.id !== saved.id);
      // A record moved to another category disappears from this list.
      return saved.category === category ? (isNew ? [saved, ...others] : (list || []).map((r) => (r.id === saved.id ? saved : r))) : others;
    });
    refreshCounts?.();
  };

  const exportCsv = () =>
    downloadCsv(
      `${meta.label}-${categoryLabel}-${todayIso()}.csv`.replace(/[\s/]+/g, "-").toLowerCase(),
      [
        { key: "title", label: meta.titleLabel },
        { key: "record_date", label: "Date" },
        { key: "status", label: "Status" },
        { key: "contact_name", label: "Contact name" },
        { key: "contact_email", label: "Contact email" },
        { key: "contact_phone", label: "Contact phone" },
        { key: "description", label: meta.descriptionLabel },
        { key: "notes", label: "Notes" },
        { key: "created_at", label: "Created", value: (r) => formatDate(r.created_at) },
      ],
      rows,
    );

  return (
    <>
      <PageHeader
        title={categoryLabel}
        description={meta.description}
        actions={
          <>
            <Button icon={Download} onClick={exportCsv} disabled={!rows.length}>
              Export CSV
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
              Add {meta.itemName}
            </Button>
          </>
        }
      />
      <Card bodyClassName={null}>
        {!isEnquiry && (
          <nav className="tabs" aria-label={`${meta.label} sections`}>
            {Object.entries(meta.categories).map(([key, cat]) => (
              <NavLink key={key} to={recordPath(module, key)} className="tab">
                {cat.label}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="toolbar">
          <div className="input-with-icon">
            <Search aria-hidden="true" />
            <input type="search" className="input" placeholder="Search" aria-label="Search records" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="select" aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {options.recordStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span className="toolbar__spacer" />
          <span className="muted tabular">{loading && !data ? "" : `${rows.length} shown`}</span>
        </div>
        {error && !data ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingBlock />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            caption={categoryLabel}
            initialSort={{ key: "record_date", dir: "desc" }}
            empty={
              (data || []).length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title={`No ${meta.itemPlural} yet`}
                  action={
                    <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
                      Add {meta.itemName}
                    </Button>
                  }
                >
                  {isEnquiry ? "Enquiries sent from the public website appear here automatically." : null}
                </EmptyState>
              ) : (
                <EmptyState icon={SearchX} title="No matches">
                  Try a different search or status.
                </EmptyState>
              )
            }
          />
        )}
      </Card>

      {editing && (
        <RecordDialog
          module={module}
          category={category}
          meta={meta}
          record={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            onSaved(saved, isNew);
            setEditing(null);
            toast.success(isNew ? `${meta.itemName[0].toUpperCase()}${meta.itemName.slice(1)} added.` : "Changes saved.");
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={deleting ? `Delete “${deleting.title}”?` : ""}
        description="This record and its attachment are permanently deleted."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={async () => {
          try {
            await api(`/api/admin/records/${deleting.id}`, { method: "DELETE" });
            setData((list) => list.filter((r) => r.id !== deleting.id));
            refreshCounts?.();
            toast.success("Record deleted.");
          } catch (err) {
            toast.error(err.message);
            throw err;
          }
        }}
      />
    </>
  );
}

const FIELDS = [
  { name: "title", required: true, maxLength: 200 },
  { name: "record_date", type: "date" },
  { name: "contact_email", type: "email", label: "Contact email" },
  { name: "contact_phone", type: "tel", label: "Contact phone" },
  { name: "description", type: "textarea", maxLength: 4000 },
  { name: "notes", type: "textarea", maxLength: 4000 },
];

function RecordDialog({ module, category, meta, record, onClose, onSaved }) {
  const [values, setValues] = useState(() => ({
    category: record?.category || category,
    title: record?.title || "",
    record_date: record?.record_date || (record ? "" : todayIso()),
    status: record?.status || (record ? "" : "Open"),
    contact_name: record?.contact_name || "",
    contact_email: record?.contact_email || "",
    contact_phone: record?.contact_phone || "",
    description: record?.description || "",
    notes: record?.notes || "",
  }));
  const [file, setFile] = useState(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const set = (name) => (event) => {
    setValues((prev) => ({ ...prev, [name]: event.target.value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = {};
    FIELDS.forEach((field) => {
      const message = validateField({ label: field.label || meta.titleLabel, ...field }, values[field.name], values);
      if (message) found[field.name] = message;
    });
    if (file) {
      const message = validateField({ type: "file", label: "Attachment", kinds: ATTACHMENT_KINDS }, file, values);
      if (message) found.attachment = message;
    }
    setErrors(found);
    if (Object.keys(found).length) {
      setTimeout(() => document.querySelector('#record-form [aria-invalid="true"]')?.focus(), 0);
      return;
    }

    const data = new FormData();
    data.append("module", module);
    Object.entries(values).forEach(([key, value]) => data.append(key, value));
    if (file) data.append("attachment", file);
    if (removeAttachment) data.append("remove_attachment", "1");

    setSaving(true);
    setFormError("");
    try {
      const saved = await upload(record ? `/api/admin/records/${record.id}` : "/api/admin/records", data, {
        method: record ? "PATCH" : "POST",
      });
      onSaved(saved, !record);
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.message);
      setSaving(false);
    }
  };

  const title = record ? `Edit ${meta.itemName}` : `Add ${meta.itemName}`;
  return (
    <Dialog
      open
      onClose={onClose}
      busy={saving}
      size="lg"
      title={title}
      description={record ? undefined : meta.categories[category].label}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="record-form" variant="primary" loading={saving}>
            {record ? "Save changes" : `Add ${meta.itemName}`}
          </Button>
        </>
      }
    >
      <form id="record-form" onSubmit={submit} noValidate className="stack">
        <div className="form-grid">
          <TextField label={meta.titleLabel} required value={values.title} onChange={set("title")} error={errors.title} disabled={saving} className="form-grid__wide" data-autofocus />
          {module !== "enquiry" && (
            <SelectField
              label="Section"
              value={values.category}
              onChange={set("category")}
              disabled={saving}
              placeholder="Choose a section"
              options={Object.entries(meta.categories).map(([value, cat]) => ({ value, label: cat.label }))}
            />
          )}
          <SelectField label="Status" value={values.status} onChange={set("status")} disabled={saving} placeholder="No status" options={options.recordStatuses} error={errors.status} />
          <TextField label="Date" type="date" value={values.record_date} onChange={set("record_date")} error={errors.record_date} disabled={saving} />
          <TextField label="Contact name" value={values.contact_name} onChange={set("contact_name")} error={errors.contact_name} disabled={saving} />
          <TextField label="Contact email" type="email" value={values.contact_email} onChange={set("contact_email")} error={errors.contact_email} disabled={saving} />
          <TextField label="Contact phone" type="tel" value={values.contact_phone} onChange={set("contact_phone")} error={errors.contact_phone} disabled={saving} />
          <TextAreaField label={meta.descriptionLabel} rows={4} maxLength={4000} value={values.description} onChange={set("description")} error={errors.description} disabled={saving} className="form-grid__wide" />
          <TextAreaField label="Notes" rows={3} maxLength={4000} value={values.notes} onChange={set("notes")} error={errors.notes} disabled={saving} className="form-grid__wide" />
          {record?.attachment && !file && (
            <div className="form-grid__wide">
              <label className="checkbox">
                <input type="checkbox" checked={removeAttachment} onChange={(e) => setRemoveAttachment(e.target.checked)} disabled={saving} />
                <span>
                  Remove current attachment <span className="muted">({record.attachment.original_name})</span>
                </span>
              </label>
            </div>
          )}
          <FileField
            label={record?.attachment ? "Replace attachment" : "Attachment"}
            optional
            accept={acceptFor(ATTACHMENT_KINDS)}
            hint={ATTACHMENT_HINT}
            file={file}
            onChange={setFile}
            error={errors.attachment}
            disabled={saving}
            className="form-grid__wide"
          />
        </div>
        {formError && <Alert tone="error">{formError}</Alert>}
      </form>
    </Dialog>
  );
}
