import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PublicLayout } from "@/components/public-layout";
import { Headphones } from "lucide-react";

export const Route = createFileRoute("/podcasts")({
  component: PodcastsPage,
  head: () => ({
    meta: [
      { title: "Podcasts — On-demand episodes" },
      { name: "description", content: "Listen to podcast episodes on demand." },
      { property: "og:title", content: "Podcasts" },
      { property: "og:description", content: "On-demand podcast episodes." },
    ],
  }),
});

function PodcastsPage() {
  return (
    <PublicLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
          <Headphones className="w-3 h-3" /> Podcasts
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Podcasts</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          On-demand episodes from our shows. RSS feeds will be available per podcast.
        </p>
      </div>
      <Card className="p-8 border-dashed text-center">
        <Headphones className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-sm font-semibold">Podcast feed coming soon</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          Episodes and podcast metadata will appear here once the podcast module is enabled.
        </p>
      </Card>
    </PublicLayout>
  );
}
