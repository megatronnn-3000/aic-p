import { Link } from "react-router-dom";

export function BrandLockup({ to = "/", className = "" }) {
  return (
    <Link to={to} className={`brand ${className}`} aria-label="AIC MUJ Incubation Foundation, Manipal University Jaipur — home">
      <img src="/aic-logo.png" alt="" className="brand__aic" width="44" height="44" />
      <span className="brand__divider" aria-hidden="true" />
      <img src="/manipal-logo.png" alt="" className="brand__muj" width="146" height="30" />
    </Link>
  );
}

/** Logo strip for printable documents (receipts, evaluation sheets). */
export function PrintBrand() {
  return (
    <div className="print-brand">
      <img src="/aic-logo.png" alt="AIC MUJ Incubation Foundation" />
      <img src="/manipal-logo.png" alt="Manipal University Jaipur" />
    </div>
  );
}
