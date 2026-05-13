import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function AppLayout({ children, title, description, actions }: {
  children: ReactNode; title: string; description?: string; actions?: ReactNode;
}) {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) nav({ to: "/auth" });
  }, [loading, session, nav]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden lg:block sticky top-0 h-screen">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border">
          <Sidebar onNavigate={() => setMobileOpen(false)} showClose />
        </SheetContent>
      </Sheet>

      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar
          title={title}
          description={description}
          actions={actions}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <div className="p-4 lg:p-8 flex-1">{children}</div>
      </main>
    </div>
  );
}
