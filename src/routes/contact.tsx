import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PublicLayout } from "@/components/public-layout";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact" },
      { name: "description", content: "Get in touch." },
      { property: "og:title", content: "Contact" },
      { property: "og:description", content: "Contact information." },
    ],
  }),
});

function ContactPage() {
  return (
    <PublicLayout>
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight mb-4">Contact</h1>
        <Card className="p-6 flex items-start gap-4">
          <Mail className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm">
              Contact details for this station will appear here when configured by an admin.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Listener support, press inquiries and ad-sales contacts can be configured separately.
            </p>
          </div>
        </Card>
      </div>
    </PublicLayout>
  );
}
