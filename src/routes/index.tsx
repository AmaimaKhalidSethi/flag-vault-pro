import { createFileRoute, Link } from "@tanstack/react-router";
import { Flag, ShieldCheck, Terminal, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flagvault — CTF writeup management for hacker teams" },
      { name: "description", content: "A clean, dark home for your CTF writeups. Document flags, share with your team, learn faster." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-7 rounded bg-primary text-primary-foreground grid place-items-center font-bold">F</div>
            <span className="font-semibold tracking-tight">Flagvault</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">Sign in</Link>
            <Link to="/auth" className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md font-medium hover:opacity-90">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-grid opacity-60" />
          <div className="relative max-w-4xl mx-auto px-6 py-24 text-center">
            <span className="mono inline-flex text-xs px-2 py-1 rounded border border-border text-primary">
              v1.0 — open beta
            </span>
            <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              Document the flag.<br />
              <span className="text-primary">Own the writeup.</span>
            </h1>
            <p className="mt-5 text-muted-foreground max-w-xl mx-auto">
              A workspace built for CTF teams. Markdown editor, syntax-highlighted code,
              category stats, and team-shared knowledge — all in a clean hacker-aesthetic UI.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link to="/auth" className="bg-primary text-primary-foreground px-5 py-2.5 rounded-md font-medium hover:opacity-90">
                Start writing
              </Link>
              <a href="#features" className="border border-border px-5 py-2.5 rounded-md hover:bg-muted">
                Features
              </a>
            </div>

            <div className="mt-12 mono text-left max-w-lg mx-auto bg-card border border-border rounded-lg p-4 text-sm">
              <span className="text-muted-foreground">$ </span>
              <span className="text-primary">flagvault</span> commit "pwn/babyheap — got RCE via tcache poisoning"
              <div className="text-muted-foreground mt-1">→ writeup #042 published to team blueteam</div>
            </div>
          </div>
        </section>

        <section id="features" className="max-w-5xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-4">
          {[
            { icon: Terminal, title: "Markdown + code", body: "Split-pane editor with syntax highlighting and live preview." },
            { icon: Users,    title: "Team workspace", body: "Invite teammates by code, share writeups privately or publish." },
            { icon: ShieldCheck, title: "Flags hidden", body: "Flag values are masked by default. Reveal on hover." },
            { icon: Flag,     title: "Category stats", body: "Track solves by web/pwn/crypto/forensics/rev/misc/osint." },
            { icon: Terminal, title: "Search everything", body: "Full-text search across titles and bodies." },
            { icon: ShieldCheck, title: "AI-ready", body: "Auto-summarize and auto-tag slots wired in (BYO key)." },
          ].map((f) => (
            <div key={f.title} className="border border-border rounded-lg p-5 bg-card">
              <f.icon className="size-5 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-muted-foreground flex justify-between">
          <span>© Flagvault</span>
          <span className="mono">v0.1.0</span>
        </div>
      </footer>
    </div>
  );
}
