/**
 * Runtime indicators — reusable broadcast/operations primitives.
 *
 * White-label safe: visual-only, no station-specific copy. Use these
 * across runtime targets, health rollups, dashboard cards, sync flows.
 */
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Canonical runtime states across the product. */
export type RuntimeState =
  | "online"     // green / on-air healthy
  | "degraded"   // warning
  | "offline"    // destructive
  | "syncing"    // info (animated)
  | "idle"       // muted
  | "unknown";

const STATE_TONE: Record<RuntimeState, { dot: string; ring: string; text: string; label: string; pulse?: boolean }> = {
  online:   { dot: "bg-onair",      ring: "border-onair/40",       text: "text-onair",       label: "Online",   pulse: true },
  degraded: { dot: "bg-warning",    ring: "border-warning/40",     text: "text-warning",     label: "Degraded" },
  offline:  { dot: "bg-destructive", ring: "border-destructive/40", text: "text-destructive", label: "Offline" },
  syncing:  { dot: "bg-info",       ring: "border-info/40",        text: "text-info",        label: "Syncing" },
  idle:     { dot: "bg-muted-foreground/40", ring: "border-border", text: "text-muted-foreground", label: "Idle" },
  unknown:  { dot: "bg-muted-foreground/40", ring: "border-border", text: "text-muted-foreground", label: "Unknown" },
};

/** Single-pixel status dot, optionally pulsing for live "On Air" feel. */
export function StatusDot({ state, className }: { state: RuntimeState; className?: string }) {
  const t = STATE_TONE[state];
  return (
    <span
      className={cn(
        "inline-block w-2 h-2 rounded-full shrink-0",
        t.dot,
        t.pulse && "onair-pulse",
        className,
      )}
      aria-label={t.label}
    />
  );
}

/** Compact pill — dot + label, low chrome. */
export function RuntimeBadge({
  state, label, className,
}: { state: RuntimeState; label?: ReactNode; className?: string }) {
  const t = STATE_TONE[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-card/40 px-2.5 h-6 text-[10px] uppercase tracking-wider font-medium",
        t.ring, t.text,
        className,
      )}
    >
      <StatusDot state={state} />
      {label ?? t.label}
    </span>
  );
}

/** Animated three-bar signal indicator — use for "live activity"/syncing rows. */
export function SignalBars({
  active = true, tone = "primary", className,
}: { active?: boolean; tone?: "primary" | "signal" | "success"; className?: string }) {
  const color =
    tone === "signal"  ? "bg-signal" :
    tone === "success" ? "bg-success" :
    "bg-primary";
  return (
    <span className={cn("inline-flex items-end gap-0.5 h-3", className)} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn("w-0.5 rounded-sm", color, !active && "opacity-40")}
          style={{
            height: ["50%", "100%", "70%"][i],
            animation: active ? `signal-bars 1.1s ease-in-out ${i * 0.15}s infinite` : undefined,
            transformOrigin: "bottom",
          }}
        />
      ))}
    </span>
  );
}

/** Maps an arbitrary string status from the DB to a canonical RuntimeState. */
export function toRuntimeState(raw?: string | null): RuntimeState {
  if (!raw) return "unknown";
  const s = raw.toLowerCase();
  if (["ok", "online", "healthy", "ready", "completed", "succeeded", "active", "synced"].includes(s)) return "online";
  if (["degraded", "warning", "warn", "needs_review", "missing_metadata"].includes(s)) return "degraded";
  if (["down", "offline", "error", "failed", "blocked"].includes(s)) return "offline";
  if (["running", "pending", "syncing", "queued"].includes(s)) return "syncing";
  if (["paused", "idle", "untested"].includes(s)) return "idle";
  return "unknown";
}
