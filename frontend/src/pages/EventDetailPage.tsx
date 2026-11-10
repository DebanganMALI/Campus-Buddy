import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { deleteEvent, getEvent } from "../api/endpoints/content";
import { isApiError } from "../api/errors";
import { keys } from "../api/keys";
import { useCanChange } from "../auth/use-can-change";
import { BookmarkButton } from "../components/BookmarkButton";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Icon } from "../components/Icon";
import { useToast } from "../components/toast-context";
import { ErrorState, NotFoundInline } from "../components/ui";
import { audienceLabel, formatDate, formatTime, formatWeekday, monthDay } from "../lib/format";
import { useDocumentTitle } from "../lib/use-document-title";

export function EventDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: [...keys.events, "detail", id], queryFn: ({ signal }) => getEvent(id, signal) });
  const e = query.data;
  useDocumentTitle(e?.title ?? "Event");
  const { canEdit, canDelete } = useCanChange("event", e?.author.id);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    setDeleting(true);
    try {
      await deleteEvent(id);
      await qc.invalidateQueries({ queryKey: keys.events });
      toast.show("Event deleted");
      navigate("/events", { replace: true });
    } catch (err) {
      toast.show(isApiError(err) ? err.message : "Couldn't delete.", "error");
      setDeleting(false);
      setConfirm(false);
    }
  }

  if (query.isPending) return <div className="container page"><div className="skeleton" style={{ height: 320, marginTop: 40 }} /></div>;
  if (query.isError) {
    if (isApiError(query.error) && query.error.code === "NOT_FOUND") return <NotFoundInline what="event" backTo="/events" backLabel="All events" />;
    return <div className="container section"><ErrorState error={query.error} onRetry={() => void query.refetch()} /></div>;
  }
  if (!e) return null;
  const { m, d } = monthDay(e.startsAt);
  const past = Date.parse(e.endsAt) < Date.now();

  return (
    <div className="page container">
      <nav className="crumbs section" aria-label="Breadcrumb">
        <Link to="/events">Events</Link>
        <Icon name="arrowRight" size={14} />
        <span aria-current="page">{e.title}</span>
      </nav>
      <div className="split" style={{ marginTop: "var(--space-6)" }}>
        <article className="article stack">
          <div className="event-card">
            <div className={`date-block${past ? " past" : ""}`} aria-hidden>
              <span className="m">{m}</span>
              <span className="d">{d}</span>
            </div>
            <div className="stack-s">
              <div className="chip-row">
                {past ? <span className="chip">Past event</span> : <span className="chip chip-mint">Upcoming</span>}
                <span className="chip">{audienceLabel(e.audience)}</span>
              </div>
              <h1 id="page-title" tabIndex={-1}>{e.title}</h1>
            </div>
          </div>
          <div className="article-body">{e.description}</div>
        </article>
        <aside className="card aside-card stack">
          <dl className="meta-list">
            <div><dt>Date</dt><dd>{formatWeekday(e.startsAt)}, {formatDate(e.startsAt)}</dd></div>
            <div><dt>Time</dt><dd>{formatTime(e.startsAt)} – {formatTime(e.endsAt)}</dd></div>
            <div><dt>Venue</dt><dd>{e.venue}</dd></div>
            {e.capacity ? <div><dt>Capacity</dt><dd>{e.capacity} seats</dd></div> : null}
            <div><dt>Organised by</dt><dd>{e.author.name}</dd></div>
          </dl>
          <div className="row">
            <BookmarkButton type="event" id={e.id} initial={e.bookmarked} title={e.title} />
            <span className="small muted">Save for later</span>
          </div>
          {(canEdit || canDelete) && (
            <div className="row">
              {canEdit && (
                <Link to={`/events/${e.id}/edit`} className="btn btn-sm">
                  <Icon name="edit" size={16} /> Edit
                </Link>
              )}
              {canDelete && (
                <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirm(true)}>
                  <Icon name="trash" size={16} /> Delete
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Delete this event?"
        confirmLabel="Delete event"
        danger
        pending={deleting}
        onConfirm={() => void onDelete()}
        onCancel={() => setConfirm(false)}
      >
        <p>“{e.title}” will be removed for everyone.</p>
      </ConfirmDialog>
    </div>
  );
}
