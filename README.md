# Sumaj Illari — Sistema de Inventarios / ERP

Sistema de control de inventarios para Sumaj Illari (confecciones/textiles),
construido paso a paso como base de un ERP modular.

## Stack
- React + Vite + Tailwind CSS
- Firebase (Firestore + Authentication)
- Publicado en GitHub Pages

## Cómo correr el proyecto localmente

```bash
npm install
npm run dev       # servidor de desarrollo
npm run build     # genera la carpeta dist/ (lo que se sube a GitHub Pages)
```

## Estructura

```
src/
├── App.jsx            # todas las vistas: Panel, Productos, Ventas, Compras,
│                       # Márgenes, Producción (Fichas técnicas), Demanda,
│                       # Análisis, Entradas/salidas, Nuevo producto, etc.
├── AuthGate.jsx        # login y control de sesión (Firebase Auth)
├── firebase.js         # configuración de conexión a Firebase
├── firestoreSync.js    # guardado y escucha en tiempo real (Firestore)
├── roles.js            # qué secciones ve cada rol (gerente / vendedora)
├── Logo.jsx            # logo vectorizado + animación de cadenas del login
├── index.css           # estilos base (Tailwind + animaciones)
└── main.jsx            # punto de entrada de la app
```

## Módulos del sistema

- **Panel** — resumen general con gráficos (Recharts)
- **Productos** — catálogo con edición y eliminación
- **Ventas** — registro con Efectivo/Yape/Tarjeta
- **Compras** — costo y proveedor, actualiza el costo promedio ponderado
- **Producción** — Fichas técnicas (BOM) y registro de producción;
  soporta cadena de dos pasos Materia prima → En proceso → Terminado
- **Márgenes** — margen de ganancia real por producto, usando el costo
  congelado en cada venta
- **Demanda** / **Análisis** — reportes y proyecciones
- **Entradas/salidas** — ajustes manuales de stock
- **Nuevo producto** — alta de productos al catálogo

Roles: **gerente** ve todo; **vendedora** ve Productos, Ventas,
Entradas/salidas y Nuevo producto (sin costos ni márgenes).

## Despliegue

El contenido de `dist/` (después de `npm run build`) se sube directamente
a la raíz de este repositorio (`index.html`, `app.css`, `app.js`), que es
lo que sirve GitHub Pages. Los nombres de archivo son fijos (sin hash),
así que cada actualización simplemente reemplaza esos 3 archivos.
