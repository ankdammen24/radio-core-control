/**
 * RadioCoreLogo — product mark for Radio Core.
 *
 * White-label safe: this is the *product* logo, not a station/customer logo.
 * Station branding is rendered separately via the StationSwitcher.
 *
 * Mark: concentric broadcast waves emanating from a central node, evoking
 *       a transmitter / control-room feel. Pure currentColor SVG so it
 *       inherits the surrounding text color and works on any surface.
 */
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg";

const SIZES: Record<Size, { box: string; mark: number; title: string; sub: string }> = {
  xs: { box: "h-6", mark: 18, title: "text-[11px]", sub: "text-[8px]" },
  sm: { box: "h-7", mark: 22, title: "text-xs",    sub: "text-[9px]" },
  md: { box: "h-9", mark: 28, title: "text-sm",    sub: "text-[10px]" },
  lg: { box: "h-11", mark: 36, title: "text-base", sub: "text-[11px]" },
};

export function RadioCoreMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* Outer broadcast arcs */}
      <path d="M5.5 11.5a13 13 0 0 1 21 0" strokeWidth="1.6" opacity="0.55" />
      <path d="M5.5 20.5a13 13 0 0 0 21 0" strokeWidth="1.6" opacity="0.55" />
      {/* Inner arcs */}
      <path d="M9.5 13.5a8 8 0 0 1 13 0" strokeWidth="1.6" />
      <path d="M9.5 18.5a8 8 0 0 0 13 0" strokeWidth="1.6" />
      {/* Core node */}
      <circle cx="16" cy="16" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function RadioCoreLogo({
  size = "md",
  showWordmark = true,
  tone = "auto",
  className,
}: {
  size?: Size;
  showWordmark?: boolean;
  /**
   * "auto" inherits text color (use inside a colored container).
   * "brand" forces the broadcast accent for the mark.
   */
  tone?: "auto" | "brand";
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <div className={cn("flex items-center gap-2.5", s.box, className)}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-md",
          tone === "brand" && "text-sidebar-primary",
        )}
        style={{ width: s.mark + 6, height: s.mark + 6 }}
      >
        <RadioCoreMark size={s.mark} />
      </div>
      {showWordmark && (
        <div className="leading-tight min-w-0">
          <div className={cn("font-semibold tracking-[0.14em] uppercase", s.title)}>
            Radio<span className="text-primary">Core</span>
          </div>
          <div className={cn("uppercase tracking-[0.22em] text-muted-foreground/80", s.sub)}>
            Control Plane
          </div>
        </div>
      )}
    </div>
  );
}
