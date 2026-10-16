import { Download, Printer, Users } from "lucide-react";
import { useParams } from "react-router-dom";
import { PrintBrand } from "../../components/Brand";
import { Button, EmptyState, ErrorState, LoadingBlock, PageHeader } from "../../components/ui";
import { formatDate } from "../../lib/format";
import options from "../../lib/options";
import { useApi } from "../../lib/useApi";
import { useSheet } from "./useSheet";

const CRITERIA = options.incubationCriteria;
const SCALE_MAX = options.incubationScaleMax;
const MAX = CRITERIA.length * SCALE_MAX;

export function CombinedReportPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/api/admin/incubation/applications/${id}`);
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <LoadingBlock label="Loading report…" />;
  return <Report record={data} />;
}

function average(values) {
  const nums = values.filter((v) => v !== "" && v !== undefined && v !== null).map(Number);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function Report({ record }) {
  const { pdfBusy, exportPdf, sheetRef } = useSheet(null);
  const evaluations = record.evaluations;
  const perCriterion = CRITERIA.map((c) => ({
    ...c,
    avg: average(evaluations.map((e) => e.data.scores?.[c.key])),
  }));
  const overall = average(evaluations.map((e) => e.total));
  const back = { to: `/admin/incubation/applications/${record.id}`, label: record.startup_name };

  if (!evaluations.length) {
    return (
      <>
        <PageHeader back={back} title="Combined evaluation report" />
        <EmptyState icon={Users} title="No evaluations yet">
          Add evaluations from the application page to build the combined report.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        back={back}
        title="Combined evaluation report"
        description={`${record.startup_name} · ${record.reference}`}
        actions={
          <>
            <Button icon={Printer} onClick={() => window.print()}>
              Print
            </Button>
            <Button
              icon={Download}
              loading={pdfBusy}
              onClick={() => exportPdf(`${record.reference} ${record.startup_name} combined report.pdf`, true)}
            >
              PDF
            </Button>
          </>
        }
      />
      <div className="sheet card" ref={sheetRef}>
        <PrintBrand />
        <h2 className="sheet__title">Combined evaluation report — {record.startup_name}</h2>

        <div className="report-summary">
          <div>
            <span className="muted">Average total</span>
            <strong className="tabular">
              {overall.toFixed(1)} <span className="muted">/ {MAX}</span>
            </strong>
          </div>
          <div>
            <span className="muted">Evaluators</span>
            <strong className="tabular">{evaluations.length}</strong>
          </div>
          <div>
            <span className="muted">Sector</span>
            <strong>{record.sector}</strong>
          </div>
          <div>
            <span className="muted">Level</span>
            <strong>{record.incubatee_level}</strong>
          </div>
        </div>

        <h3 className="sheet__subtitle">Average by criterion</h3>
        <ul className="criterion-bars">
          {perCriterion.map((c) => (
            <li key={c.key}>
              <span className="criterion-bars__label">{c.label}</span>
              <span
                className="criterion-bars__track"
                role="img"
                aria-label={`${c.label}: ${c.avg === null ? "not scored" : `${c.avg.toFixed(1)} out of ${SCALE_MAX}`}`}
              >
                {c.avg !== null && <span className="criterion-bars__fill" style={{ width: `${(c.avg / SCALE_MAX) * 100}%` }} />}
              </span>
              <span className="criterion-bars__value tabular">{c.avg === null ? "—" : c.avg.toFixed(1)}</span>
            </li>
          ))}
        </ul>

        <h3 className="sheet__subtitle">Scores by evaluator</h3>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th scope="col">Evaluator</th>
                {CRITERIA.map((c) => (
                  <th key={c.key} scope="col" className="is-numeric" title={c.label}>
                    {c.short}
                  </th>
                ))}
                <th scope="col" className="is-numeric">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((entry) => (
                <tr key={entry.id}>
                  <th scope="row" className="table__primary">
                    {entry.evaluator_name}
                    <div className="table__secondary">{formatDate(entry.data.date || entry.updated_at)}</div>
                  </th>
                  {CRITERIA.map((c) => (
                    <td key={c.key} className="is-numeric tabular">
                      {entry.data.scores?.[c.key] || <span className="muted">—</span>}
                    </td>
                  ))}
                  <td className="is-numeric tabular">
                    <strong>{entry.total}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Average</th>
                {perCriterion.map((c) => (
                  <td key={c.key} className="is-numeric tabular">
                    {c.avg === null ? "—" : c.avg.toFixed(1)}
                  </td>
                ))}
                <td className="is-numeric tabular">
                  <strong>{overall.toFixed(1)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {evaluations.some((e) => e.data.nextSteps) && (
          <>
            <h3 className="sheet__subtitle">Advice from evaluators</h3>
            <dl className="details">
              {evaluations
                .filter((e) => e.data.nextSteps)
                .map((e) => (
                  <div key={e.id} className="is-wide">
                    <dt>{e.evaluator_name}</dt>
                    <dd>{e.data.nextSteps}</dd>
                  </div>
                ))}
            </dl>
          </>
        )}
      </div>
    </>
  );
}
