import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export function AppLayout({ children, title, description, actions }: {
  children: ReactNode; title: string; description?: string; actions?: ReactNode;
}) {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !session) nav({ to: "/auth" });
  }, [loading, session, nav]);

  if (loading || !session) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
          <div className="px-8 py-5 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
