// Small presentational building blocks shared by every page.
import type { ReactNode } from "react";
import { Link } from "react-router";
import { isApiError } from "../api/errors";
import { daysUntil, formatDate } from "../lib/format";
import { Icon, type IconName } from "./Icon";

export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
  crumbs,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  crumbs?: ReactNode;
}) {
  return (
    <header className="page-header">
      {crumbs}
      <div className="page-header-row">
        <div className="stack-s">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 tabIndex={-1} id="page-title">{title}</h1>
          {lead && <p className="lead">{lead}</p>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
    </header>
  );
}

export function EmptyState({ icon = "sparkle", title, body, action }: { icon?: IconName; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="state-icon">
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      {body && <p className="muted">{body}</p>}
      {action}
    </div>
  );
}

/** Error panel with retry; shows the server's request id so a bug report can be traced. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = isApiError(error) ? error.message : "Something went wrong while loading this.";
  const ref = isApiError(error) ? error.requestId : undefined;
  return (
    <div className="empty" role="alert">
      <span className="state-icon danger">
        <Icon name="alert" size={26} />
      </span>
      <h3>We couldn't load this</h3>
      <p className="muted">{message}</p>
      {ref && <p className="small muted">Reference: {ref}</p>}
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function LoadingCards({ count = 3, label = "Loading" }: { count?: number; label?: string }) {
  return (
    <div className="grid grid-3" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}

export function NotFoundInline({ what, backTo, backLabel }: { what: string; backTo: string; backLabel: string }) {
  return (
    <div className="state-center">
      <div className="state-card">
        <span className="state-icon">
          <Icon name="search" size={26} />
        </span>
        <h1 className="serif">This {what} isn't available</h1>
        <p className="muted">It may have been removed, or it isn't meant for your department or year.</p>
        <Link to={backTo} className="btn">
          {backLabel}
        </Link>
      </div>
    </div>
  );
}

/** Closing-date chip: warning within 3 days, danger within 24 hours. Text always says it, not colour alone. */
export function DeadlineChip({ closesAt }: { closesAt: string }) {
  const days = daysUntil(closesAt);
  const hours = (Date.parse(closesAt) - Date.now()) / 3_600_000;
  let tone = "chip";
  let text = `Closes ${formatDate(closesAt)}`;
  if (hours <= 0) {
    tone = "chip";
    text = "Closed";
  } else if (hours <= 24) {
    tone = "chip chip-danger";
    text = "Closes today";
  } else if (days <= 3) {
    tone = "chip chip-warning";
    text = `Closes in ${days} days`;
  }
  return (
    <span className={tone} title={new Date(closesAt).toLocaleString("en-IN")}>
      <Icon name="clock" size={14} />
      {text}
    </span>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label} />;
}
