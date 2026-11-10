import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addBookmark, removeBookmark } from "../api/endpoints/account";
import { isApiError } from "../api/errors";
import { keys } from "../api/keys";
import type { ContentType } from "../api/types";
import { Icon } from "./Icon";
import { useToast } from "./toast-context";

/** Optimistic toggle (low-risk action): flips at once, rolls back if the server says no. */
export function BookmarkButton({ type, id, initial, title }: { type: ContentType; id: string; initial: boolean; title: string }) {
  const [saved, setSaved] = useState(initial);
  const [pending, setPending] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();

  async function toggle() {
    if (pending) return;
    const next = !saved;
    setSaved(next);
    setPending(true);
    try {
      if (next) await addBookmark(type, id);
      else await removeBookmark(type, id);
      void qc.invalidateQueries({ queryKey: keys.bookmarks });
      toast.show(next ? "Saved to bookmarks" : "Removed from bookmarks");
    } catch (e) {
      if (isApiError(e) && e.code === "CONFLICT") return; // already saved elsewhere: keep "saved"
      setSaved(!next);
      toast.show(isApiError(e) ? e.message : "Couldn't update bookmark.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className="icon-btn"
      aria-pressed={saved}
      aria-label={saved ? `Remove “${title}” from bookmarks` : `Bookmark “${title}”`}
      onClick={() => void toggle()}
      disabled={pending}
    >
      <Icon name="bookmark" filled={saved} />
    </button>
  );
}
