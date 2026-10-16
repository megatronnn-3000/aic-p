import { ArrowLeft, Eye, EyeOff, LogIn } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Field, TextField } from "../components/fields";
import { Alert, Button } from "../components/ui";
import { useAuth } from "../lib/auth-context";

function safeNext(value) {
  // Only follow redirects back into the staff workspace (no open redirects).
  return value && value.startsWith("/admin") && !value.startsWith("//") ? value : "/admin";
}

export function LoginPage() {
  const { session, expired, login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get("next"));

  if (session) return <Navigate to={next} replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <div className="login__panel">
        <Link to="/" className="page-header__eyebrow">
          <ArrowLeft aria-hidden="true" />
          Public website
        </Link>
        <div className="login__brand">
          <img src="/aic-logo.png" alt="AIC MUJ Incubation Foundation" width="72" height="72" />
        </div>
        <h1 className="login__title">Staff sign in</h1>
        <p className="muted login__lead">Review applications, evaluate startups and manage programs.</p>

        {expired && !error && (
          <div style={{ marginBottom: 16 }}>
            <Alert tone="info">Your session ended. Please sign in again.</Alert>
          </div>
        )}
        {error && (
          <div style={{ marginBottom: 16 }}>
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        <form className="stack" onSubmit={submit} noValidate>
          <TextField
            id="login-username"
            label="Username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
            autoFocus
          />
          <Field id="login-password" label="Password">
            {(aria) => (
              <div className="password-input">
                <input
                  id="login-password"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  {...aria}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={showPassword ? EyeOff : Eye}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide password" : "Show password"}
                </Button>
              </div>
            )}
          </Field>
          <Button type="submit" variant="dark" size="lg" block icon={LogIn} loading={busy}>
            Sign in
          </Button>
        </form>
      </div>
    </main>
  );
}
