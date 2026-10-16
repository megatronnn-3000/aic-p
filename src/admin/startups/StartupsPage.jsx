import { Building2, Download, Plus, Search, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../../components/DataTable";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from "../../components/ui";
import { downloadCsv } from "../../lib/csv";
import { formatDate, todayIso } from "../../lib/format";
import options from "../../lib/options";
import { STARTUP_FIELDS } from "../../lib/startupSchema";
import { useApi } from "../../lib/useApi";

export function StageBadge({ stage }) {
  if (!stage) return <span className="muted">—</span>;
  return <Badge tone={stage === options.graduatedStartupStage ? "blue" : "outline"}>{stage}</Badge>;
}

const COLUMNS = [
  {
    key: "startup_name",
    header: "Startup",
    render: (row, to) => (
      <div className="row" style={{ gap: 12 }}>
        <Avatar name={row.startup_name} fileId={row.photo_file_id} />
        <div>
          <Link to={to} className="table__primary table-link">
            {row.startup_name}
          </Link>
          <div className="table__secondary">{row.founder || row.email}</div>
        </div>
      </div>
    ),
  },
  { key: "sector", header: "Sector" },
  { key: "stage", header: "Stage", render: (row) => <StageBadge stage={row.stage} /> },
  { key: "employees", header: "Employees", numeric: true, sortValue: (row) => Number(row.employees) || 0 },
  { key: "assigned_mentor", header: "Mentor" },
  { key: "document_count", header: "Documents", numeric: true },
];

export function StartupsPage({ graduated = false }) {
  const { data, error, loading, reload } = useApi("/api/admin/startups");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");

  const base = useMemo(() => (data || []).filter((s) => (graduated ? s.graduated : true)), [data, graduated]);
  const q = query.trim().toLowerCase();
  const rows = base.filter(
    (s) =>
      (!stage || s.stage === stage) &&
      (!q || ["startup_name", "founder", "email", "sector", "startup_code", "assigned_mentor"].some((k) => String(s[k] || "").toLowerCase().includes(q))),
  );

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;

  const exportCsv = () =>
    downloadCsv(
      `incubated-startups-${todayIso()}.csv`,
      [...STARTUP_FIELDS.map((f) => ({ key: f.name, label: f.label })), { key: "created_at", label: "Added on", value: (r) => formatDate(r.created_at) }],
      rows,
    );

  return (
    <>
      <PageHeader
        title={graduated ? "Graduated incubated startups" : "Incubated startups"}
        description={
          graduated
            ? `Incubated startups that have reached the “${options.graduatedStartupStage}” stage.`
            : "Records, metrics and documents for startups in incubation."
        }
        actions={
          <>
            <Button icon={Download} onClick={exportCsv} disabled={!rows.length}>
              Export CSV
            </Button>
            {!graduated && (
              <Button as={Link} to="/admin/incubation/startups/new" variant="primary" icon={Plus}>
                Add startup
              </Button>
            )}
          </>
        }
      />
      <Card bodyClassName={null}>
        <div className="toolbar">
          <div className="input-with-icon">
            <Search aria-hidden="true" />
            <input
              type="search"
              className="input"
              placeholder="Search startups, founders, mentors"
              aria-label="Search startups"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {!graduated && (
            <select className="select" aria-label="Filter by stage" value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">All stages</option>
              {options.startupStages.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
          <span className="toolbar__spacer" />
          <span className="muted tabular">{loading && !data ? "" : `${rows.length} shown`}</span>
        </div>
        {loading && !data ? (
          <LoadingBlock />
        ) : (
          <DataTable
            columns={COLUMNS}
            rows={rows}
            rowHref={(row) => `/admin/incubation/startups/${row.id}`}
            caption="Incubated startups"
            initialSort={{ key: "startup_name", dir: "asc" }}
            empty={
              base.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title={graduated ? "No graduated startups yet" : "No startups yet"}
                  action={
                    !graduated && (
                      <Button as={Link} to="/admin/incubation/startups/new" variant="primary" icon={Plus}>
                        Add the first startup
                      </Button>
                    )
                  }
                >
                  {graduated
                    ? `Set a startup's stage to “${options.graduatedStartupStage}” to list it here.`
                    : "Add a record for each startup in incubation, or create one from an accepted incubation application."}
                </EmptyState>
              ) : (
                <EmptyState icon={SearchX} title="No matches">
                  Try a different search or stage.
                </EmptyState>
              )
            }
          />
        )}
      </Card>
    </>
  );
}
