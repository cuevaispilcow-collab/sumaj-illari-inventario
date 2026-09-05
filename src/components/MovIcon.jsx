import React from "react";
import {
  TrendingDown, TrendingUp, ArrowLeftRight, ReceiptText,
} from "lucide-react";

export default function MovIcon({ tipo }) {
  if (tipo === "ENTRADA") return <TrendingUp size={14} className="text-emerald-400 shrink-0" />;
  if (tipo === "SALIDA") return <TrendingDown size={14} className="text-stone-400 shrink-0" />;
  if (tipo === "VENTA") return <ReceiptText size={14} className="text-red-400 shrink-0" />;
  return <ArrowLeftRight size={14} className="text-red-400 shrink-0" />;
}

