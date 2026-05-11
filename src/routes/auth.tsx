import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Github, Mail } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Flagvault" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/dashboard" });
    });
  }, [nav]);

  async function emailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/onboarding" },
        });
        if (error) throw error;
        toast.success("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/onboarding" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Auth failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function magicLink() {
    if (!email) return toast.error("Enter your email first");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + "/onboarding" },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Magic link sent! Check your inbox.");
  }

  async function googleAuth() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/onboarding" },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex flex-1 bg-grid relative border-r border-border">
        <div className="m-auto text-center px-10">
          <div className="mono text-primary text-xs">~/flagvault</div>
          <h2 className="text-3xl font-bold mt-2">Welcome back, hacker.</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            Document the flag. Own the writeup. Share with your team.
          </p>
        </div>
      </div>
      <div className="flex-1 grid place-items-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8">
            <div className="size-7 rounded bg-primary text-primary-foreground grid place-items-center font-bold">F</div>
            <span className="font-semibold">Flagvault</span>
          </div>
          <h1 className="text-2xl font-semibold">{mode === "signin" ? "Sign in" : "Create account"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin" ? "Welcome back." : "Start documenting your CTFs."}
          </p>

          <form onSubmit={emailAuth} className="mt-6 space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={magicLink} disabled={loading}>
              <Mail className="size-4 mr-2" /> Send magic link
            </Button>
            <Button variant="outline" className="w-full" onClick={googleAuth}>
              <Github className="size-4 mr-2" /> Continue with Google
            </Button>
          </div>

          <p className="mt-6 text-sm text-center text-muted-foreground">
            {mode === "signin" ? "No account?" : "Already have one?"}{" "}
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-primary hover:underline">
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
