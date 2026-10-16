import { Download, FilePlus2, Inbox, Search, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { DataTable } from "../../components/DataTable";
import { ConfirmDialog } from "../../components/Dialog";
import { Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Switch } from "../../components/ui";
import { api } from "../../lib/api";
import { downloadCsv } from "../../lib/csv";
import { todayIso } from "../../lib/format";
import { PROGRAMS, STATUS_LABEL } from "../../lib/options";
import options from "../../lib/options";
import { useToast } from "../../lib/toast-context";
import { useApi } from "../../lib/useApi";
import { EXPORT_COLUMNS, VIEWS } from "./views";

function distinct(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter((v) => v !== "" && v !== null && v !== undefined))].sort();
}

export function ApplicationsPage({ view: viewKey }) {
  const view = VIEWS[viewKey];
  const program = PROGRAMS[view.program];
  const { data, error, loading, reload, setData } = useApi(`/api/admin/${view.program}/applications`);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(null); // { row, status, title, description }
  const toast = useToast();
  const { refreshCounts } = useOutletContext() || {};

  const status = params.get("status") || "";
  const filterValues = Object.fromEntries((view.filters || []).map((f) => [f.key, params.get(f.key) || ""]));

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const base = useMemo(() => (data || []).filter(view.filter || (() => true)), [data, view]);

  const q = query.trim().toLowerCase();
  const rows = base.filter((row) => {
    if (view.statusTabs && status && row.status !== status) return false;
    for (const [key, value] of Object.entries(filterValues)) {
      if (value && String(row[key]) !== value) return false;
    }
    if (!q) return true;
    return view.search.some((key) => String(row[key] || "").toLowerCase().includes(q));
  });

  const updateRow = async (row, changes, successMessage) => {
    try {
      const updated = await api(`/api/admin/${view.program}/applications/${row.id}`, { method: "PATCH", json: changes });
      setData((list) => list.map((item) => (item.id === row.id ? { ...item, ...pickListFields(item, updated) } : item)));
      refreshCounts?.();
      toast.success(updated.email_sent ? `${successMessage} The applicant has been emailed.` : successMessage);
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;

  const cohortColumns = cohortActionColumns(view, updateRow, setPending);
  const columns = [...view.columns, ...cohortColumns];
  const statuses = options.statuses[view.program];
  const hasFilters = query || Object.values(filterValues).some(Boolean) || (view.statusTabs && status);

  const exportRows = () =>
    downloadCsv(`${program.name} ${view.title} ${todayIso()}.csv`.replace(/\s+/g, "-").toLowerCase(), EXPORT_COLUMNS[view.program], rows);

  return (
    <>
      <PageHeader
        title={view.title}
        description={view.description}
        actions={
          <>
            <Button icon={Download} onClick={exportRows} disabled={!rows.length}>
              Export CSV
            </Button>
            {view.canCreate && (
              <Button as={Link} to={`${program.adminBase}/applications/new`} variant="primary" icon={FilePlus2}>
                New application
              </Button>
            )}
          </>
        }
      />

      <Card bodyClassName={null}>
        {view.statusTabs && (
          <div className="tabs" role="tablist" aria-label="Filter by status">
            {["", ...statuses].map((value) => {
              const count = value ? base.filter((row) => row.status === value).length : base.length;
              return (
                <button
                  key={value || "all"}
                  type="button"
                  role="tab"
                  className="tab"
                  aria-selected={status === value}
                  onClick={() => setParam("status", value)}
                >
                  {value ? STATUS_LABEL[view.program][value] : "All"}
                  <span className="tab__count tabular">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="toolbar">
          <div className="input-with-icon">
            <Search aria-hidden="true" />
            <input
              type="search"
              className="input"
              placeholder="Search by name, email or reference"
              aria-label="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {(view.filters || []).map((filter) => {
            const choices = filter.options || distinct(base, filter.key).map((v) => ({ value: v, label: v }));
            return (
              <select
                key={filter.key}
                className="select"
                aria-label={filter.label}
                value={filterValues[filter.key]}
                onChange={(e) => setParam(filter.key, e.target.value)}
              >
                <option value="">{filter.label}</option>
                {choices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            );
          })}
          {hasFilters && (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setQuery("");
                setParams(new URLSearchParams(), { replace: true });
              }}
            >
              Clear filters
            </button>
          )}
          <span className="toolbar__spacer" />
          <span className="muted tabular" aria-live="polite">
            {loading && !data ? "" : `${rows.length} shown`}
          </span>
        </div>

        {loading && !data ? (
          <LoadingBlock />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowHref={view.rowHref}
            caption={view.title}
            initialSort={{ key: "submitted_at", dir: "desc" }}
            empty={
              base.length === 0 ? (
                <EmptyState icon={Inbox} title="Nothing here yet">
                  {view.emptyText || "New applications will appear here as soon as they're submitted."}
                </EmptyState>
              ) : (
                <EmptyState icon={SearchX} title="No matches">
                  Try a different search or clear the filters.
                </EmptyState>
              )
            }
          />
        )}
      </Card>

      {pending && (
        <ConfirmDialog
          open
          onClose={() => setPending(null)}
          title={pending.title}
          description={pending.description}
          confirmLabel={pending.confirmLabel}
          checkboxLabel={pending.notify ? "Email the applicant about this change" : undefined}
          onConfirm={(notify) =>
            updateRow(pending.row, { status: pending.status, notify: pending.notify ? Boolean(notify) : false }, pending.success)
          }
        />
      )}
    </>
  );
}

function pickListFields(item, updated) {
  return Object.fromEntries(Object.keys(item).filter((key) => key in updated).map((key) => [key, updated[key]]));
}

function cohortActionColumns(view, updateRow, setPending) {
  const name = (row) => row.startup_name || row.name;
  if (view.cohortActions === "preincubation") {
    return [
      {
        key: "is_active",
        header: "Active",
        sortable: false,
        render: (row) => (
          <Switch
            checked={row.is_active}
            label={<span className="sr-only">{`${name(row)} active`}</span>}
            onChange={(value) =>
              updateRow(row, { is_active: value }, `${name(row)} marked ${value ? "active" : "inactive"}.`).catch(() => {})
            }
          />
        ),
      },
      {
        key: "certificate_issued",
        header: "Certificate",
        sortable: false,
        render: (row) => (
          <Switch
            checked={row.certificate_issued}
            label={<span className="sr-only">{`${name(row)} certificate issued`}</span>}
            onChange={(value) =>
              updateRow(row, { certificate_issued: value }, `Certificate ${value ? "issued to" : "withdrawn for"} ${name(row)}.`).catch(() => {})
            }
          />
        ),
      },
      {
        key: "actions",
        header: <span className="sr-only">Actions</span>,
        sortable: false,
        render: (row) => (
          <Button
            size="sm"
            onClick={() =>
              setPending({
                row,
                status: "Graduated",
                title: `Mark ${name(row)} as graduated?`,
                description: "It moves to Graduated pre-incubated startups.",
                confirmLabel: "Mark graduated",
                notify: true,
                success: `${name(row)} graduated.`,
              })
            }
          >
            Graduate
          </Button>
        ),
      },
    ];
  }
  if (view.cohortActions === "interns" || view.cohortActions === "past") {
    const toPast = view.cohortActions === "interns";
    return [
      {
        key: "actions",
        header: <span className="sr-only">Actions</span>,
        sortable: false,
        render: (row) => (
          <Button
            size="sm"
            onClick={() =>
              setPending({
                row,
                status: toPast ? "Completed" : "Selected",
                title: toPast ? `Mark ${row.name}'s internship as completed?` : `Move ${row.name} back to current interns?`,
                description: toPast ? "They move to Past interns." : "They move back to Current interns.",
                confirmLabel: toPast ? "Mark completed" : "Move back",
                notify: false,
                success: toPast ? `${row.name} moved to past interns.` : `${row.name} moved to current interns.`,
              })
            }
          >
            {toPast ? "Mark completed" : "Move back"}
          </Button>
        ),
      },
    ];
  }
  return [];
}
