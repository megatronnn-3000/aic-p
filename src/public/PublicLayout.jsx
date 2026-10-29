import { LogIn } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { BrandLockup } from "../components/Brand";
import { ErrorBoundary } from "../components/ErrorBoundary";

export function PublicLayout() {
  const { pathname } = useLocation();
  return (
    <div className="public">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="public-header">
        <div className="public-header__inner">
          <BrandLockup />
          <nav className="public-nav" aria-label="Main">
            <Link to="/#programs" className="hide-sm">
              Programs
            </Link>
            <Link to="/#enquire" className="hide-sm">
              Ask a question
            </Link>
            <Link to="/admin/login" className="btn btn--sm">
              <LogIn aria-hidden="true" />
              Staff sign in
            </Link>
          </nav>
        </div>
      </header>
      <main id="main" className="public-main" tabIndex={-1}>
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="public-footer">
        <div className="public-footer__inner">
          <span>
            © {new Date().getFullYear()} AIC MUJ Incubation Foundation · Manipal University Jaipur
          </span>
          <Link to="/admin/login">Staff sign in</Link>
        </div>
      </footer>
    </div>
  );
}
