import { ArrowLeft, CircleAlert, CircleCheck, Info, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchObjectUrl } from "../lib/api";
import { initials } from "../lib/format";
import { STATUS_LABEL, STATUS_TONE } from "../lib/options";

export function Spinner({ label }) {
  return <span className="spinner" role={label ? "status" : undefined} aria-label={label} />;
}

export function Button({
  as: Component = "button",
  variant = "default",
  size,
  block,
  icon: Icon,
  iconOnly,
  loading,
  disabled,
  className = "",
  children,
  type,
  ...props
}) {
  const classes = [
    "btn",
    variant !== "default" && `btn--${variant}`,
    size && `btn--${size}`,
    block && "btn--block",
    iconOnly && "btn--icon",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const isButton = Component === "button";
  return (
    <Component
      className={classes}
      type={isButton ? type || "button" : undefined}
      disabled={isButton ? disabled || loading : undefined}
      aria-disabled={!isButton && disabled ? "true" : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : Icon ? <Icon aria-hidden="true" /> : null}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </Component>
  );
}

export function Badge({ tone = "neutral", dot, children }) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, program }) {
  if (!status) return <span className="muted">—</span>;
  const label = (program && STATUS_LABEL[program]?.[status]) || status;
  return (
    <Badge tone={STATUS_TONE[status] || "neutral"} dot>
      {label}
    </Badge>
  );
}

export function LoadingBlock({ label = "Loading…" }) {
  return (
    <div className="loading-block" role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="empty__icon" aria-hidden="true">
          <Icon />
        </div>
      )}
      <div className="empty__title">{title}</div>
      {children && <div className="empty__text">{children}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "This page couldn't be loaded" }) {
  return (
    <EmptyState
      icon={CircleAlert}
      title={title}
      action={
        onRetry && (
          <Button icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      {error?.message || "Please try again."}
    </EmptyState>
  );
}

const ALERT_ICONS = { error: CircleAlert, success: CircleCheck, info: Info };

export function Alert({ tone = "info", title, children, action }) {
  const Icon = ALERT_ICONS[tone];
  return (
    <div className={`alert alert--${tone}`} role={tone === "error" ? "alert" : undefined}>
      <Icon aria-hidden="true" />
      <div className="alert__body">
        {title && <div className="alert__title">{title}</div>}
        {children}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, footer, className = "", bodyClassName = "card__body", as: Tag = "section" }) {
  return (
    <Tag className={`card ${className}`}>
      {(title || actions) && (
        <div className="card__header">
          <div>
            {title && <h2 className="card__title">{title}</h2>}
            {subtitle && <div className="card__subtitle">{subtitle}</div>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {bodyClassName === null ? children : <div className={bodyClassName}>{children}</div>}
      {footer && <div className="card__footer">{footer}</div>}
    </Tag>
  );
}

export function PageHeader({ title, description, back, meta, actions }) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {back && (
          <Link to={back.to} className="page-header__eyebrow">
            <ArrowLeft aria-hidden="true" />
            {back.label}
          </Link>
        )}
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
        {meta && <div className="page-header__meta">{meta}</div>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function Switch({ checked, onChange, label, disabled, description }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span className="switch__track" aria-hidden="true" />
      <span>
        {label}
        {description && <span className="field__help" style={{ display: "block" }}>{description}</span>}
      </span>
    </label>
  );
}

/** Avatar that loads an authenticated photo when a file id is given. */
export function Avatar({ name, fileId, size }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!fileId) return undefined;
    let url;
    let cancelled = false;
    fetchObjectUrl(`/api/admin/files/${fileId}?inline=1`)
      .then((objectUrl) => {
        url = objectUrl;
        if (!cancelled) setSrc(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId]);
  return (
    <span className={`avatar ${size === "lg" ? "avatar--lg" : ""}`} aria-hidden={src ? undefined : "true"}>
      {fileId && src ? <img src={src} alt={`${name} photo`} /> : initials(name)}
    </span>
  );
}
