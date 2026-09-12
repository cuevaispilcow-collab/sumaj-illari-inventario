import React from "react";
import { DARK_GRID, DARK_TICK, DARK_TOOLTIP, DARK_TOOLTIP_ITEM, DARK_TOOLTIP_LABEL } from "../utils/constants.js";

export default function MetricCard({ icon: Icon, label, value, tone = "default", dark = false, color, hint }) {
  if (dark) {
    const c = color || "#DC2626";
    return (
      <div className="bg-stone-900 rounded-xl border border-stone-800 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</span>
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: c + "26" }}>
            <Icon size={16} style={{ color: c }} />
          </div>
        </div>
        <p className="text-2xl font-semibold text-stone-50 truncate">{value}</p>
        {hint && <p className="text-[10px] text-stone-500 mt-1">{hint}</p>}
      </div>
    );
  }
  const toneClasses = { default: "text-stone-900", danger: "text-red-600", warning: "text-amber-600" };
  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-4">
      <div className="flex items-center gap-2 text-stone-500 mb-1">
        <Icon size={16} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-semibold ${toneClasses[tone]}`}>{value}</p>
      {hint && <p className="text-[10px] text-stone-400 mt-1">{hint}</p>}
    </div>
  );
}

