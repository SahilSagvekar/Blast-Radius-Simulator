"use client";

import type { Service } from "@/types";
import { STATUS_COLOR } from "@/lib/colors";

interface HealthStripProps {
  services: Service[];
}

export function HealthStrip({ services }: HealthStripProps) {
  const healthy = services.filter((s) => s.status === "HEALTHY").length;
  const degraded = services.filter((s) => s.status === "DEGRADED").length;
  const failed = services.filter((s) => s.status === "FAILED").length;
  const total = services.length;

  const stats = [
    { label: "Total services", value: total, color: "#a1a1aa" },
    { label: "Healthy", value: healthy, color: STATUS_COLOR.HEALTHY },
    { label: "Degraded", value: degraded, color: STATUS_COLOR.DEGRADED },
    { label: "Failed", value: failed, color: STATUS_COLOR.FAILED },
  ];

  return (
    <div className="flex items-stretch gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-950">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800"
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: stat.color }}
          />
          <span className="text-lg font-semibold tabular-nums" style={{ color: stat.color }}>
            {stat.value}
          </span>
          <span className="text-xs text-zinc-500">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
