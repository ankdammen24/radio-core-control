import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlaceholderNoticeProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
}

export function PlaceholderNotice({ title, children, className }: PlaceholderNoticeProps) {
  return (
    <div className={cn("rounded-lg border border-dashed border-border bg-muted/30 p-6", className)}>
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
        </div>
      </div>
    </div>
  );
}
