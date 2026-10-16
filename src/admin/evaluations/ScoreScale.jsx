/** Segmented radio scale (1..n) for one evaluation criterion. */
export function ScoreScale({ name, value, onChange, labels, max, legend, disabled }) {
  const steps = Array.from({ length: max }, (_, i) => String(i + 1));
  return (
    <fieldset className="score-scale" disabled={disabled}>
      <legend className="sr-only">{legend}</legend>
      {steps.map((step, index) => (
        <label key={step} className="score-scale__option" title={labels?.[index]}>
          <input
            type="radio"
            name={name}
            value={step}
            checked={value === step}
            onChange={() => onChange(step)}
            onClick={() => value === step && onChange("")}
          />
          <span className="score-scale__num">{step}</span>
          {labels?.[index] && <span className="score-scale__label">{labels[index]}</span>}
        </label>
      ))}
    </fieldset>
  );
}
