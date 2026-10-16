import { ArrowRight, CalendarClock, Inbox, Mic } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from "../components/ui";
import { formatDate, formatTime, timeAgo } from "../lib/format";
import { PROGRAMS, STATUS_LABEL } from "../lib/options";
import { RECORD_MODULES, recordPath } from "../lib/records";
import { useApi } from "../lib/useApi";
import { MODULE_ICONS } from "./nav";

const SEGMENT_COLOR = {
  Pending: "var(--amber-500)",
  Applied: "var(--amber-500)",
  Approved: "var(--green-500)",
  Selected: "var(--green-500)",
  Graduated: "var(--blue-500)",
  Completed: "#8A847D",
  Rejected: "var(--red-500)",
};

const PIPELINE_ORDER = {
  preincubation: ["Pending", "Approved", "Graduated", "Rejected"],
  incubation: ["Pending", "Approved", "Rejected"],
  internship: ["Applied", "Selected", "Completed", "Rejected"],
};

function StatTile({ label, value, hint, to }) {
  return (
    <Link to={to} className="stat-tile">
      <span className="stat-tile__label">{label}</span>
      <span className="stat-tile__value tabular">{value}</span>
      {hint && <span className="stat-tile__hint">{hint}</span>}
    </Link>
  );
}

function Pipeline({ program, counts }) {
  const order = PIPELINE_ORDER[program];
  const total = order.reduce((sum, status) => sum + (counts[status] || 0), 0);
  const meta = PROGRAMS[program];
  return (
    <div className="pipeline">
      <div className="pipeline__head">
        <Link to={`${meta.adminBase}/applications`} className="pipeline__name">
          {meta.name}
        </Link>
        <span className="muted tabular">{total} total</span>
      </div>
      <div className="pipeline__bar" role="img" aria-label={`${meta.name}: ${order.map((s) => `${counts[s] || 0} ${STATUS_LABEL[program][s]}`).join(", ")}`}>
        {total === 0 ? (
          <span className="pipeline__empty" />
        ) : (
          order
            .filter((status) => counts[status])
            .map((status) => (
              <span
                key={status}
                className="pipeline__segment"
                style={{ flexGrow: counts[status], background: SEGMENT_COLOR[status] }}
                title={`${STATUS_LABEL[program][status]}: ${counts[status]}`}
              />
            ))
        )}
      </div>
      <ul className="pipeline__legend">
        {order.map((status) => (
          <li key={status}>
            <span className="pipeline__swatch" style={{ background: SEGMENT_COLOR[status] }} aria-hidden="true" />
            {STATUS_LABEL[program][status]}
            <strong className="tabular">{counts[status] || 0}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DashboardPage() {
  const { data, error, loading, reload } = useApi("/api/admin/dashboard");

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <LoadingBlock label="Loading dashboard…" />;

  const pre = data.preincubation.by_status;
  const inc = data.incubation;
  const intern = data.internship.by_status;
  const openEnquiries = Object.values(data.open_enquiries).reduce((a, b) => a + b, 0);
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  const upcoming = [
    ...data.upcoming_pitches.map((p) => ({
      key: `pitch-${p.id}`,
      icon: Mic,
      title: `Pitch: ${p.startup_name || p.reference}`,
      when: `${formatDate(p.pitch_date)}${p.pitch_time ? ` · ${formatTime(p.pitch_time)}` : ""}`,
      sort: `${p.pitch_date} ${p.pitch_time || ""}`,
      to: `/admin/pre-incubation/applications/${p.id}`,
    })),
    ...data.upcoming_events.map((e) => ({
      key: `event-${e.id}`,
      icon: CalendarClock,
      title: e.title,
      when: formatDate(e.record_date),
      sort: e.record_date,
      to: recordPath("events", "upcoming"),
    })),
  ].sort((a, b) => a.sort.localeCompare(b.sort));

  return (
    <>
      <PageHeader title="Overview" description={today} />

      <div className="stat-grid">
        <StatTile
          label="Pre-incubation to review"
          value={pre.Pending || 0}
          hint={`${pre.Approved || 0} startups in the program`}
          to="/admin/pre-incubation/applications?status=Pending"
        />
        <StatTile
          label="Incubation to evaluate"
          value={inc.awaiting_evaluation}
          hint={`${inc.by_status.Pending || 0} pending review in total`}
          to="/admin/incubation/applications?status=Pending"
        />
        <StatTile
          label="New intern applications"
          value={intern.Applied || 0}
          hint={`${intern.Selected || 0} current interns`}
          to="/admin/internship/applications?status=Applied"
        />
        <StatTile label="Open enquiries" value={openEnquiries} hint="Across all programs" to="/admin/pre-incubation/enquiries" />
        <StatTile
          label="Incubated startups"
          value={data.startups.total}
          hint={`${data.startups.graduated} graduated (Scaling stage)`}
          to="/admin/incubation/startups"
        />
      </div>

      <div className="dash-grid">
        <Card title="Needs attention" subtitle="Newest applications waiting for a decision" bodyClassName={null}>
          {data.attention.length === 0 ? (
            <EmptyState icon={Inbox} title="You're all caught up">
              New applications will appear here as they arrive.
            </EmptyState>
          ) : (
            <ul className="attention-list">
              {data.attention.map((item) => (
                <li key={`${item.program}-${item.id}`}>
                  <Link to={`${PROGRAMS[item.program].adminBase}/applications/${item.id}`}>
                    <span className="attention-list__main">
                      <span className="table__primary">{item.title || item.reference}</span>
                      <span className="table__secondary">
                        {PROGRAMS[item.program].name} · {item.reference}
                        {item.subtitle ? ` · ${item.subtitle}` : ""}
                      </span>
                    </span>
                    <span className="attention-list__time">{timeAgo(item.submitted_at)}</span>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Coming up" subtitle="Scheduled pitches and upcoming events" bodyClassName={null}>
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nothing scheduled">
              Schedule pitches from a pre-incubation application, or add events under Events.
            </EmptyState>
          ) : (
            <ul className="upcoming-list">
              {upcoming.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <Link to={item.to}>
                      <span className="upcoming-list__icon" aria-hidden="true">
                        <Icon />
                      </span>
                      <span className="attention-list__main">
                        <span className="table__primary">{item.title}</span>
                        <span className="table__secondary">{item.when}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Program pipelines" subtitle="Applications by stage">
        <div className="pipeline-grid">
          <Pipeline program="preincubation" counts={pre} />
          <Pipeline program="incubation" counts={inc.by_status} />
          <Pipeline program="internship" counts={intern} />
        </div>
      </Card>

      <h2 className="dash-section-title">Programs, schemes &amp; facilities</h2>
      <div className="module-grid">
        {Object.entries(RECORD_MODULES)
          .filter(([module]) => module !== "enquiry")
          .map(([module, meta]) => {
            const Icon = MODULE_ICONS[module];
            return (
            <section key={module} className="module-card">
              <div className="module-card__head">
                <Icon aria-hidden="true" />
                <h3>{meta.label}</h3>
              </div>
              <ul>
                {Object.entries(meta.categories).map(([category, cat]) => (
                  <li key={category}>
                    <Link to={recordPath(module, category)}>
                      <span>{cat.label}</span>
                      <span className="tabular">{data.records[module]?.[category] || 0}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
            );
          })}
      </div>
    </>
  );
}
