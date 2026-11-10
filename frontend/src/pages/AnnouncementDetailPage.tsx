import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { deleteAnnouncement, getAnnouncement } from "../api/endpoints/content";
import { isApiError } from "../api/errors";
import { keys } from "../api/keys";
import { useCanChange } from "../auth/use-can-change";
import { BookmarkButton } from "../components/BookmarkButton";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Icon } from "../components/Icon";
import { useToast } from "../components/toast-context";
import { ErrorState, NotFoundInline } from "../components/ui";
import { audienceLabel, formatDate, formatDateTime, ROLE_LABEL } from "../lib/format";
import { useDocumentTitle } from "../lib/use-document-title";

export function AnnouncementDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: [...keys.announcements, "detail", id],
    queryFn: ({ signal }) => getAnnouncement(id, signal),
  });
  const a = query.data;
  useDocumentTitle(a?.title ?? "Announcement");
  const { canEdit, canDelete } = useCanChange("announcement", a?.author.id);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    setDeleting(true);
    try {
      await deleteAnnouncement(id);
      await qc.invalidateQueries({ queryKey: keys.announcements });
      toast.show("Announcement deleted");
      navigate("/announcements", { replace: true });
    } catch (e) {
      toast.show(isApiError(e) ? e.message : "Couldn't delete.", "error");
      setDeleting(false);
      setConfirm(false);
    }
  }

  if (query.isPending) return <div className="container page"><div className="skeleton" style={{ height: 320, marginTop: 40 }} /></div>;
  if (query.isError) {
    if (isApiError(query.error) && query.error.code === "NOT_FOUND")
      return <NotFoundInline what="announcement" backTo="/announcements" backLabel="All announcements" />;
    return <div className="container section"><ErrorState error={query.error} onRetry={() => void query.refetch()} /></div>;
  }
  if (!a) return null;

  return (
    <div className="page container">
      <nav className="crumbs section" aria-label="Breadcrumb">
        <Link to="/announcements">Announcements</Link>
        <Icon name="arrowRight" size={14} />
        <span aria-current="page" className="clamp-2">{a.title}</span>
      </nav>
      <div className="split" style={{ marginTop: "var(--space-6)" }}>
        <article className="article stack">
          <div className="chip-row">
            {a.pinned && <span className="chip chip-night">Pinned</span>}
            {a.status === "draft" && <span className="chip chip-warning">Draft — only you can see this</span>}
            <span className="chip chip-mint">{audienceLabel(a.audience)}</span>
          </div>
          <h1 id="page-title" tabIndex={-1}>{a.title}</h1>
          <p className="card-meta">
            <span>{a.author.name}</span>
            <span>{formatDate(a.publishAt ?? a.createdAt)}</span>
          </p>
          <div className="article-body">{a.body}</div>
        </article>
        <aside className="card aside-card stack">
          <dl className="meta-list">
            <div><dt>Posted by</dt><dd>{a.author.name}, {ROLE_LABEL[a.author.role]}</dd></div>
            <div><dt>Audience</dt><dd>{audienceLabel(a.audience)}</dd></div>
            <div><dt>Published</dt><dd>{formatDateTime(a.publishAt ?? a.createdAt)}</dd></div>
            {a.expiresAt && <div><dt>Expires</dt><dd>{formatDate(a.expiresAt)}</dd></div>}
          </dl>
          <div className="row">
            <BookmarkButton type="announcement" id={a.id} initial={a.bookmarked} title={a.title} />
            <span className="small muted">Save for later</span>
          </div>
          {(canEdit || canDelete) && (
            <div className="row">
              {canEdit && (
                <Link to={`/announcements/${a.id}/edit`} className="btn btn-sm">
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
        title="Delete this announcement?"
        confirmLabel="Delete announcement"
        danger
        pending={deleting}
        onConfirm={() => void onDelete()}
        onCancel={() => setConfirm(false)}
      >
        <p>
          “{a.title}” will be removed for everyone. This can't be undone from the app.
        </p>
      </ConfirmDialog>
    </div>
  );
}
