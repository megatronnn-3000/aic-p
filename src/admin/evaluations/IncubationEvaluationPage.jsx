import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PrintBrand } from "../../components/Brand";
import { TextAreaField, TextField } from "../../components/fields";
import { ErrorState, LoadingBlock, PageHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { todayIso } from "../../lib/format";
import options from "../../lib/options";
import { useApi } from "../../lib/useApi";
import { ScoreScale } from "./ScoreScale";
import { SheetActions } from "./SheetActions";
import { rememberedEvaluator, useSheet } from "./useSheet";

const CRITERIA = options.incubationCriteria;
const SCALE_MAX = options.incubationScaleMax;
const MAX = CRITERIA.length * SCALE_MAX;
const SCALE_LABELS = ["Low", "", "Average", "", "High"];

function blank(record) {
  const keys = Object.fromEntries(CRITERIA.map((c) => [c.key, ""]));
  return {
    companyName: record.startup_name || "",
    date: todayIso(),
    evaluatorName: rememberedEvaluator(),
    industry: record.sector || "",
    stage: record.incubatee_level || "",
    ask: "",
    briefDescription: record.description || "",
    scores: { ...keys },
    comments: { ...keys },
    nextSteps: "",
    nameDesignation: "",
    evaluatorSignature: "",
  };
}

export function IncubationEvaluationPage() {
  const { id, evalId } = useParams();
  const { data, error, loading, reload } = useApi(`/api/admin/incubation/applications/${id}`);
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <LoadingBlock label="Loading evaluation…" />;
  const entry = evalId === "new" ? null : data.evaluations.find((e) => String(e.id) === evalId);
  if (evalId !== "new" && !entry) {
    return <ErrorState title="Evaluation not found" error={{ message: "It may have been deleted." }} />;
  }
  return <Sheet key={`${data.id}-${evalId}`} record={data} entry={entry} />;
}

function Sheet({ record, entry }) {
  const base = blank(record);
  const initial = entry
    ? { ...base, ...entry.data, scores: { ...base.scores, ...entry.data.scores }, comments: { ...base.comments, ...entry.data.comments } }
    : base;
  const { values, update, updateIn, dirty, setDirty, saving, setSaving, pdfBusy, exportPdf, sheetRef, toast } = useSheet(initial);
  const [persisted, setPersisted] = useState(Boolean(entry));
  const navigate = useNavigate();
  const total = Object.values(values.scores).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const scored = Object.values(values.scores).filter(Boolean).length;
  const appPath = `/admin/incubation/applications/${record.id}`;

  const save = async () => {
    if (!values.evaluatorName.trim()) {
      toast.error("Enter the evaluator's name — it keeps each evaluator's scores separate.");
      document.getElementById("eval-evaluator")?.focus();
      return;
    }
    setSaving(true);
    try {
      const saved = await api(`/api/admin/incubation/applications/${record.id}/evaluations`, {
        method: "PUT",
        json: { ...values, id: entry?.id },
      });
      try {
        localStorage.setItem("aic.evaluatorName", values.evaluatorName.trim());
      } catch {
        /* optional convenience */
      }
      setDirty(false);
      setPersisted(true);
      toast.success(`Evaluation by ${saved.evaluator_name} saved.`);
      if (!entry) navigate(`${appPath}/evaluations/${saved.id}`, { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        back={{ to: appPath, label: record.startup_name }}
        title={entry ? `${entry.evaluator_name}'s evaluation` : "New evaluation"}
        description={`${record.startup_name} · ${record.reference}`}
      />
      <div className="sheet card" ref={sheetRef}>
        <PrintBrand />
        <h2 className="sheet__title">Startup pitch / incubation evaluation</h2>
        <div className="form-grid sheet__info">
          <TextField label="Company name" value={values.companyName} onChange={(e) => update({ companyName: e.target.value })} />
          <TextField label="Date" type="date" value={values.date} onChange={(e) => update({ date: e.target.value })} />
          <TextField
            id="eval-evaluator"
            label="Evaluator name"
            required
            help="Each evaluator's scores are stored separately under their name."
            value={values.evaluatorName}
            onChange={(e) => update({ evaluatorName: e.target.value })}
          />
          <TextField label="Industry" value={values.industry} onChange={(e) => update({ industry: e.target.value })} />
          <TextField label="Stage" value={values.stage} onChange={(e) => update({ stage: e.target.value })} />
          <TextField label="Ask (₹)" value={values.ask} onChange={(e) => update({ ask: e.target.value })} />
          <TextAreaField
            label="Brief description"
            className="form-grid__wide"
            rows={3}
            value={values.briefDescription}
            onChange={(e) => update({ briefDescription: e.target.value })}
          />
        </div>

        <div className="criteria" role="group" aria-label="Scores" style={{ "--option-w": "52px", "--scale-col": `${SCALE_MAX * 52 + (SCALE_MAX - 1) * 4}px` }}>
          <div className="criteria__head" aria-hidden="true">
            <span>Criteria</span>
            <span>Score (1 low – 5 high)</span>
            <span>Comments</span>
          </div>
          {CRITERIA.map((criterion, index) => (
            <div className="criterion" key={criterion.key}>
              <div className="criterion__label">
                <span className="criterion__num">{index + 1}</span>
                <div>
                  <div className="criterion__name">{criterion.label}</div>
                  <div className="criterion__desc">{criterion.description}</div>
                </div>
              </div>
              <ScoreScale
                name={`score-${criterion.key}`}
                legend={`${criterion.label} score`}
                max={SCALE_MAX}
                labels={SCALE_LABELS}
                value={values.scores[criterion.key]}
                onChange={(value) => updateIn("scores", criterion.key, value)}
              />
              <input
                className="input criterion__comment"
                aria-label={`${criterion.label} comments`}
                placeholder="Comments"
                value={values.comments[criterion.key]}
                onChange={(e) => updateIn("comments", criterion.key, e.target.value)}
              />
            </div>
          ))}
          <div className="criteria__total">
            <span>Total score</span>
            <span className="tabular">
              <strong>{total}</strong> / {MAX}
              <span className="muted"> · {scored} of {CRITERIA.length} scored</span>
            </span>
          </div>
        </div>

        <div className="form-grid">
          <TextAreaField
            label="Next steps / advice"
            className="form-grid__wide"
            rows={4}
            value={values.nextSteps}
            onChange={(e) => update({ nextSteps: e.target.value })}
          />
          <TextField label="Name & designation" value={values.nameDesignation} onChange={(e) => update({ nameDesignation: e.target.value })} />
          <TextField
            label="Evaluator signature"
            help="Type your full name as signature."
            value={values.evaluatorSignature}
            onChange={(e) => update({ evaluatorSignature: e.target.value })}
          />
        </div>
      </div>
      <SheetActions
        isNew={!persisted}
        dirty={dirty}
        saving={saving}
        onSave={save}
        onPrint={() => window.print()}
        onPdf={() => exportPdf(`${record.reference} ${values.evaluatorName || "evaluation"}.pdf`)}
        pdfBusy={pdfBusy}
      />
    </>
  );
}
