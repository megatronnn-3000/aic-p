import { useState } from "react";
import { useParams } from "react-router-dom";
import { PrintBrand } from "../../components/Brand";
import { ChoiceField, TextAreaField, TextField } from "../../components/fields";
import { ErrorState, LoadingBlock, PageHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { todayIso } from "../../lib/format";
import options from "../../lib/options";
import { useApi } from "../../lib/useApi";
import { ScoreScale } from "./ScoreScale";
import { SheetActions } from "./SheetActions";
import { rememberedEvaluator, useSheet } from "./useSheet";

const CRITERIA = options.preIncubationCriteria;
const SCALE = options.preIncubationScale;
const MAX = CRITERIA.length * SCALE.length;

function blank(record) {
  const keys = Object.fromEntries(CRITERIA.map((c) => [c.key, ""]));
  return {
    founderNames: [record.founder_name, record.co_founder_name].filter(Boolean).join(", ") || record.name || "",
    date: todayIso(),
    scores: { ...keys },
    observations: { ...keys },
    finalRecommendation: "",
    reasons: "",
    evaluatorName: rememberedEvaluator(),
    evaluatorSignature: "",
  };
}

export function PreIncubationEvaluationPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/api/admin/preincubation/applications/${id}`);
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <LoadingBlock label="Loading evaluation…" />;
  return <Sheet key={data.id} record={data} />;
}

function Sheet({ record }) {
  const base = blank(record);
  const saved = record.evaluation;
  const initial = saved
    ? { ...base, ...saved, scores: { ...base.scores, ...saved.scores }, observations: { ...base.observations, ...saved.observations } }
    : base;
  const { values, update, updateIn, dirty, setDirty, saving, setSaving, pdfBusy, exportPdf, sheetRef, toast } = useSheet(initial);
  const [persisted, setPersisted] = useState(Boolean(saved));
  const total = Object.values(values.scores).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const scored = Object.values(values.scores).filter(Boolean).length;

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/admin/preincubation/applications/${record.id}/evaluation`, { method: "PUT", json: values });
      try {
        if (values.evaluatorName) localStorage.setItem("aic.evaluatorName", values.evaluatorName);
      } catch {
        /* optional convenience */
      }
      setDirty(false);
      setPersisted(true);
      toast.success("Evaluation saved.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        back={{ to: `/admin/pre-incubation/applications/${record.id}`, label: record.startup_name || "Application" }}
        title="Pre-incubation evaluation"
        description={`${record.startup_name} · ${record.reference}`}
      />
      <div className="sheet card" ref={sheetRef}>
        <PrintBrand />
        <h2 className="sheet__title">Startup evaluation — Pre-Incubation</h2>
        <div className="form-grid sheet__info">
          <TextField label="Startup" value={record.startup_name} readOnly />
          <TextField label="Founder name(s)" value={values.founderNames} onChange={(e) => update({ founderNames: e.target.value })} />
          <TextField label="Date" type="date" value={values.date} onChange={(e) => update({ date: e.target.value })} />
          <TextField label="Sector" value={record.sector} readOnly />
        </div>

        <div className="criteria" role="group" aria-label="Scores" style={{ "--option-w": "64px", "--scale-col": `${SCALE.length * 64 + (SCALE.length - 1) * 4}px` }}>
          <div className="criteria__head" aria-hidden="true">
            <span>Parameter</span>
            <span>Score</span>
            <span>Observation</span>
          </div>
          {CRITERIA.map((criterion, index) => (
            <div className="criterion" key={criterion.key}>
              <div className="criterion__label">
                <span className="criterion__num">{index + 1}</span>
                <div>
                  <div className="criterion__name">{criterion.label}</div>
                  {criterion.description && <div className="criterion__desc">{criterion.description}</div>}
                </div>
              </div>
              <ScoreScale
                name={`score-${criterion.key}`}
                legend={`${criterion.label} score`}
                max={SCALE.length}
                labels={SCALE}
                value={values.scores[criterion.key]}
                onChange={(value) => updateIn("scores", criterion.key, value)}
              />
              <input
                className="input criterion__comment"
                aria-label={`${criterion.label} observation`}
                placeholder="Observation"
                value={values.observations[criterion.key]}
                onChange={(e) => updateIn("observations", criterion.key, e.target.value)}
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
          <ChoiceField
            label="Final recommendation"
            name="finalRecommendation"
            options={options.preIncubationRecommendations}
            value={values.finalRecommendation}
            onChange={(value) => update({ finalRecommendation: value })}
            inline
            className="form-grid__wide"
          />
          <TextAreaField label="Reasons" className="form-grid__wide" rows={4} value={values.reasons} onChange={(e) => update({ reasons: e.target.value })} />
          <TextField label="Evaluator name" value={values.evaluatorName} onChange={(e) => update({ evaluatorName: e.target.value })} />
          <TextField label="Evaluator signature" help="Type your full name as signature." value={values.evaluatorSignature} onChange={(e) => update({ evaluatorSignature: e.target.value })} />
        </div>
      </div>
      <SheetActions
        isNew={!persisted}
        dirty={dirty}
        saving={saving}
        onSave={save}
        onPrint={() => window.print()}
        onPdf={() => exportPdf(`${record.reference} ${record.startup_name} evaluation.pdf`)}
        pdfBusy={pdfBusy}
      />
    </>
  );
}
