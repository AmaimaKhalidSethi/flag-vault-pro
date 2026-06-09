import DOMPurify from "dompurify";
import { renderMarkdown } from "@/lib/markdown";

export function renderCommentMarkdown(md: string): string {
  const raw = renderMarkdown(md);
  // Sanitize, then add target=_blank to external links
  const clean = DOMPurify.sanitize(raw, {
    ADD_ATTR: ["target", "rel"],
  });
  if (typeof window === "undefined") return clean;
  const doc = new DOMParser().parseFromString(clean, "text/html");
  doc.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    if (/^https?:\/\//i.test(href)) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    }
  });
  return doc.body.innerHTML;
}
