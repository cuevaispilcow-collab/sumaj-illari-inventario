import React, { useState } from "react";
import {
  Package, TrendingUp, ArrowLeftRight, PackagePlus, ReceiptText, RotateCcw, Download, LayoutDashboard, Menu, X, LogOut, ShoppingCart, Percent, Factory, ClipboardList, LineChart as LineChartIcon,
} from "lucide-react";
import Logo from "../Logo.jsx";
import { puedeVer } from "../roles.js";

export default function Sidebar({ view, setView, onResetClick, onExportClick, rol, cerrarSesion }) {
  const [abierto, setAbierto] = useState(false);
  const tabsTodas = [
    { id: "dashboard", label: "Panel", icon: LayoutDashboard },
    { id: "productos", label: "Productos", icon: Package },
    { id: "ventas", label: "Ventas", icon: ReceiptText },
    { id: "demanda", label: "Demanda", icon: TrendingUp },
    { id: "analisis", label: "Análisis", icon: LineChartIcon },
    { id: "margenes", label: "Márgenes", icon: Percent },
    { id: "movimientos", label: "Entradas / salidas", icon: ArrowLeftRight },
    { id: "compras", label: "Compras", icon: ShoppingCart },
    { id: "produccion", label: "Producción", icon: Factory },
    { id: "auditoria", label: "Auditoría", icon: ClipboardList },
    { id: "nuevo", label: "Nuevo producto", icon: PackagePlus },
  ];
  const tabs = tabsTodas.filter((t) => puedeVer(rol, t.id));

  const contenidoNav = (
    <>
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <Logo size={48} className="shrink-0" />
        <div>
          <p className="leading-none">
            <span className="text-red-400 font-black tracking-tight text-xl">SUMAJ</span>
            <span className="text-stone-100 font-black tracking-tight text-xl"> ILLARI</span>
          </p>
          <p className="text-xs text-stone-400 font-semibold mt-1">Sistema de gestión</p>
        </div>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const activo = view === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setView(t.id); setAbierto(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activo ? "bg-red-600 text-white shadow-sm" : "text-stone-300 hover:bg-stone-800 hover:text-white"
              }`}
            >
              <Icon size={17} className="shrink-0" />
              {t.label}
            </button>
          );
        })}
      </nav>
      <div className="px-3 pb-5 pt-3 border-t border-stone-800 space-y-1">
        {rol === "gerente" && (
          <button
            onClick={onExportClick}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-300 hover:bg-stone-800 hover:text-white transition"
          >
            <Download size={17} className="shrink-0" /> Exportar Excel
          </button>
        )}
        {rol === "gerente" && (
          <button
            onClick={onResetClick}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-400 hover:bg-stone-800 hover:text-white transition"
          >
            <RotateCcw size={17} className="shrink-0" /> Reiniciar todo
          </button>
        )}
        <button
          onClick={cerrarSesion}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-400 hover:bg-stone-800 hover:text-white transition"
        >
          <LogOut size={17} className="shrink-0" /> Salir
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Barra superior solo en móvil/tablet */}
      <div className="lg:hidden flex items-center justify-between bg-stone-900 text-stone-100 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Logo size={36} />
          <p className="leading-none">
            <span className="text-red-400 font-black tracking-tight text-base">SUMAJ</span>
            <span className="text-stone-100 font-black tracking-tight text-base"> ILLARI</span>
          </p>
        </div>
        <button onClick={() => setAbierto(true)} className="p-2 rounded hover:bg-stone-800">
          <Menu size={22} />
        </button>
      </div>

      {/* Menú deslizable en móvil */}
      {abierto && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-72 bg-stone-900 flex flex-col shadow-xl">
            <div className="flex justify-end px-3 pt-3">
              <button onClick={() => setAbierto(false)} className="p-2 rounded text-stone-300 hover:bg-stone-800">
                <X size={20} />
              </button>
            </div>
            {contenidoNav}
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setAbierto(false)} />
        </div>
      )}

      {/* Barra lateral fija en pantallas grandes */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-stone-900 text-stone-100 lg:sticky lg:top-0 lg:h-screen">
        {contenidoNav}
      </aside>
    </>
  );
}

