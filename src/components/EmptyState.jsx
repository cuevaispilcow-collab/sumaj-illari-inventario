import React from "react";
import {
  Plus,
} from "lucide-react";

export default function EmptyState({ icon: Icon, title, body, actionLabel, onAction, dark = false }) {
  if (dark) {
    return (
      <div className="bg-stone-900 rounded-lg border border-dashed border-stone-700 p-10 text-center">
        <Icon size={28} className="mx-auto text-stone-600 mb-3" />
        <p className="font-medium text-stone-200 mb-1">{title}</p>
        <p className="text-sm text-stone-400 mb-4 max-w-sm mx-auto">{body}</p>
        {actionLabel && (
          <button onClick={onAction} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition inline-flex items-center gap-2">
            <Plus size={15} /> {actionLabel}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="bg-white rounded-lg border border-dashed border-stone-300 p-10 text-center">
      <Icon size={28} className="mx-auto text-stone-300 mb-3" />
      <p className="font-medium text-stone-700 mb-1">{title}</p>
      <p className="text-sm text-stone-500 mb-4 max-w-sm mx-auto">{body}</p>
      {actionLabel && (
        <button onClick={onAction} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition inline-flex items-center gap-2">
          <Plus size={15} /> {actionLabel}
        </button>
      )}
    </div>
  );
}

