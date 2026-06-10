import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PublicLayout } from "@/components/public-layout";
import { useBootstrapPlayer } from "@/lib/use-public-station";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About" },
      { name: "description", content: "About this station." },
      { property: "og:title", content: "About" },
      { property: "og:description", content: "About this radio station." },
    ],
  }),
});

function AboutPage() {
  const { station } = useBootstrapPlayer();
  return (
    <PublicLayout>
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight mb-4">About {station?.name ?? "us"}</h1>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {station?.description ?? "Station description not configured yet. Admins can edit this from the Admin → Stations panel."}
          </p>
        </Card>
      </div>
    </PublicLayout>
  );
}
