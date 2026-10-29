import { HandCoins, Pencil, Plus, Trash2, UserRoundCheck } from "lucide-react";
import { useId, useState } from "react";
import { api } from "../lib/api";
import { formatAmount, formatDate, plural, todayIso } from "../lib/format";
import options from "../lib/options";
import { useApi } from "../lib/useApi";
import { useToast } from "../lib/toast-context";
import { ConfirmDialog, Dialog } from "./Dialog";
import { SelectField, TextAreaField, TextField } from "./fields";
import { Badge, Button, Card, EmptyState } from "./ui";

// Mirrors INVESTMENT_FIELDS / MENTOR_FIELDS in backend/aic/forms.py.
const INVESTOR_FIELDS = [
  { name: "investor_name", label: "Investor name", required: true, maxLength: 150, placeholder: "Person or fund" },
  { name: "investor_type", label: "Investor type", type: "select", options: options.investorTypes },
  { name: "amount", label: "Amount (₹)", inputMode: "decimal", placeholder: "e.g. 2500000" },
  { name: "instrument", label: "Instrument", type: "select", options: options.investmentInstruments },
  { name: "invested_on", label: "Date of investment", type: "date", max: todayIso() },
  { name: "contact_email", label: "Investor email", type: "email" },
  { name: "notes", label: "Notes", type: "textarea", maxLength: 4000, wide: true },
];

const MENTOR_FIELDS = [
  { name: "mentor_name", label: "Mentor name", required: true, maxLength: 150 },
  { name: "expertise", label: "Area of expertise", maxLength: 200, placeholder: "e.g. Go-to-market, Fundraising" },
  { name: "organisation", label: "Organisation / designation", maxLength: 200 },
  { name: "status", label: "Status", type: "select", options: options.mentorStatuses, placeholder: "Active" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "assigned_on", label: "Assigned on", type: "date" },
  { name: "notes", label: "Notes", type: "textarea", maxLength: 4000, wide: true },
];

const KINDS = {
  investors: {
    title: "Investors",
    noun: "investment",
    icon: HandCoins,
    fields: INVESTOR_FIELDS,
    nameField: "investor_name",
    addLabel: "Record investment",
    emptyTitle: "No investments recorded",
    emptyText: "Record each investor who has put money into the startup.",
    subtitle: (entries) => {
      if (!entries.length) return "Has any investor invested? Record it here.";
      const total = entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      return `${plural(entries.length, "investment")}${total ? ` · ${formatAmount(total)} raised` : ""}`;
    },
    headline: (e) => [e.amount && formatAmount(e.amount), e.instrument].filter(Boolean).join(" · "),
    meta: (e) => [e.investor_type, e.invested_on && `Invested ${formatDate(e.invested_on)}`, e.contact_email].filter(Boolean),
  },
  mentors: {
    title: "Mentors",
    noun: "mentor",
    icon: UserRoundCheck,
    fields: MENTOR_FIELDS,
    nameField: "mentor_name",
    addLabel: "Assign mentor",
    emptyTitle: "No mentors assigned",
    emptyText: "Assign a mentor to guide the startup through the program.",
    subtitle: (entries) => {
      if (!entries.length) return "Mentors guiding this startup.";
      const active = entries.filter((e) => e.status !== "Completed").length;
      return `${plural(entries.length, "mentor")} · ${active} active`;
    },
    headline: (e) => e.expertise,
    meta: (e) => [e.organisation, e.email, e.phone, e.assigned_on && `Assigned ${formatDate(e.assigned_on)}`].filter(Boolean),
    badge: (e) => <Badge tone={e.status === "Completed" ? "neutral" : "green"}>{e.status || "Active"}</Badge>,
  },
};

const blank = (fields, extra = {}) => ({ ...Object.fromEntries(fields.map((f) => [f.name, ""])), ...extra });

/**
 * Investors or mentors linked to a startup. `ownerType` is "preincubation" or
 * "startup"; `onChange` receives the updated list.
 */
export function StartupSupport({ kind, ownerType, ownerId, entries, onChange }) {
  const config = KINDS[kind];
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const Icon = config.icon;

  const startNew = () => setEditing(blank(config.fields, kind === "mentors" ? { assigned_on: todayIso() } : {}));

  return (
    <Card
      title={config.title}
      subtitle={config.subtitle(entries)}
      bodyClassName={null}
      actions={
        entries.length > 0 && (
          <Button size="sm" variant="primary" icon={Plus} onClick={startNew}>
            {config.addLabel}
          </Button>
        )
      }
    >
      {entries.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={config.emptyTitle}
          action={
            <Button variant="primary" icon={Plus} onClick={startNew}>
              {config.addLabel}
            </Button>
          }
        >
          {config.emptyText}
        </EmptyState>
      ) : (
        <ul className="aic-docs">
          {entries.map((entry) => {
            const name = entry[config.nameField];
            const headline = config.headline(entry);
            return (
              <li key={entry.id}>
                <span className="aic-docs__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="aic-docs__text">
                  <span className="row" style={{ gap: 8 }}>
                    <span className="aic-docs__title">{name}</span>
                    {config.badge?.(entry)}
                  </span>
                  {headline && <span className="support__headline">{headline}</span>}
                  {config.meta(entry).length > 0 && <span className="aic-docs__meta">{config.meta(entry).join(" · ")}</span>}
                  {entry.notes && <span className="support__notes">{entry.notes}</span>}
                </span>
                <span className="aic-docs__actions">
                  <Button size="sm" variant="ghost" iconOnly icon={Pencil} onClick={() => setEditing(entry)}>
                    Edit {name}
                  </Button>
                  <Button size="sm" variant="danger-ghost" iconOnly icon={Trash2} onClick={() => setDeleting(entry)}>
                    Remove {name}
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <EntryDialog
          kind={kind}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            const saved = editing.id
              ? await api(`/api/admin/${kind}/${editing.id}`, { method: "PATCH", json: values })
              : await api(`/api/admin/${ownerType}/${ownerId}/${kind}`, { method: "POST", json: values });
            onChange(editing.id ? entries.map((e) => (e.id === saved.id ? saved : e)) : [...entries, saved]);
            const name = saved[config.nameField];
            toast.success(editing.id ? `${name} updated.` : kind === "mentors" ? `${name} assigned as a mentor.` : `Investment by ${name} recorded.`);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={deleting ? `Remove ${deleting[config.nameField]}?` : ""}
        description={kind === "mentors" ? "The mentor is unassigned from this startup." : "The investment record is permanently deleted."}
        confirmLabel="Remove"
        tone="danger"
        onConfirm={async () => {
          try {
            await api(`/api/admin/${kind}/${deleting.id}`, { method: "DELETE" });
            onChange(entries.filter((e) => e.id !== deleting.id));
            toast.success(`${deleting[config.nameField]} removed.`);
          } catch (err) {
            toast.error(err.message);
            throw err;
          }
        }}
      />
    </Card>
  );
}

function EntryDialog({ kind, initial, onClose, onSave }) {
  const config = KINDS[kind];
  const toast = useToast();
  const listId = useId();
  const formId = useId();
  const [values, setValues] = useState(() => ({ ...blank(config.fields), ...initial }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  // Mentors already assigned to other startups, offered as suggestions.
  const { data: directory } = useApi(kind === "mentors" ? "/api/admin/mentors" : null);

  const set = (name, value) => {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      const known = name === "mentor_name" && directory?.find((m) => m.mentor_name.toLowerCase() === value.trim().toLowerCase());
      if (known) {
        // Fill in the mentor's details without overwriting anything typed already.
        for (const key of ["expertise", "organisation", "email", "phone"]) if (!next[key]) next[key] = known[key];
      }
      return next;
    });
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const missing = config.fields.filter((f) => f.required && !String(values[f.name] || "").trim());
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((f) => [f.name, `${f.label} is required`])));
      return;
    }
    setBusy(true);
    try {
      await onSave(Object.fromEntries(config.fields.map((f) => [f.name, values[f.name] ?? ""])));
      onClose();
    } catch (err) {
      setErrors(err.fields || {});
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      busy={busy}
      title={initial.id ? `Edit ${initial[config.nameField]}` : config.addLabel}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={busy}>
            {initial.id ? "Save changes" : config.addLabel}
          </Button>
        </>
      }
    >
      <form id={formId} className="form-grid form-grid--tight" onSubmit={submit} noValidate>
        {config.fields.map((field) => {
          const common = {
            label: field.label,
            required: field.required,
            value: values[field.name] || "",
            error: errors[field.name],
            disabled: busy,
            className: field.wide ? "form-grid__wide" : undefined,
          };
          if (field.type === "select") {
            return <SelectField key={field.name} {...common} options={field.options} placeholder={field.placeholder} onChange={(e) => set(field.name, e.target.value)} />;
          }
          if (field.type === "textarea") {
            return <TextAreaField key={field.name} {...common} rows={3} maxLength={field.maxLength} onChange={(e) => set(field.name, e.target.value)} />;
          }
          const isName = field.name === "mentor_name";
          return (
            <TextField
              key={field.name}
              {...common}
              type={field.type || "text"}
              maxLength={field.maxLength}
              placeholder={field.placeholder}
              inputMode={field.inputMode}
              max={field.max}
              list={isName ? listId : undefined}
              autoComplete={isName ? "off" : undefined}
              data-autofocus={field.required || undefined}
              onChange={(e) => set(field.name, e.target.value)}
            />
          );
        })}
        {kind === "mentors" && (
          <datalist id={listId}>
            {(directory || []).map((m) => (
              <option key={m.mentor_name} value={m.mentor_name}>
                {m.expertise}
              </option>
            ))}
          </datalist>
        )}
      </form>
    </Dialog>
  );
}
