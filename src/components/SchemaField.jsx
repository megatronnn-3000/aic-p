import { acceptFor, hintFor, isRequired } from "../lib/formSchemas";
import { ChoiceField, FileField, SelectField, TextAreaField, TextField } from "./fields";

const INPUT_TYPES = { email: "email", tel: "tel", url: "text", date: "date", time: "time" };

/** Render one schema field (see lib/formSchemas.js) with the right control. */
export function SchemaField({ field, value, values, onChange, error, disabled }) {
  const required = isRequired(field, values);
  const common = {
    id: `f-${field.name}`,
    label: field.label,
    required,
    help: field.help,
    error,
    disabled,
    className: field.wide ? "form-grid__wide" : "",
  };

  switch (field.type) {
    case "textarea":
      return (
        <TextAreaField
          {...common}
          name={field.name}
          value={value || ""}
          rows={field.rows || 4}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "select":
      return (
        <SelectField
          {...common}
          name={field.name}
          value={value || ""}
          options={field.options}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "radio":
    case "checkboxes":
      return (
        <ChoiceField
          label={field.label}
          name={field.name}
          options={field.options}
          value={value}
          multiple={field.type === "checkboxes"}
          onChange={onChange}
          required={required}
          help={field.help}
          error={error}
          disabled={disabled}
          inline={field.inline}
          className={field.wide ? "form-grid__wide" : ""}
        />
      );
    case "file":
      return (
        <FileField
          label={field.label}
          accept={acceptFor(field.kinds)}
          hint={field.help ? `${field.help} ${hintFor(field.kinds)}` : hintFor(field.kinds)}
          required={required}
          error={error}
          file={value}
          onChange={onChange}
          disabled={disabled}
          className={field.wide ? "form-grid__wide" : ""}
        />
      );
    default:
      return (
        <>
          <TextField
            {...common}
            type={INPUT_TYPES[field.type] || "text"}
            name={field.name}
            value={value || ""}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            autoComplete={field.suggestions ? "off" : field.autoComplete}
            inputMode={field.type === "url" ? "url" : field.inputMode}
            list={field.suggestions ? `${common.id}-options` : undefined}
            max={field.type === "date" && field.past ? new Date().toISOString().slice(0, 10) : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.suggestions && (
            <datalist id={`${common.id}-options`}>
              {field.suggestions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          )}
        </>
      );
  }
}
