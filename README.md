# Gestor CONAGUA

Aplicación de escritorio local (*Offline-First*) desarrollada para la administración, control de circulación y trazabilidad auditable de expedientes físicos en la **Comisión Nacional del Agua (CONAGUA)**, específicamente en apoyo a la Subdirección de Administración del Agua.

Reemplaza bitácoras en papel y hojas de cálculo dispersas por un entorno ligero y autónomo que opera directamente en estaciones Windows sin depender de servidores externos ni conexión a internet.

---

## Características principales

- **Tablero interactivo y vista cronológica:** Visualización en tiempo real mediante tablero **Kanban** con código de colores por área, vista alternativa de **Tiempo** y modo **Ultra Compacto** para monitoreo de alta densidad.
- **Gestión de áreas operativas y archivo lógico:** Control de flujo entre las 9 áreas activas (*CIS, Atención a Usuarios, Dictaminación, Subdirección de Administración del Agua, Calificación de Infracciones, Inspección, Técnica, Jurídico y Dirección*) más el **Archivo General (`ARCHIVO`)**. Los expedientes no se eliminan físicamente; se retiran del tablero activo conservando íntegro su historial.
- **Transferencias ágiles:** Movimiento de expedientes mediante arrastre (*Drag & Drop*) con desplazamiento horizontal automático o mediante ventana modal con justificación.
- **Auditoría inmutable de doble vertiente:** Centro de Auditoría e Historial Global separado en **Historial Documental y Observaciones** e **Historial de Transferencias**, registrando fecha, hora, valores previos/nuevos y justificación por cada cambio.
- **Búsqueda reactiva y exportación multiformato:** Filtros inteligentes por columna, rangos de fecha, ocultamiento dinámico de columnas vacías y exportación directa de resultados filtrados a **CSV (UTF-8 con BOM)**, **Excel (`.xls`)** y **PDF**.
- **Persistencia local y respaldos:** Almacenamiento en `localStorage`, exportación e importación manual de respaldos en `.JSON` mediante diálogos nativos de Windows, auto-respaldo automático en carpeta de disco seleccionada y hasta 3 instantáneas internas rotativas (*snapshots*).
- **Validaciones preventivas:** Bloqueo de campos obligatorios vacíos al editar, prevención de transferencias hacia la misma área, alertas ante exportaciones sin coincidencias y protección contra archivos `.JSON` corruptos o incompatibles.

---

## Stack tecnológico

- **Framework de escritorio:** [Tauri v2](https://v2.tauri.app/) (Backend en Rust + Microsoft Edge WebView2)
- **Plugins nativos:** `@tauri-apps/plugin-dialog` y `@tauri-apps/plugin-fs`
- **Frontend:** HTML5, CSS3 modular y JavaScript
- **Sistema operativo objetivo:** Windows 10 / Windows 11

---

## Estructura del proyecto

```text
Gestor-CONAGUA/
├── src/
│   ├── index.html          # Estructura principal y modales de la interfaz
│   ├── css/
│   │   ├── variables.css   # Tokens de diseño y colores por área
│   │   ├── layout.css      # Barra superior, barra lateral y estructura general
│   │   ├── kanban.css      # Tablero Kanban, tarjetas y vista de tiempo
│   │   ├── tables.css      # Archivo General Completo y Centro de Auditoría
│   │   └── modals.css      # Ventanas modales, formularios y validaciones
│   └── js/
│       └── main.js         # Controlador principal, persistencia, exportación y respaldos
└── src-tauri/
    ├── Cargo.toml          # Dependencias y configuración de Rust
    ├── tauri.conf.json     # Configuración de ventana, empaquetado e íconos
    ├── capabilities/       # Permisos nativos de diálogo y sistema de archivos
    └── src/                # Núcleo nativo en Rust
```

## Requisitos y ejecución en desarrollo
### Requisitos previos
- Node.js (LTS)
- Rust y Cargo
- Microsoft Edge WebView2 (incluido por defecto en Windows 10/11)

## Comandos principales
Instalar dependencias:
`npm install`

Ejecutar en modo desarrollo:
`npm run tauri dev`

Compilar instalador / ejecutable de producción:
`npm run tauri build`

## Limpiar caché / reiniciar datos locales:
Para restablecer la base de datos local desde la consola de herramientas de desarrollo (DevTools) durante pruebas:
`localStorage.clear(); location.reload();`

Proyecto desarrollado por Miguel Ángel Rosales Soto como parte de la estadía profesional de la carrera de Desarrollo de Software Multiplataforma en la Universidad Tecnológica de Durango (UTD), en colaboración con el Departamento de Innovación, Calidad e Informática de la Comisión Nacional del Agua (CONAGUA).
