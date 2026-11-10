import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { loginBody } from "@scc/shared";
import { login } from "../api/endpoints/auth";
import { isApiError } from "../api/errors";
import { useAuth } from "../auth/auth-context";
import { Field, FormError } from "../components/Field";
import { Icon } from "../components/Icon";
import { AuthLayout } from "../layouts/AuthLayout";
import { toFieldErrors, type FieldErrors } from "../lib/form-errors";
import { useDocumentTitle } from "../lib/use-document-title";

const IS_MOCK = import.meta.env.MODE === "mock";

export function LoginPage() {
  useDocumentTitle("Log in");
  const { refetchMe } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);
  const justRegistered = params.get("registered") === "1";

  // Countdown after "too many attempts"; the button stays disabled until it reaches 0
  useEffect(() => {
    if (waitSeconds <= 0) return;
    const t = setTimeout(() => setWaitSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [waitSeconds]);

  async function submit() {
    if (pending || waitSeconds > 0) return;
    setFormError(null);

    // Check in the browser first with the SAME schema the server uses
    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = "Enter your email.";
    if (!password) errors.password = "Enter your password.";
    const parsed = loginBody.safeParse({ email, password });
    if (Object.keys(errors).length > 0 || !parsed.success) {
      setFieldErrors(parsed.success ? errors : { ...toFieldErrors(parsed.error.issues), ...errors });
      return;
    }
    setFieldErrors({});
    setPending(true);

    try {
      const res = await login(parsed.data);
      if (res.status === "MFA_REQUIRED") {
        setFormError("This account needs two-step login, which this version doesn't support yet. Contact an admin.");
        return;
      }
      await refetchMe(); // the GuestOnly guard then sends the user on to returnTo
    } catch (err) {
      if (!isApiError(err)) {
        setFormError("Something went wrong. Please try again.");
        return;
      }
      switch (err.code) {
        case "INVALID_CREDENTIALS":
          // Show the server's generic message as-is: never reveal whether the email exists
          setFormError(err.message);
          setPassword("");
          passwordRef.current?.focus();
          break;
        case "ACCOUNT_LOCKED":
        case "RATE_LIMITED":
          setFormError(err.message);
          setWaitSeconds(err.retryAfter ?? 60);
          break;
        case "VALIDATION_ERROR":
          setFieldErrors(toFieldErrors(err.issues ?? []));
          setFormError(err.message);
          break;
        default:
          setFormError(err.requestId ? `${err.message} (Ref: ${err.requestId})` : err.message);
      }
    } finally {
      setPending(false);
    }
  }

  const blocked = pending || waitSeconds > 0;

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="stack-s">
          <p className="eyebrow">Welcome back</p>
          <h1>Log in</h1>
          <p className="muted">Use your college email to continue.</p>
        </div>

        {justRegistered && !formError && (
          <p className="form-note" role="status">
            Check your inbox for the verification link, then log in.
          </p>
        )}
        <FormError message={formError && waitSeconds > 0 ? `${formError} Try again in ${waitSeconds}s.` : formError} />

        <form
          className="form-grid"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="College email" error={fieldErrors.email}>
            {(a) => (
              <input
                {...a}
                className="input"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="name@iem.edu.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>

          <Field label="Password" error={fieldErrors.password}>
            {(a) => (
              <div className="input-wrap">
                <input
                  {...a}
                  ref={passwordRef}
                  className="input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  spellCheck={false}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="icon-btn trail-btn"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} />
                </button>
              </div>
            )}
          </Field>

          <button type="submit" className="btn btn-dark btn-block" disabled={blocked} aria-busy={pending || undefined}>
            {pending ? <span className="spinner" aria-hidden /> : null}
            {pending ? "Logging in…" : waitSeconds > 0 ? `Try again in ${waitSeconds}s` : "Log in"}
          </button>
        </form>

        <p className="auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>

        {IS_MOCK && (
          <aside className="mock-hint">
            <p className="eyebrow">Mock mode: sample accounts</p>
            <ul className="mock-list">
              <li><code>student.a@iem.edu.in</code> student, CSE Year 3</li>
              <li><code>student.d@iem.edu.in</code> student, ECE Year 2</li>
              <li><code>faculty.b@iem.edu.in</code> faculty</li>
              <li><code>admin.c@iem.edu.in</code> admin</li>
              <li><code>locked@iem.edu.in</code> shows the lock timer, <code>student.e@…</code> is suspended</li>
            </ul>
            <p>Password for all: <code>demo-password-123</code></p>
          </aside>
        )}
      </div>
    </AuthLayout>
  );
}
