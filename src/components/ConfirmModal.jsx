import React from "react";

export default function ConfirmModal({ title, body, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg p-5 max-w-sm w-full">
        <h3 className="font-semibold text-stone-900 mb-2">{title}</h3>
        <p className="text-sm text-stone-600 mb-4">{body}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 rounded text-sm font-medium border border-stone-300 text-stone-600 hover:bg-stone-50">
            Cancelar
          </button>
          <button onClick={onConfirm} className="px-3 py-1.5 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 peligro">
            Sí, reiniciar
          </button>
        </div>
      </div>
    </div>
  );
}

