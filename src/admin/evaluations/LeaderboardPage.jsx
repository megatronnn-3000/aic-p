import { Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader, StatusBadge } from "../../components/ui";
import options from "../../lib/options";
import { useApi } from "../../lib/useApi";

const MAX = options.incubationCriteria.length * options.incubationScaleMax;

export function LeaderboardPage() {
  const { data, error, loading, reload } = useApi("/api/admin/incubation/applications");
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <LoadingBlock />;

  const ranked = data.filter((a) => a.eval_count > 0).sort((a, b) => b.eval_avg - a.eval_avg);
  const notEvaluated = data.filter((a) => !a.eval_count && a.status !== "Rejected");

  // Competition ranking: equal averages share a rank (1, 2, 2, 4).
  const rows = [];
  ranked.forEach((app, index) => {
    const tied = index > 0 && app.eval_avg === ranked[index - 1].eval_avg;
    rows.push({ ...app, rank: tied ? rows[index - 1].rank : index + 1 });
  });

  return (
    <>
      <PageHeader title="Incubation leaderboard" description="Applications ranked by their average evaluation score across all evaluators." />
      <Card bodyClassName={null}>
        {rows.length === 0 ? (
          <EmptyState icon={Trophy} title="No evaluations yet">
            Once evaluators score incubation applications, the ranking appears here.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Incubation applications ranked by average score</caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Startup</th>
                  <th scope="col">Sector</th>
                  <th scope="col">Average score</th>
                  <th scope="col" className="is-numeric">
                    Evaluators
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <span className={`rank ${app.rank <= 3 ? "rank--top" : ""}`}>{app.rank}</span>
                    </td>
                    <td>
                      <Link to={`/admin/incubation/applications/${app.id}`} className="table__primary table-link">
                        {app.startup_name}
                      </Link>
                      <div className="table__secondary">{app.founder_name || app.reference}</div>
                    </td>
                    <td>{app.sector}</td>
                    <td>
                      <div className="meter">
                        <span className="meter__track" aria-hidden="true">
                          <span className="meter__fill" style={{ width: `${(app.eval_avg / MAX) * 100}%` }} />
                        </span>
                        <span className="tabular nowrap">
                          {app.eval_avg} <span className="muted">/ {MAX}</span>
                        </span>
                      </div>
                    </td>
                    <td className="is-numeric tabular">{app.eval_count}</td>
                    <td>
                      <StatusBadge status={app.status} program="incubation" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {notEvaluated.length > 0 && (
        <Card title="Not yet evaluated" subtitle="Open an application to add an evaluation." className="leaderboard-pending">
          <ul className="chip-list">
            {notEvaluated.map((app) => (
              <li key={app.id}>
                <Link to={`/admin/incubation/applications/${app.id}`} className="chip">
                  {app.startup_name}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
