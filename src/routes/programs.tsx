import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PublicLayout } from "@/components/public-layout";
import { Mic } from "lucide-react";

export const Route = createFileRoute("/programs")({
  component: ProgramsPage,
  head: () => ({
    meta: [
      { title: "Programs — Show catalog" },
      { name: "description", content: "Browse our radio programs and recurring shows." },
      { property: "og:title", content: "Programs" },
      { property: "og:description", content: "Recurring shows and program catalog." },
    ],
  }),
});

function ProgramsPage() {
  return (
    <PublicLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
          <Mic className="w-3 h-3" /> Programs
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Programs</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Curated radio shows, recurring programs and on-demand replays.
        </p>
      </div>
      <Card className="p-8 border-dashed text-center">
        <Mic className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-sm font-semibold">Program catalog coming soon</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          The programs module will list every show, host and replay. Admins can populate it from the
          Admin → Programs panel.
        </p>
      </Card>
    </PublicLayout>
  );
}
