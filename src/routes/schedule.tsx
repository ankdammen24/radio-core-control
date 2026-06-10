import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PublicLayout } from "@/components/public-layout";
import { useBootstrapPlayer, usePublicSchedule } from "@/lib/use-public-station";
import { Calendar } from "lucide-react";
import { useMemo, useState } from "react";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export const Route = createFileRoute("/schedule")({
  component: SchedulePage,
  head: () => ({
    meta: [
      { title: "Schedule — Weekly program grid" },
      { name: "description", content: "Browse the weekly broadcast schedule." },
      { property: "og:title", content: "Schedule" },
      { property: "og:description", content: "Weekly broadcast schedule and program blocks." },
    ],
  }),
});

function SchedulePage() {
  const { station } = useBootstrapPlayer();
  const sched = usePublicSchedule(station?.id);
  const [view, setView] = useState<"week" | "list">("week");

  const byDay = useMemo(() => {
    const map: Record<string, ReturnType<typeof Object>[]> = {};
    for (const d of DAYS) map[d] = [];
    for (const b of sched.data ?? []) {
      const day = b.day_of_week.toLowerCase();
      if (!map[day]) map[day] = [];
      map[day].push(b);
    }
    return map;
  }, [sched.data]);

  return (
    <PublicLayout>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
            <Calendar className="w-3 h-3" /> Schedule
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Weekly schedule</h1>
        </div>
        <div className="flex gap-1 border border-border rounded-md p-1">
          <button
            onClick={() => setView("week")}
            className={`px-3 py-1 text-xs rounded ${view === "week" ? "bg-muted" : "text-muted-foreground"}`}
          >Grid</button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1 text-xs rounded ${view === "list" ? "bg-muted" : "text-muted-foreground"}`}
          >List</button>
        </div>
      </div>

      {sched.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading schedule…</div>
      ) : view === "week" ? (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {DAYS.map((d) => (
            <Card key={d} className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{d}</div>
              <ul className="space-y-2">
                {byDay[d].length === 0 && <li className="text-xs text-muted-foreground">—</li>}
                {byDay[d].map((b) => (
                  <li key={(b as { id: string }).id} className="text-sm">
                    <div className="font-medium truncate">{(b as { name: string }).name}</div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      {(b as { start_time: string }).start_time.slice(0, 5)} – {(b as { end_time: string }).end_time.slice(0, 5)}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-border">
            {(sched.data ?? []).map((b) => (
              <li key={b.id} className="p-4 flex items-center gap-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground w-24 shrink-0">{b.day_of_week}</div>
                <div className="flex-1 min-w-0 text-sm truncate">{b.name}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PublicLayout>
  );
}
