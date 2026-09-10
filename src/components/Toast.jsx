import React from "react";
import {
  CheckCircle2, XCircle,
} from "lucide-react";

export default function Toast({ type, msg }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${type === "success" ? "bg-stone-900 text-white" : "bg-red-600 text-white peligro"}`}>
        {type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
        {msg}
      </div>
    </div>
  );
}

