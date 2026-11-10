// Content cards. Each card is one link (via the title) plus at most a bookmark/download action,
// so keyboard users never meet a link nested inside another link.
import { useState } from "react";
import { Link } from "react-router";
import type { AnnouncementDTO, EventDTO, OpeningDTO, ResourceDTO } from "../api/types";
import { downloadResource } from "../lib/download";
import { audienceLabel, forAudience, fileKind, fileSize, formatTime, formatWeekday, monthDay, relativeDay } from "../lib/format";

/** Editorial list row: date, serif headline, excerpt. Used for feeds of announcements. */
export function AnnouncementRow({ a }: { a: AnnouncementDTO }) {
  const { d, m } = monthDay(a.publishAt ?? a.createdAt);
  return (
    <article className="feed-row">
      <div className="feed-date" aria-hidden>
        <b>{d}</b>
        <span>{m}</span>
      </div>
      <div className="feed-body">
        <h3>
          <Link to={`/announcements/${a.id}`}>{a.title}</Link>
        </h3>
        <p className="clamp-2">{a.body}</p>
        <p className="feed-meta">
          {a.pinned && <span className="tag">Pinned</span>}
          {a.status === "draft" && <span className="tag-warn">Draft</span>}
          <span>{a.author.name}</span>
          <span>For {forAudience(a.audience)}</span>
          <span className="sr-only">Posted {relativeDay(a.publishAt ?? a.createdAt)}</span>
        </p>
      </div>
      <div className="card-actions">
        <BookmarkButton type="announcement" id={a.id} initial={a.bookmarked} title={a.title} />
      </div>
    </article>
  );
}
import { coverStyle, Monogram } from "./Art";
import { BookmarkButton } from "./BookmarkButton";
import { Icon } from "./Icon";
import { useToast } from "./toast-context";
import { DeadlineChip } from "./ui";

export function AnnouncementCard({ a }: { a: AnnouncementDTO }) {
  return (
    <article className="card card-interactive" data-cat="news">
      <div className="card-top">
        <div className="chip-row">
          {a.pinned && <span className="chip chip-night">Pinned</span>}
          {a.status === "draft" && <span className="chip chip-warning">Draft</span>}
          <span className="chip chip-cat">{audienceLabel(a.audience)}</span>
        </div>
        <div className="card-actions">
          <BookmarkButton type="announcement" id={a.id} initial={a.bookmarked} title={a.title} />
        </div>
      </div>
      <h3>
        <Link to={`/announcements/${a.id}`}>{a.title}</Link>
      </h3>
      <p className="clamp-2">{a.body}</p>
      <p className="card-meta">
        <span>{a.author.name}</span>
        <span>{relativeDay(a.publishAt ?? a.createdAt)}</span>
      </p>
    </article>
  );
}

export function EventCard({ e }: { e: EventDTO }) {
  const { m, d } = monthDay(e.startsAt);
  const past = Date.parse(e.endsAt) < Date.now();
  return (
    <article className="card card-interactive event-tile" data-cat="events">
      <div className={`event-cover${past ? " past" : ""}`} style={coverStyle(e.id)}>
        <span className="cover-date" aria-hidden>
          <b>{d}</b>
          <span>{m}</span>
        </span>
        <div className="card-actions">
          <BookmarkButton type="event" id={e.id} initial={e.bookmarked} title={e.title} />
        </div>
      </div>
      <div className="event-body">
        <h3>
          <Link to={`/events/${e.id}`}>{e.title}</Link>
        </h3>
        <p className="card-meta">
          <span className="meta-item">
            <Icon name="clock" size={16} />
            {formatWeekday(e.startsAt)}, {formatTime(e.startsAt)}
          </span>
          <span className="meta-item">
            <Icon name="pin" size={16} />
            {e.venue}
          </span>
        </p>
        {past && <span className="chip">Past event</span>}
      </div>
    </article>
  );
}

export function OpeningCard({ o }: { o: OpeningDTO }) {
  return (
    <article className="card card-interactive" data-cat="openings">
      <div className="card-top">
        <div className="opening-head">
          <Monogram name={o.company} />
          <div>
            <p className="eyebrow">{o.company}</p>
            <span className="chip chip-cat">{o.type === "job" ? "Job" : "Internship"}</span>
          </div>
        </div>
        <div className="card-actions">
          <BookmarkButton type="opening" id={o.id} initial={o.bookmarked} title={o.title} />
        </div>
      </div>
      <h3>
        <Link to={`/openings/${o.id}`}>{o.title}</Link>
      </h3>
      <p className="card-meta">
        {o.location && <span>{o.location}</span>}
        {o.compensation && <span>{o.compensation}</span>}
      </p>
      <div>
        <DeadlineChip closesAt={o.closesAt} />
      </div>
    </article>
  );
}

export function ResourceRow({ r, onDelete }: { r: ResourceDTO; onDelete?: (r: ResourceDTO) => void }) {
  const kind = fileKind(r.file.mimeType);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function download() {
    setBusy(true);
    try {
      await downloadResource(r.id, r.file.name);
    } catch {
      toast.show("Download failed. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="list-row">
      <span className={`file-badge ${kind}`} aria-hidden>
        {kind.toUpperCase()}
      </span>
      <div className="stack-s">
        <h3 className="row-title">{r.title}</h3>
        <p className="card-meta">
          <span>{r.subject}</span>
          <span>
            {r.department}, Year {r.year}, Semester {r.semester}
          </span>
          <span>
            {kind.toUpperCase()} {fileSize(r.file.size)}
          </span>
          <span>{r.uploadedBy.name}</span>
        </p>
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn-sm btn-primary" onClick={() => void download()} disabled={busy} aria-busy={busy || undefined}>
          <Icon name="download" size={16} />
          {busy ? "Preparing…" : "Download"}
          <span className="sr-only"> {r.title}</span>
        </button>
        <BookmarkButton type="resource" id={r.id} initial={r.bookmarked} title={r.title} />
        {onDelete && (
          <button type="button" className="icon-btn" aria-label={`Delete “${r.title}”`} onClick={() => onDelete(r)}>
            <Icon name="trash" />
          </button>
        )}
      </div>
    </div>
  );
}
