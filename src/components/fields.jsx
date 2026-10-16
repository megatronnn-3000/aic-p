import { CircleAlert, FileCheck2, FileUp, X } from "lucide-react";
import { useId, useState } from "react";
import { formatBytes } from "../lib/format";

/** Label + control + help/error wiring shared by every input. */
export function Field({ id, label, required, optional, help, error, children, className = "", count }) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
          {required && (
            <span className="field__required" aria-hidden="true">
              *
            </span>
          )}
          {optional && <span className="field__optional">Optional</span>}
        </label>
      )}
      {children({ "aria-describedby": [helpId, errorId].filter(Boolean).join(" ") || undefined, "aria-invalid": error ? true : undefined })}
      {help && !error && (
        <div className="field__help" id={helpId}>
          {help}
        </div>
      )}
      {error && (
        <div className="field__error" id={errorId}>
          <CircleAlert aria-hidden="true" />
          {error}
        </div>
      )}
      {count}
    </div>
  );
}

export function TextField({ label, required, optional, help, error, className, type = "text", ...props }) {
  const autoId = useId();
  const id = props.id || autoId;
  return (
    <Field id={id} label={label} required={required} optional={optional} help={help} error={error} className={className}>
      {(aria) => <input id={id} type={type} className="input" required={required} {...aria} {...props} />}
    </Field>
  );
}

export function TextAreaField({ label, required, optional, help, error, className, maxLength, value, ...props }) {
  const autoId = useId();
  const id = props.id || autoId;
  const length = (value || "").length;
  const showCount = maxLength && length > maxLength * 0.8;
  return (
    <Field
      id={id}
      label={label}
      required={required}
      optional={optional}
      help={help}
      error={error}
      className={className}
      count={showCount ? <span className="char-count">{`${length} / ${maxLength}`}</span> : null}
    >
      {(aria) => (
        <textarea id={id} className="textarea" required={required} maxLength={maxLength} value={value} {...aria} {...props} />
      )}
    </Field>
  );
}

export function SelectField({ label, required, optional, help, error, className, options, placeholder = "Select…", ...props }) {
  const autoId = useId();
  const id = props.id || autoId;
  return (
    <Field id={id} label={label} required={required} optional={optional} help={help} error={error} className={className}>
      {(aria) => (
        <select id={id} className="select" required={required} {...aria} {...props}>
          <option value="">{placeholder}</option>
          {options.map((option) => {
            const value = typeof option === "string" ? option : option.value;
            const text = typeof option === "string" ? option : option.label;
            return (
              <option key={value} value={value}>
                {text}
              </option>
            );
          })}
        </select>
      )}
    </Field>
  );
}

/** Radio group (single) or checkbox group (multiple) rendered as tappable tiles. */
export function ChoiceField({ label, name, options, value, onChange, multiple, required, optional, help, error, disabled, inline, className = "" }) {
  const groupId = useId();
  const selected = multiple ? value || [] : value;
  const toggle = (option) => {
    if (!multiple) return onChange(option);
    onChange(selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option]);
  };
  return (
    <div className={`field ${className}`}>
      <fieldset
        className={`choices ${inline ? "choices--inline" : ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${groupId}-error` : help ? `${groupId}-help` : undefined}
        role={multiple ? "group" : "radiogroup"}
        aria-required={!multiple && required ? true : undefined}
        id={groupId}
        tabIndex={-1}
      >
        <legend className="field__label" style={{ marginBottom: 6, padding: 0 }}>
          {label}
          {required && (
            <span className="field__required" aria-hidden="true">
              *
            </span>
          )}
          {optional && <span className="field__optional">Optional</span>}
        </legend>
        {options.map((option) => (
          <label className="choice" key={option}>
            <input
              type={multiple ? "checkbox" : "radio"}
              name={name}
              value={option}
              checked={multiple ? selected.includes(option) : selected === option}
              onChange={() => toggle(option)}
              disabled={disabled}
            />
            {option}
          </label>
        ))}
      </fieldset>
      {help && !error && (
        <div className="field__help" id={`${groupId}-help`}>
          {help}
        </div>
      )}
      {error && (
        <div className="field__error" id={`${groupId}-error`}>
          <CircleAlert aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  );
}

/** Styled file picker with drag-and-drop, showing the chosen file(s). */
export function FileField({ label, accept, hint, required, optional, error, file, files, multiple, onChange, disabled, className = "" }) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const chosen = multiple ? files || [] : file ? [file] : [];

  const pick = (list) => {
    const items = Array.from(list || []);
    if (!items.length) return;
    onChange(multiple ? [...chosen, ...items] : items[0]);
  };

  return (
    <Field id={id} label={label} required={required} optional={optional} error={error} className={className}>
      {(aria) => (
        <div>
          <div
            className={`file-drop ${dragging ? "is-dragging" : ""} ${chosen.length ? "has-file" : ""}`}
            aria-invalid={aria["aria-invalid"]}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!disabled) pick(e.dataTransfer.files);
            }}
          >
            <span className="file-drop__icon" aria-hidden="true">
              {chosen.length ? <FileCheck2 /> : <FileUp />}
            </span>
            <span className="file-drop__text">
              {chosen.length && !multiple ? (
                <>
                  <span className="file-drop__name">{chosen[0].name}</span>
                  <span className="file-drop__meta">{formatBytes(chosen[0].size)} · Click to replace</span>
                </>
              ) : (
                <>
                  <span className="file-drop__name">{multiple && chosen.length ? "Add more files" : "Choose a file or drag it here"}</span>
                  <span className="file-drop__meta">{hint}</span>
                </>
              )}
            </span>
            <input
              id={id}
              type="file"
              accept={accept}
              multiple={multiple}
              disabled={disabled}
              onChange={(e) => {
                pick(e.target.files);
                e.target.value = "";
              }}
              {...aria}
            />
            {chosen.length > 0 && !multiple && (
              <button
                type="button"
                className="btn btn--ghost btn--sm btn--icon file-drop__remove"
                onClick={() => onChange(null)}
                disabled={disabled}
              >
                <X aria-hidden="true" />
                <span className="sr-only">Remove {chosen[0].name}</span>
              </button>
            )}
          </div>
          {multiple && chosen.length > 0 && (
            <ul className="file-list" style={{ marginTop: 6 }}>
              {chosen.map((item, index) => (
                <li key={`${item.name}-${index}`}>
                  <span className="file-list__text">
                    <span className="file-list__name">{item.name}</span>
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {formatBytes(item.size)}
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm btn--icon"
                    onClick={() => onChange(chosen.filter((_, i) => i !== index))}
                  >
                    <X aria-hidden="true" />
                    <span className="sr-only">Remove {item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Field>
  );
}
