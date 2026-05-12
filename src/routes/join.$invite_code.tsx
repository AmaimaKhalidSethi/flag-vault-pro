import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/join/$invite_code")({
  component: JoinPage,
});

function JoinPage() {
  const { invite_code } = Route.useParams();
  const nav = useNavigate();
  const [status, setStatus] = useState("Checking…");

  useEffect(() => {
    (async () => {
      const { data: ses } = await supabase.auth.getSession();
      if (!ses.session) {
        sessionStorage.setItem("fv_pending_invite", invite_code);
        nav({ to: "/auth" });
        return;
      }
      setStatus("Joining team…");
      const { error } = await supabase.rpc("join_team_by_code", { _code: invite_code });
      if (error) {
        toast.error(error.message);
        setStatus("Failed: " + error.message);
        return;
      }
      toast.success("Joined team");
      nav({ to: "/team" });
    })();
  }, [invite_code, nav]);

  return (
    <div className="min-h-screen grid place-items-center text-sm text-muted-foreground mono">
      {status}
    </div>
  );
}
