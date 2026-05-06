import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function PlaceholderNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-5 border-dashed bg-muted/30">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{children}</div>
    </Card>
  );
}
