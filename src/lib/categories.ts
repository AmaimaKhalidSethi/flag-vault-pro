export const DIFFICULTIES = ["easy", "medium", "hard", "insane"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const CATEGORIES = [
  "web", "pwn", "crypto", "forensics", "rev", "misc", "osint",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const difficultyClass: Record<Difficulty, string> = {
  easy:   "bg-success/15 text-success border border-success/30",
  medium: "bg-warning/15 text-warning border border-warning/30",
  hard:   "bg-[oklch(0.72_0.18_55)]/15 text-[oklch(0.78_0.18_55)] border border-[oklch(0.72_0.18_55)]/30",
  insane: "bg-danger/15 text-danger border border-danger/30",
};

export const categoryClass: Record<Category, string> = {
  web:       "bg-cat-web/15 text-cat-web border border-cat-web/30",
  pwn:       "bg-cat-pwn/15 text-cat-pwn border border-cat-pwn/30",
  crypto:    "bg-cat-crypto/15 text-cat-crypto border border-cat-crypto/30",
  forensics: "bg-cat-forensics/15 text-cat-forensics border border-cat-forensics/30",
  rev:       "bg-cat-rev/15 text-cat-rev border border-cat-rev/30",
  misc:      "bg-cat-misc/15 text-cat-misc border border-cat-misc/30",
  osint:     "bg-cat-osint/15 text-cat-osint border border-cat-osint/30",
};

export function slugify(s: string) {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || `wu-${Date.now()}`;
}
