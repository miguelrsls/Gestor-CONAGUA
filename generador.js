const fs = require('fs');
const path = require('path');

const dirs = [
  'src/css',
  'src/js',
  'src-tauri/src',
  'src-tauri/capabilities'
];

const files = {
  // --- FRONTEND: HTML COMPLETO CON TODOS LOS MODALES ---
  'src/index.html': `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CONAGUA - Gestor Local de Expedientes</title>
  <link rel="stylesheet" href="css/variables.css">
  <link rel="stylesheet" href="css/layout.css">
  <link rel="stylesheet" href="css/kanban.css">
  <link rel="stylesheet" href="css/tables.css">
  <link rel="stylesheet" href="css/modals.css">
</head>
<body>

<div class="topbar">
  <div class="topbar-title">[CONAGUA] Gestor Local de Expedientes</div>
  <div class="topbar-actions">
    <span style="font-size: 14px; color: var(--md-sys-color-on-surface-variant); font-weight: 500;">Administrador Local</span>
  </div>
</div>

<div class="app-container">
  <div class="sidebar">
    <div class="sidebar-header-row">
      <h2 id="sidebarTitle">Archivo General</h2>
      <button class="btn-tonal" onclick="abrirModalInventario()">Ver todo</button>
    </div>
    
    <select class="control-modern" id="sidebarAreaFilter" onchange="render()">
      <option value="todas">Todas las ubicaciones</option>
      <option value="ARCHIVO">Solo en Archivo Fisico</option>
      <option value="CIS">Centro Integral de Servicios</option>
      <option value="DICTAMINACION">Dictaminacion</option>
      <option value="SUBDIRECTOR">Subdireccion Adm. Agua</option>
      <option value="INFRACCIONES">Calificacion de Infracciones</option>
      <option value="INSPECCION">Inspeccion</option>
      <option value="TECNICA">Tecnica</option>
      <option value="JURIDICO">Juridico</option>
      <option value="DIRECCION">Direccion</option>
    </select>
    
    <input type="text" class="search-box" id="searchBox" placeholder="Buscar ID, Titulo, No. Exp, Obs..." oninput="render()">

    <div class="section-container" id="inventory-list"></div>
    
    <div class="sidebar-header-row" style="margin-top: 16px;">
      <h2>Actividad Global</h2>
      <button class="btn-tonal" onclick="abrirModalAuditoriaGlobal()">Registro Completo</button>
    </div>
    <div class="logs-box" id="logs-list"></div>
  </div>

  <div class="main-content">
    <div class="board-header-bar">
      <h2 id="boardHeaderTitle">Tablero de Circulacion Activa</h2>
      <div class="filter-header">
        <div class="filter-left">
          <input type="text" class="search-box" id="boardSearchBox" placeholder="Filtrar en tablero (Busca y oculta columnas vacías)..." oninput="render()" style="height: 40px; padding: 0 16px;">
        </div>
        <div class="filter-right">
          <button class="compact-toggle-btn" id="btnCompactToggle" onclick="toggleCompactMode()">Vista: Ultra Compacta</button>
          
          <select class="control-modern" id="boardAreaFilter" onchange="render()" style="height: 40px; padding: 0 16px;">
            <option value="todas">Todas las Areas</option>
            <option value="CIS">CIS</option>
            <option value="DICTAMINACION">Dictaminacion</option>
            <option value="SUBDIRECTOR">Subdireccion Adm. Agua</option>
            <option value="INFRACCIONES">Infracciones</option>
            <option value="INSPECCION">Inspeccion</option>
            <option value="TECNICA">Tecnica</option>
            <option value="JURIDICO">Juridico</option>
            <option value="DIRECCION">Direccion</option>
          </select>
          <input type="date" class="search-box" id="boardDateFilter" onchange="render()" style="width: 140px; height: 40px; padding: 0 12px;">
          <div class="view-switcher">
            <button class="view-btn active" id="btnKanban" onclick="cambiarVista('kanban')">Kanban</button>
            <button class="view-btn" id="btnTimeline" onclick="cambiarVista('timeline')">Tiempo</button>
          </div>
        </div>
      </div>
    </div>

    <div class="view-container" id="viewKanban"><div class="kanban-columns-container" id="kanbanColumnsContainer"></div></div>
    <div class="view-container" id="viewTimeline" style="display: none;"><div class="timeline-container" id="timelineListContainer"></div></div>
  </div>
</div>

<div id="toastContainer"></div>

<!-- MODAL: ARCHIVO GENERAL -->
<div class="modal-overlay" id="modalInventario">
  <div class="modal-container">
    <div class="modal-header">
      <div style="display:flex; align-items:center; gap:16px;">
        <h2>Archivo General Completo</h2>
        <button class="btn-card-outline" onclick="limpiarFiltrosInventario()" id="btnLimpiarFiltrosInv" style="display:none;">Limpiar Filtros</button>
      </div>
      <div style="display:flex; gap:12px;">
        <button class="btn-filled" onclick="abrirModalCrearExpediente()">Registrar Nuevo Expediente</button>
        <button class="control-modern" onclick="cerrarModalInventario()">Cerrar</button>
      </div>
    </div>
    <div class="modal-body">
      <div style="display: flex; gap: 12px; margin-bottom: 16px; align-items:center; flex-wrap: wrap;">
        <input type="text" class="search-box" id="modalSearchBox" placeholder="Busqueda libre general..." oninput="render()" style="flex-grow:1; max-width: 260px;">
        <select class="control-modern" id="modalAreaFilter" onchange="render()">
          <option value="todas">Todas las Areas</option>
          <option value="ARCHIVO">En Archivo</option>
          <option value="CIS">CIS</option>
          <option value="DICTAMINACION">Dictaminacion</option>
          <option value="SUBDIRECTOR">Sub. Adm. Agua</option>
          <option value="INFRACCIONES">Infracciones</option>
          <option value="INSPECCION">Inspeccion</option>
          <option value="TECNICA">Tecnica</option>
          <option value="JURIDICO">Juridico</option>
          <option value="DIRECCION">Direccion</option>
        </select>
        <div style="display:flex; align-items:center; gap:8px;"><span style="font-weight:500; font-size:13px;">Desde:</span><input type="date" class="search-box" id="modalDateFrom" onchange="render()" style="width: 130px; height:40px;"></div>
        <div style="display:flex; align-items:center; gap:8px;"><span style="font-weight:500; font-size:13px;">Hasta:</span><input type="date" class="search-box" id="modalDateTo" onchange="render()" style="width: 130px; height:40px;"></div>
        <select class="control-modern" id="modalSortOrder" onchange="render()">
          <option value="desc">Mas Recientes (Registro)</option>
          <option value="asc">Mas Antiguos (Registro)</option>
        </select>
      </div>
      <div class="modal-list-container">
        <table class="compact-table">
          <thead>
            <tr>
              <th>ID Sistema<br><input type="text" class="col-filter-input" id="inv-f-sys" placeholder="Filtrar..." oninput="render()"></th>
              <th style="min-width:140px;">Titulo / Clave Externa<br><input type="text" class="col-filter-input" id="inv-f-titulo" placeholder="Filtrar..." oninput="render()"></th>
              <th>No. Expediente<br><input type="text" class="col-filter-input" id="inv-f-exp" placeholder="Filtrar..." oninput="render()"></th>
              <th>Titular<br><input type="text" class="col-filter-input" id="inv-f-titular" placeholder="Filtrar..." oninput="render()"></th>
              <th style="min-width:140px;">Observaciones libres<br><input type="text" class="col-filter-input" id="inv-f-obs" placeholder="Filtrar..." oninput="render()"></th>
              <th>Area Actual<br><input type="text" class="col-filter-input" id="inv-f-area" placeholder="Filtrar..." oninput="render()"></th>
              <th>F. Registro<br><input type="text" class="col-filter-input" id="inv-f-fecha" placeholder="Filtrar..." oninput="render()"></th>
              <th style="min-width: 220px;">Acciones</th>
            </tr>
          </thead>
          <tbody id="modal-table-body"></tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- MODAL: AUDITORIA GLOBAL -->
<div class="modal-overlay" id="modalAuditoriaGlobal">
  <div class="modal-container">
    <div class="modal-header">
      <div style="display:flex; align-items:center; gap:16px;">
        <h2>Centro de Auditoria e Historial Global</h2>
        <button class="btn-card-outline" onclick="limpiarFiltrosAuditoria()" id="btnLimpiarFiltros" style="display:none;">Limpiar Filtros</button>
      </div>
      <div style="display:flex; gap:12px; align-items:center;">
        <div style="display: flex; border-right: 1px solid var(--md-sys-color-outline-variant); padding-right: 12px; gap: 8px;">
          <button class="btn-tonal" style="background:#e8f0fe; color:#1a73e8;" onclick="simularExportacion('CSV')">CSV</button>
          <button class="btn-tonal" style="background:#e6f4ea; color:#137333;" onclick="simularExportacion('Excel')">Excel</button>
          <button class="btn-tonal" style="background:#fce8e6; color:#c5221f;" onclick="simularExportacion('PDF')">PDF</button>
        </div>
        <button class="control-modern" onclick="cerrarModalAuditoriaGlobal()">Cerrar</button>
      </div>
    </div>
    <div class="modal-body">
      <div style="display: flex; gap: 16px; margin-bottom: 20px; align-items:center; justify-content:space-between; flex-wrap: wrap;">
        <div class="view-switcher" style="height: 44px;">
          <button class="view-btn active" id="tabDocGlobal" onclick="cambiarTabAuditoria('documental')">Historial Documental y Obs.</button>
          <button class="view-btn" id="tabMovGlobal" onclick="cambiarTabAuditoria('transferencias')">Historial de Transferencias</button>
        </div>

        <div style="display: flex; gap: 12px; align-items:center;">
          <input type="text" class="search-box" id="auditSearchBox" placeholder="Busqueda global..." oninput="renderAuditoria()" style="width: 240px;">
          <div style="display:flex; align-items:center; gap:8px;"><span style="font-weight:500; font-size:13px;">Desde:</span><input type="date" class="search-box" id="auditDateFrom" onchange="renderAuditoria()" style="width: 130px; height:40px;"></div>
          <div style="display:flex; align-items:center; gap:8px;"><span style="font-weight:500; font-size:13px;">Hasta:</span><input type="date" class="search-box" id="auditDateTo" onchange="renderAuditoria()" style="width: 130px; height:40px;"></div>
        </div>
      </div>

      <div class="modal-list-container">
        <table class="compact-table" id="tablaAuditoria">
          <thead id="audit-table-head"></thead>
          <tbody id="audit-table-body"></tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- POPUPS DE ACCION / DETALLES -->
<div class="action-modal-overlay" id="actionModalOverlay">
  <div class="action-modal-container">
    <h3 id="actionModalTitle">Titulo</h3><p id="actionModalSubtitle">Subtitulo</p>
    <div id="actionModalFieldsContainer" style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;"></div>
    <div class="action-modal-actions"><button class="control-modern" onclick="cerrarActionModal()">Cancelar</button><button class="btn-filled" id="actionModalSubmitBtn" onclick="ejecutarAccionPopup()">Guardar Cambios</button></div>
  </div>
</div>

<div class="action-modal-overlay" id="detallesModalOverlay">
  <div class="action-modal-container" style="max-width: 780px;">
    <h3>Detalles del Expediente</h3><p id="detallesSubtitle" style="margin-bottom: 8px;">Auditoria individual.</p>
    <div style="background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); padding: 16px; border-radius: 12px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <span style="font-size: 12px; font-weight: 500; opacity: 0.8;">Titulo Actual Activo:</span>
        <div id="detallesTituloActual" style="font-size: 20px; font-weight: 700; margin: 4px 0;">TIT-XXXX</div>
        <div id="detallesIdSysActual" class="sys-id-tag" style="background: rgba(0,0,0,0.1); color: var(--md-sys-color-on-primary-container);">SYS-XXXX</div>
      </div>
      <div style="text-align:right;">
        <span style="font-size: 12px; font-weight: 500; opacity: 0.8;">Fecha de Registro Original:</span>
        <div id="detallesFechaRegistro" style="font-size: 14px; font-weight: 700;">--/--/----</div>
      </div>
    </div>
    
    <div class="mini-bitacora-grid">
      <div class="mini-bitacora-col"><h4>Historial Documental y Obs.</h4><div id="detallesMiniBitacoraTitulos"></div></div>
      <div class="mini-bitacora-col"><h4>Historial de Transferencias</h4><div id="detallesMiniBitacoraMovimientos"></div></div>
    </div>

    <div style="margin-top: 16px; display: flex; justify-content: flex-start;">
      <button class="btn-tonal" id="btnVerEnAuditoriaGlobal" onclick="" style="background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container);">Ver en Historial y Auditoria Global</button>
    </div>

    <div class="action-modal-actions" style="margin-top: 16px;"><button class="control-modern" onclick="cerrarDetallesModal()">Cerrar Historial</button></div>
  </div>
</div>

<script src="js/main.js"></script>
</body>
</html>`,

  // --- LÓGICA COMPLETA JAVASCRIPT SIN DEPENDENCIAS EXTERNAS QUE FALLEN ---
  'src/js/main.js': `function mostrarToast(mensaje) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.innerText = mensaje;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => container.removeChild(toast), 300); }, 3500);
}

function generarIdSistema() { return 'SYS-' + Math.random().toString(36).substr(2, 6).toUpperCase(); }

let isCompactView = false;
function toggleCompactMode() {
  isCompactView = !isCompactView;
  const btn = document.getElementById('btnCompactToggle');
  btn.classList.toggle('active', isCompactView);
  btn.innerHTML = isCompactView ? 'Vista: Standard' : 'Vista: Ultra Compacta';
  document.getElementById('viewKanban').classList.toggle('is-compact', isCompactView);
  document.getElementById('viewTimeline').classList.toggle('is-compact', isCompactView);
}

function getPastTimestamp(daysAgo) { return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).getTime(); }

function obtenerFechaYHora(fechaIngresadaISO) {
  let d = new Date();
  let anio, mes, dia;
  if (fechaIngresadaISO) {
    let p = fechaIngresadaISO.split('-');
    anio = p[0]; mes = p[1]; dia = p[2];
    d.setFullYear(anio, mes - 1, dia);
  } else {
    anio = d.getFullYear(); mes = String(d.getMonth() + 1).padStart(2, '0'); dia = String(d.getDate()).padStart(2, '0');
  }
  let horas = d.getHours(); let minutos = String(d.getMinutes()).padStart(2, '0');
  let ampm = horas >= 12 ? 'PM' : 'AM'; horas = horas % 12 || 12; let horasStr = String(horas).padStart(2, '0');
  
  return { 
    formatted: dia + '/' + mes + '/' + anio + ' ' + horasStr + ':' + minutos + ' ' + ampm, 
    iso: anio + '-' + mes + '-' + dia, 
    dateOnly: dia + '/' + mes + '/' + anio, 
    timestamp: d.getTime() 
  };
}

let expedientes = [
  {
    idSys: 'SYS-R9B2X1', id: 'EXP-CNA-001', titulo: 'TIT-2026-X89C', titular: 'Ejido La Victoria', area: 'TECNICA', observacion: 'Falta revision de firmas y anexos tecnicos.',
    fechaRegistro: '20/09/2026', tsRegistro: getPastTimestamp(10), dateISO: '2026-09-25', tiempo: '25/09/2026 10:00 AM', lastModified: getPastTimestamp(5), 
    enTablero: true,
    historial: [
      { ts: getPastTimestamp(5), tipo: 'movimiento', usuario: 'Admin Local', tituloActual: 'TIT-2026-X89C', origen: 'ARCHIVO', destino: 'TECNICA', fecha: '25/09/2026 10:00 AM', nota: 'Ingreso a bandeja para revision tecnica', iso: '2026-09-25' },
      { ts: getPastTimestamp(6), tipo: 'observacion', usuario: 'Admin Local', tituloActual: 'TIT-2026-X89C', previo: 'Ninguna', actual: 'Falta revision de firmas', fecha: '24/09/2026 14:10 PM', nota: 'Anadido durante revision', iso: '2026-09-24' },
      { ts: getPastTimestamp(6), tipo: 'titulo', usuario: 'Admin Local', tituloActual: 'TIT-2026-X89C', previo: 'TIT-2026-X89B', actual: 'TIT-2026-X89C', fecha: '24/09/2026 14:00 PM', nota: 'Reporte tecnico preliminar agregado', iso: '2026-09-24' },
      { ts: getPastTimestamp(10), tipo: 'movimiento', usuario: 'Admin Local', tituloActual: 'TIT-2026-X89A', origen: 'Nuevo', destino: 'ARCHIVO', fecha: '20/09/2026 09:00 AM', nota: 'Creacion de expediente', iso: '2026-09-20' }
    ]
  },
  {
    idSys: 'SYS-M4L9Q2', id: 'EXP-CNA-015', titulo: 'ACTA-INS-992', titular: 'Desarrollos Norte S.A.', area: 'INSPECCION', observacion: 'URGENTE: Inspección en sitio requerida antes del viernes por denuncia anónima.',
    fechaRegistro: '01/10/2026', tsRegistro: getPastTimestamp(4), dateISO: '2026-10-01', tiempo: '01/10/2026 11:30 AM', lastModified: getPastTimestamp(4), 
    enTablero: true, historial: []
  },
  {
    idSys: 'SYS-K1P7T8', id: 'EXP-CNA-022', titulo: 'RESOLUCION-04B', titular: 'Municipio San Juan', area: 'JURIDICO', observacion: 'Solo falta firma autógrafa.',
    fechaRegistro: '03/10/2026', tsRegistro: getPastTimestamp(2), dateISO: '2026-10-03', tiempo: '03/10/2026 09:15 AM', lastModified: getPastTimestamp(2), 
    enTablero: true, historial: []
  }
];

let logs = [];
let vistaActualTablero = 'kanban';
let tabActualAuditoria = 'documental';

// --- MOTOR VIRTUAL DRAG & DROP ---
let dragState = { isDragging: false, hasMoved: false, cloneEl: null, sourceEl: null, expId: null, offsetX: 0, offsetY: 0, initMouseX: 0, initMouseY: 0, hoverCol: null };
let dragRAF = null;
let currentMouseX = 0;
let currentMouseY = 0;

function initDrag(e, expId, cardEl) {
  if (e.target.closest('button')) return;
  dragState.isDragging = true;
  dragState.hasMoved = false;
  dragState.expId = expId;
  dragState.sourceEl = cardEl;
  dragState.initMouseX = e.clientX;
  dragState.initMouseY = e.clientY;
  
  let rect = cardEl.getBoundingClientRect();
  dragState.offsetX = e.clientX - rect.left;
  dragState.offsetY = e.clientY - rect.top;
  
  document.addEventListener('mousemove', onDragMove, { passive: false });
  document.addEventListener('mouseup', onDragEnd);
}

function onDragMove(e) {
  if (!dragState.isDragging) return;
  e.preventDefault();
  currentMouseX = e.clientX;
  currentMouseY = e.clientY;

  if (!dragState.hasMoved) {
    if (Math.abs(currentMouseX - dragState.initMouseX) > 5 || Math.abs(currentMouseY - dragState.initMouseY) > 5) {
      dragState.hasMoved = true;
      let rect = dragState.sourceEl.getBoundingClientRect();
      dragState.cloneEl = dragState.sourceEl.cloneNode(true);
      dragState.cloneEl.style.position = 'fixed';
      dragState.cloneEl.style.margin = '0';
      dragState.cloneEl.style.left = '0px';
      dragState.cloneEl.style.top = '0px';
      dragState.cloneEl.style.width = rect.width + 'px';
      dragState.cloneEl.style.zIndex = '9999';
      dragState.cloneEl.style.pointerEvents = 'none';
      dragState.cloneEl.style.opacity = '0.9';
      dragState.cloneEl.style.boxShadow = '0 12px 24px rgba(0,0,0,0.2)';
      dragState.cloneEl.style.transition = 'none'; 
      document.body.appendChild(dragState.cloneEl);
      document.body.classList.add('is-dragging');
      dragState.sourceEl.classList.add('dragging');
    } else { return; }
  }
  if (dragState.hasMoved && !dragRAF) { dragRAF = requestAnimationFrame(updateDragVisuals); }
}

function updateDragVisuals() {
  if (!dragState.isDragging || !dragState.cloneEl) { dragRAF = null; return; }
  let x = currentMouseX - dragState.offsetX;
  let y = currentMouseY - dragState.offsetY;
  dragState.cloneEl.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0) rotate(3deg)';
  let elUnder = document.elementFromPoint(currentMouseX, currentMouseY);
  let col = elUnder ? elUnder.closest('.kanban-col') : null;
  if (dragState.hoverCol !== col) {
    if (dragState.hoverCol) dragState.hoverCol.classList.remove('drag-over');
    if (col) col.classList.add('drag-over');
    dragState.hoverCol = col;
  }
  dragRAF = null; 
}

function onDragEnd(e) {
  if (!dragState.isDragging) return;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  if (dragRAF) { cancelAnimationFrame(dragRAF); dragRAF = null; }
  if (dragState.hasMoved && dragState.cloneEl) {
    dragState.cloneEl.remove();
    dragState.sourceEl.classList.remove('dragging');
    document.body.classList.remove('is-dragging');
    if (dragState.hoverCol) {
      dragState.hoverCol.classList.remove('drag-over');
      let newArea = dragState.hoverCol.getAttribute('data-area');
      let expObj = expedientes.find(x => x.id === dragState.expId);
      if (expObj && expObj.area !== newArea) {
        moverExpediente(dragState.expId, newArea);
      }
    }
  }
  dragState = { isDragging: false, hasMoved: false, cloneEl: null, sourceEl: null, expId: null, offsetX: 0, offsetY: 0, initMouseX: 0, initMouseY: 0, hoverCol: null };
}

function cambiarVista(tipo) {
  vistaActualTablero = tipo;
  document.getElementById('btnKanban').classList.toggle('active', tipo === 'kanban');
  document.getElementById('btnTimeline').classList.toggle('active', tipo === 'timeline');
  document.getElementById('viewKanban').style.display = (tipo === 'kanban') ? 'flex' : 'none';
  document.getElementById('viewTimeline').style.display = (tipo === 'timeline') ? 'flex' : 'none';
  render();
}

function registrarLog(accion, nota) {
  let now = obtenerFechaYHora();
  logs.unshift({ time: now.formatted, user: 'Admin Local', action: accion, note: nota || 'Sin nota.' });
}

let accionPendienteCallback = null;
function abrirActionModal(titulo, subtitulo, camposHTML, onConfirmar) {
  document.getElementById('actionModalTitle').innerText = titulo;
  document.getElementById('actionModalSubtitle').innerText = subtitulo;
  document.getElementById('actionModalFieldsContainer').innerHTML = camposHTML;
  document.getElementById('actionModalOverlay').style.display = 'flex';
  accionPendienteCallback = onConfirmar;
}
function cerrarActionModal() { document.getElementById('actionModalOverlay').style.display = 'none'; accionPendienteCallback = null; }
function ejecutarAccionPopup() { if (accionPendienteCallback) accionPendienteCallback(); cerrarActionModal(); }

function abrirModalAuditoriaGlobal(filtroPrestablecido) { 
  document.getElementById('modalAuditoriaGlobal').style.display = 'flex'; 
  if (filtroPrestablecido) { document.getElementById('auditSearchBox').value = filtroPrestablecido; }
  renderAuditoria(); 
}
function cerrarModalAuditoriaGlobal() { document.getElementById('modalAuditoriaGlobal').style.display = 'none'; }
function simularExportacion(tipo) { mostrarToast('Preparando descarga del reporte en formato ' + tipo + '...'); }
function cambiarTabAuditoria(tab) {
  tabActualAuditoria = tab;
  document.getElementById('tabDocGlobal').classList.toggle('active', tab === 'documental');
  document.getElementById('tabMovGlobal').classList.toggle('active', tab === 'transferencias');
  renderAuditoria();
}

function limpiarFiltrosAuditoria() {
  document.getElementById('auditSearchBox').value = '';
  document.getElementById('auditDateFrom').value = '';
  document.getElementById('auditDateTo').value = '';
  document.querySelectorAll('#modalAuditoriaGlobal .col-filter-input').forEach(input => input.value = '');
  renderAuditoria();
}

function limpiarFiltrosInventario() {
  document.getElementById('modalSearchBox').value = '';
  document.getElementById('modalAreaFilter').value = 'todas';
  document.getElementById('modalDateFrom').value = '';
  document.getElementById('modalDateTo').value = '';
  document.querySelectorAll('#modalInventario .col-filter-input').forEach(input => input.value = '');
  render();
}

function renderAuditoria() {
  let search = document.getElementById('auditSearchBox').value.toLowerCase();
  let dateFrom = document.getElementById('auditDateFrom').value;
  let dateTo = document.getElementById('auditDateTo').value;

  let fFecha = (document.getElementById('f-fecha') ? document.getElementById('f-fecha').value : '').toLowerCase();
  let fUsuario = (document.getElementById('f-usuario') ? document.getElementById('f-usuario').value : '').toLowerCase();
  let fSys = (document.getElementById('f-sys') ? document.getElementById('f-sys').value : '').toLowerCase();
  let fTitulo = (document.getElementById('f-titulo') ? document.getElementById('f-titulo').value : '').toLowerCase();
  let fExp = (document.getElementById('f-exp') ? document.getElementById('f-exp').value : '').toLowerCase();
  let fDetalle = (document.getElementById('f-detalle') ? document.getElementById('f-detalle').value : '').toLowerCase();
  let fNota = (document.getElementById('f-nota') ? document.getElementById('f-nota').value : '').toLowerCase();

  let hayFiltrosActivos = search || dateFrom || dateTo || fFecha || fUsuario || fSys || fTitulo || fExp || fDetalle || fNota;
  document.getElementById('btnLimpiarFiltros').style.display = hayFiltrosActivos ? 'inline-flex' : 'none';

  let head = document.getElementById('audit-table-head');
  let body = document.getElementById('audit-table-body');
  head.innerHTML = ''; body.innerHTML = '';

  let historialGlobal = [];
  expedientes.forEach(exp => {
    exp.historial.forEach(h => {
      historialGlobal.push(Object.assign({}, h, { 
        idSys: exp.idSys, 
        expId: exp.id, 
        tituloReal: h.tituloActual || exp.titulo, 
        expTitular: exp.titular,
        detalleTexto: (h.tipo === 'titulo' || h.tipo === 'observacion' || h.tipo === 'titular') ? (h.previo + ' -> ' + h.actual) : (h.origen + ' -> ' + h.destino)
      }));
    });
  });

  let historialFiltrado = historialGlobal.filter(h => tabActualAuditoria === 'documental' ? (h.tipo === 'titulo' || h.tipo === 'observacion' || h.tipo === 'titular') : h.tipo === 'movimiento');

  historialFiltrado = historialFiltrado.filter(h => {
    let matchGlobal = !search || h.idSys.toLowerCase().includes(search) || h.expId.toLowerCase().includes(search) || h.tituloReal.toLowerCase().includes(search) || (h.nota || '').toLowerCase().includes(search);
    let matchFrom = !dateFrom || h.iso >= dateFrom;
    let matchTo = !dateTo || h.iso <= dateTo;
    let matchFecha = !fFecha || h.fecha.toLowerCase().includes(fFecha);
    let matchUsu = !fUsuario || (h.usuario || 'Admin Local').toLowerCase().includes(fUsuario);
    let matchSys = !fSys || h.idSys.toLowerCase().includes(fSys);
    let matchTit = !fTitulo || h.tituloReal.toLowerCase().includes(fTitulo);
    let matchExpCol = !fExp || h.expId.toLowerCase().includes(fExp);
    let matchDet = !fDetalle || h.detalleTexto.toLowerCase().includes(fDetalle);
    let matchNot = !fNota || (h.nota || '').toLowerCase().includes(fNota);
    return matchGlobal && matchFrom && matchTo && matchFecha && matchUsu && matchSys && matchTit && matchExpCol && matchDet && matchNot;
  });

  historialFiltrado.sort((a, b) => b.ts - a.ts);

  let baseHeaders = '<th>Fecha / Hora<br><input type="text" class="col-filter-input" id="f-fecha" placeholder="Filtrar..." value="' + fFecha + '" oninput="renderAuditoria()"></th>' +
    '<th>Usuario<br><input type="text" class="col-filter-input" id="f-usuario" placeholder="Filtrar..." value="' + fUsuario + '" oninput="renderAuditoria()"></th>' +
    '<th>ID Sistema<br><input type="text" class="col-filter-input" id="f-sys" placeholder="Filtrar..." value="' + fSys + '" oninput="renderAuditoria()"></th>' +
    '<th>Titulo (Clave Principal)<br><input type="text" class="col-filter-input" id="f-titulo" placeholder="Filtrar..." value="' + fTitulo + '" oninput="renderAuditoria()"></th>' +
    '<th>No. Expediente<br><input type="text" class="col-filter-input" id="f-exp" placeholder="Filtrar..." value="' + fExp + '" oninput="renderAuditoria()"></th>';

  if (tabActualAuditoria === 'documental') {
    head.innerHTML = '<tr>' + baseHeaders +
      '<th>Detalle Documental / Obs.<br><input type="text" class="col-filter-input" id="f-detalle" placeholder="Filtrar..." value="' + fDetalle + '" oninput="renderAuditoria()"></th>' +
      '<th>Justificacion<br><input type="text" class="col-filter-input" id="f-nota" placeholder="Filtrar..." value="' + fNota + '" oninput="renderAuditoria()"></th></tr>';
  } else {
    head.innerHTML = '<tr>' + baseHeaders +
      '<th>Origen -> Destino<br><input type="text" class="col-filter-input" id="f-detalle" placeholder="Filtrar..." value="' + fDetalle + '" oninput="renderAuditoria()"></th>' +
      '<th>Justificacion<br><input type="text" class="col-filter-input" id="f-nota" placeholder="Filtrar..." value="' + fNota + '" oninput="renderAuditoria()"></th></tr>';
  }

  if (historialFiltrado.length === 0) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px;">No se encontraron registros.</td></tr>';
  } else {
    historialFiltrado.forEach(h => {
      let detalleHtml;
      if (h.tipo === 'titulo' || h.tipo === 'observacion' || h.tipo === 'titular') {
        let etiquetaPrefijo = '[Doc]';
        if (h.tipo === 'observacion') etiquetaPrefijo = '<strong style="color:#e65100;">[Obs]</strong>';
        if (h.tipo === 'titular') etiquetaPrefijo = '<strong style="color:var(--md-sys-color-primary);">[Titular]</strong>';
        detalleHtml = etiquetaPrefijo + ' <span style="text-decoration:line-through; opacity:0.6;">' + h.previo + '</span> -> <strong>' + h.actual + '</strong>';
      } else {
        let badgeO = 'badge badge-' + h.origen.replace(/ /g, '');
        let badgeD = 'badge badge-' + h.destino.replace(/ /g, '');
        detalleHtml = '<span class="' + badgeO + '" style="font-size:11px; padding:2px 8px;">' + h.origen + '</span> <span style="color:var(--md-sys-color-outline); margin: 0 4px;">➔</span> <span class="' + badgeD + '" style="font-size:11px; padding:2px 8px;">' + h.destino + '</span>';
      }
        
      body.innerHTML += '<tr><td>' + h.fecha + '</td><td><span style="font-weight:500; font-size:12px; padding:3px 8px; border-radius:6px; background:var(--md-sys-color-surface-container); color:var(--md-sys-color-on-surface);">' + (h.usuario || 'Admin Local') + '</span></td><td><span class="sys-id-tag">' + h.idSys + '</span></td><td style="font-weight:700; color:var(--md-sys-color-primary);">' + h.tituloReal + '</td><td style="font-weight:500;">' + h.expId + '</td><td>' + detalleHtml + '</td><td style="color:var(--md-sys-color-on-surface-variant);">' + h.nota + '</td></tr>';
    });
  }
}

function abrirModalCrearExpediente() {
  let nextId = 'EXP-CNA-' + String(expedientes.length + 1).padStart(3, '0');
  let newSysId = generarIdSistema();
  let diaHoy = obtenerFechaYHora().iso;
  
  let campos = '<div class="action-modal-form-group"><label>Fecha del Registro/Reporte:</label><input type="date" class="search-box" id="popupFechaAccion" value="' + diaHoy + '"></div>' +
    '<div class="action-modal-form-group"><label>ID Sistema:</label><input type="text" class="search-box" value="' + newSysId + '" disabled style="background:var(--md-sys-color-surface-container); font-family: monospace;"></div>' +
    '<div class="action-modal-form-group"><label>No. Expediente:</label><input type="text" class="search-box" id="popupNewId" value="' + nextId + '"></div>' +
    '<div class="action-modal-form-group"><label>Titulo (Principal):</label><input type="text" class="search-box" id="popupNewTitulo" placeholder="Ej. TIT-2026-A01" style="font-weight:bold;"></div>' +
    '<div class="action-modal-form-group"><label>Titular:</label><input type="text" class="search-box" id="popupNewTitular"></div>' +
    '<div class="action-modal-form-group"><label>Observaciones libres (Buscable):</label><input type="text" class="search-box" id="popupNewObs" placeholder="Etiquetas, notas rapidas, etc."></div>';
    
  abrirActionModal('Registrar Expediente', 'Apertura inicial en Archivo Fisico.', campos, () => {
    let fSeleccionada = document.getElementById('popupFechaAccion').value;
    let noExp = document.getElementById('popupNewId').value.trim() || nextId; 
    let titulo = document.getElementById('popupNewTitulo').value.trim() || 'TIT-PENDIENTE'; 
    let titular = document.getElementById('popupNewTitular').value.trim() || 'Sin Titular';
    let obs = document.getElementById('popupNewObs').value.trim();
    let ts = obtenerFechaYHora(fSeleccionada);
    
    expedientes.push({ 
      idSys: newSysId, id: noExp, titulo: titulo, titular: titular, area: 'ARCHIVO', observacion: obs, fechaRegistro: ts.dateOnly, tsRegistro: ts.timestamp, tiempo: '---', dateISO: '', lastModified: ts.timestamp, enTablero: false, 
      historial: [{ ts: ts.timestamp, tipo: 'movimiento', usuario: 'Admin Local', tituloActual: titulo, origen: 'Nuevo', destino: 'ARCHIVO', fecha: ts.formatted, nota: 'Registro inicial', iso: ts.iso }]
    });
    registrarLog('Alta (' + newSysId + ')', 'Titulo: ' + titulo); mostrarToast('Expediente registrado en Archivo.'); render();
  });
}

function moverExpediente(id, areaDestinoForzada) {
  let exp = expedientes.find(e => e.id === id); if(!exp) return;
  let diaHoy = obtenerFechaYHora().iso;
  let areasOpciones = ['CIS', 'DICTAMINACION', 'SUBDIRECTOR', 'INFRACCIONES', 'INSPECCION', 'TECNICA', 'JURIDICO', 'DIRECCION', 'ARCHIVO'];
  
  let selectHtml = '<select id="popupSelectDestino" class="control-modern" style="width:100%; height:40px;">';
  areasOpciones.forEach(a => {
    let selected = (areaDestinoForzada && areaDestinoForzada === a) || (!areaDestinoForzada && exp.area === a) ? 'selected' : '';
    selectHtml += '<option value="' + a + '" ' + selected + '>' + (a === 'ARCHIVO' ? 'Archivo General (Retirar)' : a) + '</option>';
  });
  selectHtml += '</select>';

  let campos = '<div class="action-modal-form-group"><label>Fecha del Movimiento:</label><input type="date" class="search-box" id="popupFechaAccion" value="' + diaHoy + '"></div>' +
    '<div class="action-modal-form-group"><label>Area Destino:</label>' + selectHtml + '</div>' +
    '<div class="action-modal-form-group"><label>Observacion opcional:</label><input type="text" class="search-box" id="popupInputObs" value="' + (exp.observacion || '') + '" placeholder="Actualizar etiqueta u observaciones..."></div>' +
    '<div class="action-modal-form-group"><label>Nota (Justificacion del pase):</label><input type="text" class="search-box" id="popupInputNota" value="Transferencia por tablero"></div>';
    
  abrirActionModal('Mover Expediente', 'Reasigna de area operativa.', campos, () => {
    let fSeleccionada = document.getElementById('popupFechaAccion').value;
    let destino = document.getElementById('popupSelectDestino').value; 
    let nObs = document.getElementById('popupInputObs').value.trim();
    let nota = document.getElementById('popupInputNota').value || 'Sin justificacion';
    let ts = obtenerFechaYHora(fSeleccionada); let areaAnterior = exp.area;
    
    exp.historial.unshift({ ts: ts.timestamp, tipo: 'movimiento', usuario: 'Admin Local', tituloActual: exp.titulo, origen: areaAnterior, destino: destino, fecha: ts.formatted, nota: nota, iso: ts.iso });
    
    if (exp.observacion !== nObs) {
      exp.historial.unshift({ ts: ts.timestamp + 1, tipo: 'observacion', usuario: 'Admin Local', tituloActual: exp.titulo, previo: exp.observacion || 'Ninguna', actual: nObs || 'Ninguna', fecha: ts.formatted, nota: 'Actualizacion por tablero', iso: ts.iso });
      exp.observacion = nObs;
    }

    exp.area = destino; exp.enTablero = (destino !== 'ARCHIVO'); exp.tiempo = exp.enTablero ? ts.formatted : '---'; exp.dateISO = exp.enTablero ? ts.iso : ''; exp.lastModified = ts.timestamp;
    registrarLog('Transferencia (' + exp.idSys + ')', nota); mostrarToast('Transferido a ' + destino + '.'); render();
  });
}

function modificarExpediente(id) {
  let exp = expedientes.find(e => e.id === id); if(!exp) return;
  let diaHoy = obtenerFechaYHora().iso;
  
  let campos = '<div class="action-modal-form-group"><label>Fecha de la Actualizacion:</label><input type="date" class="search-box" id="popupFechaAccion" value="' + diaHoy + '"></div>' +
    '<div class="action-modal-form-group"><label>ID Sistema:</label><input type="text" class="search-box" value="' + exp.idSys + '" disabled style="background:var(--md-sys-color-surface-container); font-family: monospace;"></div>' +
    '<div class="action-modal-form-group"><label>No. Expediente:</label><input type="text" class="search-box" id="popupInputNoExp" value="' + exp.id + '"></div>' +
    '<div class="action-modal-form-group"><label>Titulo (Principal):</label><input type="text" class="search-box" id="popupInputTitulo" value="' + exp.titulo + '" style="font-weight:bold;"></div>' +
    '<div class="action-modal-form-group"><label>Titular:</label><input type="text" class="search-box" id="popupInputTitular" value="' + exp.titular + '"></div>' +
    '<div class="action-modal-form-group"><label>Observaciones (Modificable libremente):</label><input type="text" class="search-box" id="popupInputObs" value="' + exp.observacion + '" placeholder="Etiquetas, notas internas..."></div>' +
    '<div class="action-modal-form-group"><label>Justificacion para Bitacora:</label><input type="text" class="search-box" id="popupInputNota" placeholder="Ej. Correccion manual de datos"></div>';
  
  abrirActionModal('Modificar Informacion', 'Actualiza datos fisicos u observaciones libres.', campos, () => {
    let fSeleccionada = document.getElementById('popupFechaAccion').value;
    let nNoExp = document.getElementById('popupInputNoExp').value.trim(); 
    let nTit = document.getElementById('popupInputTitulo').value.trim();
    let nTitular = document.getElementById('popupInputTitular').value.trim(); 
    let nObs = document.getElementById('popupInputObs').value.trim();
    let nota = document.getElementById('popupInputNota').value.trim() || 'Actualizacion manual';
    let ts = obtenerFechaYHora(fSeleccionada);
    
    if(nTit !== exp.titulo) { 
      exp.historial.unshift({ ts: ts.timestamp, tipo: 'titulo', usuario: 'Admin Local', tituloActual: nTit, previo: exp.titulo, actual: nTit, fecha: ts.formatted, nota: 'TITULO: ' + nota, iso: ts.iso }); 
      exp.titulo = nTit; 
    }
    if(nNoExp !== exp.id) { 
      exp.historial.unshift({ ts: ts.timestamp, tipo: 'titulo', usuario: 'Admin Local', tituloActual: exp.titulo, previo: 'Exp: ' + exp.id, actual: 'Exp: ' + nNoExp, fecha: ts.formatted, nota: 'NO. EXP: ' + nota, iso: ts.iso }); 
      exp.id = nNoExp; 
    }
    if(nTitular !== exp.titular) {
      exp.historial.unshift({ ts: ts.timestamp, tipo: 'titular', usuario: 'Admin Local', tituloActual: exp.titulo, previo: exp.titular || 'Sin Titular', actual: nTitular, fecha: ts.formatted, nota: 'TITULAR: ' + nota, iso: ts.iso });
      exp.titular = nTitular;
    }
    if (exp.observacion !== nObs) { 
      exp.historial.unshift({ ts: ts.timestamp, tipo: 'observacion', usuario: 'Admin Local', tituloActual: exp.titulo, previo: exp.observacion || 'Ninguna', actual: nObs || 'Ninguna', fecha: ts.formatted, nota: 'OBS: ' + nota, iso: ts.iso }); 
      exp.observacion = nObs; 
      registrarLog('Observacion editada', 'Para: ' + exp.idSys); 
    }
    exp.lastModified = ts.timestamp;
    mostrarToast('Cambios guardados.'); render();
  });
}

function abrirDetalles(id) {
  let exp = expedientes.find(e => e.id === id); if(!exp) return;
  document.getElementById('detallesTituloActual').innerText = exp.titulo; 
  document.getElementById('detallesIdSysActual').innerText = 'ID Sistema: ' + exp.idSys;
  document.getElementById('detallesFechaRegistro').innerText = exp.fechaRegistro; 
  document.getElementById('detallesSubtitle').innerText = 'No. Exp: ' + exp.id + ' | Titular: ' + exp.titular;
  
  let btnAuditoriaLink = document.getElementById('btnVerEnAuditoriaGlobal');
  btnAuditoriaLink.onclick = () => { cerrarDetallesModal(); abrirModalAuditoriaGlobal(exp.idSys); };

  let cTit = document.getElementById('detallesMiniBitacoraTitulos'); let cMov = document.getElementById('detallesMiniBitacoraMovimientos');
  cTit.innerHTML = ''; cMov.innerHTML = '';
  
  let histTitulos = exp.historial.filter(h => h.tipo === 'titulo' || h.tipo === 'observacion' || h.tipo === 'titular'); 
  let histMovs = exp.historial.filter(h => h.tipo === 'movimiento');
  
  if(histTitulos.length === 0) { 
    cTit.innerHTML = '<span style="color:var(--md-sys-color-on-surface-variant); font-size:12px;">Sin modificaciones documentales.</span>'; 
  } else { 
    histTitulos.forEach(h => { 
      let lblIcon = '[Doc]';
      if (h.tipo === 'observacion') lblIcon = '[Obs]';
      if (h.tipo === 'titular') lblIcon = '[Titular]';
      cTit.innerHTML += '<div class="mini-bitacora-item type-' + h.tipo + '"><span class="mb-fecha">' + h.fecha + ' (' + (h.usuario || 'Admin') + ')</span><div class="mb-titulo">' + lblIcon + ' <span style="text-decoration:line-through; opacity:0.6; font-weight:400;">' + h.previo + '</span> <br> -> ' + h.actual + '</div><div class="mb-nota">Justificacion: ' + h.nota + '</div></div>'; 
    }); 
  }
  
  if(histMovs.length === 0) { 
    cMov.innerHTML = '<span style="color:var(--md-sys-color-on-surface-variant); font-size:12px;">Sin transferencias registradas.</span>'; 
  } else { 
    histMovs.forEach(h => { 
      let badgeO = 'badge badge-' + h.origen.replace(/ /g, '');
      let badgeD = 'badge badge-' + h.destino.replace(/ /g, '');
      cMov.innerHTML += '<div class="mini-bitacora-item type-movimiento"><span class="mb-fecha">' + h.fecha + ' (' + (h.usuario || 'Admin') + ')</span><div class="mb-titulo" style="display:flex; align-items:center; gap:6px;"><span class="' + badgeO + '" style="font-size:10px; padding:2px 6px;">' + h.origen + '</span> <span style="color:var(--md-sys-color-outline);">➔</span> <span class="' + badgeD + '" style="font-size:10px; padding:2px 6px;">' + h.destino + '</span></div><div class="mb-nota">Justificacion: ' + h.nota + '</div></div>'; 
    }); 
  }
  document.getElementById('detallesModalOverlay').style.display = 'flex';
}

function cerrarDetallesModal() { document.getElementById('detallesModalOverlay').style.display = 'none'; }
function abrirModalInventario() { document.getElementById('modalInventario').style.display = 'flex'; render(); }
function cerrarModalInventario() { document.getElementById('modalInventario').style.display = 'none'; }
function getBadgeClass(area) { return 'badge badge-' + area.replace(/ /g, ''); }
function getCardColorClass(area) { 
  const map = { 'CIS':'bg-cis', 'DICTAMINACION':'bg-dic', 'SUBDIRECTOR':'bg-saa', 'INFRACCIONES':'bg-inf', 'INSPECCION':'bg-ins', 'TECNICA':'bg-tec', 'JURIDICO':'bg-jur', 'DIRECCION':'bg-dir'};
  return map[area] || ''; 
}

function render() {
  let queryInv = document.getElementById('searchBox').value.toLowerCase(); 
  let sidebarAreaFilter = document.getElementById('sidebarAreaFilter').value;
  let queryModal = document.getElementById('modalSearchBox').value.toLowerCase(); 
  let modalAreaFilter = document.getElementById('modalAreaFilter').value;
  let modalDateFrom = document.getElementById('modalDateFrom').value; 
  let modalDateTo = document.getElementById('modalDateTo').value; 
  let modalSortOrder = document.getElementById('modalSortOrder').value;
  
  let fInvSys = (document.getElementById('inv-f-sys') ? document.getElementById('inv-f-sys').value : '').toLowerCase();
  let fInvTitulo = (document.getElementById('inv-f-titulo') ? document.getElementById('inv-f-titulo').value : '').toLowerCase();
  let fInvExp = (document.getElementById('inv-f-exp') ? document.getElementById('inv-f-exp').value : '').toLowerCase();
  let fInvTitular = (document.getElementById('inv-f-titular') ? document.getElementById('inv-f-titular').value : '').toLowerCase();
  let fInvObs = (document.getElementById('inv-f-obs') ? document.getElementById('inv-f-obs').value : '').toLowerCase();
  let fInvArea = (document.getElementById('inv-f-area') ? document.getElementById('inv-f-area').value : '').toLowerCase();
  let fInvFecha = (document.getElementById('inv-f-fecha') ? document.getElementById('inv-f-fecha').value : '').toLowerCase();

  let hayFiltrosInv = queryModal || modalAreaFilter !== 'todas' || modalDateFrom || modalDateTo || fInvSys || fInvTitulo || fInvExp || fInvTitular || fInvArea || fInvFecha || fInvObs;
  document.getElementById('btnLimpiarFiltrosInv').style.display = hayFiltrosInv ? 'inline-flex' : 'none';

  let queryBoard = document.getElementById('boardSearchBox').value.toLowerCase(); 
  let boardAreaFilter = document.getElementById('boardAreaFilter').value; 
  let boardDateFilter = document.getElementById('boardDateFilter').value;

  const invList = document.getElementById('inventory-list'); invList.innerHTML = '';
  let expInvFiltrados = expedientes.filter(exp => 
    (exp.titulo.toLowerCase().includes(queryInv) || exp.id.toLowerCase().includes(queryInv) || exp.idSys.toLowerCase().includes(queryInv) || exp.observacion.toLowerCase().includes(queryInv)) 
    && (sidebarAreaFilter === 'todas' || exp.area === sidebarAreaFilter)
  );
  document.getElementById('sidebarTitle').innerText = 'Archivo Fisico (' + expInvFiltrados.length + ')';
  expInvFiltrados.forEach(exp => {
    const invItem = document.createElement('div'); invItem.className = 'expediente-item';
    let obsHtml = exp.observacion ? '<div class="inv-obs">' + exp.observacion + '</div>' : '';
    invItem.innerHTML = '<div class="inv-header"><span style="font-size:16px;">' + exp.titulo + '</span><div style="display:flex; justify-content:space-between; width:100%; align-items:center; margin-top:4px;"><span class="sys-id-tag">ID: ' + exp.idSys + '</span><span class="' + getBadgeClass(exp.area) + '">' + exp.area + '</span></div></div><div class="inv-body"><strong>Exp:</strong> ' + exp.id + '<br><strong>Titular:</strong> ' + exp.titular + '</div>' + obsHtml + '<div class="inv-actions"><button class="btn-card-outline" onclick="abrirDetalles(\\'' + exp.id + '\\')">Historial</button><button class="btn-card-tonal" onclick="modificarExpediente(\\'' + exp.id + '\\')">Editar</button><button class="btn-card-filled" onclick="moverExpediente(\\'' + exp.id + '\\')">Mover</button></div>';
    invList.appendChild(invItem);
  });

  const modalTableBody = document.getElementById('modal-table-body'); modalTableBody.innerHTML = '';
  let modalFiltrados = expedientes.filter(exp => {
    let matchesText = exp.titulo.toLowerCase().includes(queryModal) || exp.id.toLowerCase().includes(queryModal) || exp.idSys.toLowerCase().includes(queryModal) || exp.titular.toLowerCase().includes(queryModal) || exp.observacion.toLowerCase().includes(queryModal);
    let matchesArea = modalAreaFilter === 'todas' || exp.area === modalAreaFilter;
    let expDateISO = exp.fechaRegistro.split('/').reverse().join('-');
    let matchesFrom = !modalDateFrom || expDateISO >= modalDateFrom;
    let matchesTo = !modalDateTo || expDateISO <= modalDateTo;
    let mSys = !fInvSys || exp.idSys.toLowerCase().includes(fInvSys);
    let mTit = !fInvTitulo || exp.titulo.toLowerCase().includes(fInvTitulo);
    let mExp = !fInvExp || exp.id.toLowerCase().includes(fInvExp);
    let mTitular = !fInvTitular || exp.titular.toLowerCase().includes(fInvTitular);
    let mObs = !fInvObs || exp.observacion.toLowerCase().includes(fInvObs);
    let mAreaCol = !fInvArea || exp.area.toLowerCase().includes(fInvArea);
    let mFecha = !fInvFecha || exp.fechaRegistro.toLowerCase().includes(fInvFecha);
    return matchesText && matchesArea && matchesFrom && matchesTo && mSys && mTit && mExp && mTitular && mObs && mAreaCol && mFecha;
  });

  modalFiltrados.sort((a, b) => modalSortOrder === 'desc' ? b.tsRegistro - a.tsRegistro : a.tsRegistro - b.tsRegistro);
  
  if (modalFiltrados.length === 0) { 
    modalTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px; color:var(--md-sys-color-on-surface-variant);">Sin coincidencias con los filtros aplicados.</td></tr>'; 
  } else { 
    modalFiltrados.forEach(exp => { 
      modalTableBody.innerHTML += '<tr><td><span class="sys-id-tag">' + exp.idSys + '</span></td><td style="font-weight:700; color:var(--md-sys-color-primary);">' + exp.titulo + '</td><td style="font-weight:500;">' + exp.id + '</td><td>' + exp.titular + '</td><td style="color:var(--md-sys-color-on-surface-variant); font-style:italic;">' + exp.observacion + '</td><td><span class="' + getBadgeClass(exp.area) + '">' + exp.area + '</span></td><td>' + exp.fechaRegistro + '</td><td><div class="compact-actions"><button class="btn-card-outline" onclick="abrirDetalles(\\'' + exp.id + '\\')">Bitacora</button><button class="btn-card-tonal" onclick="modificarExpediente(\\'' + exp.id + '\\')">Modificar</button><button class="btn-card-filled" onclick="moverExpediente(\\'' + exp.id + '\\')">Mover</button></div></td></tr>'; 
    }); 
  }

  const logsContainer = document.getElementById('logs-list'); logsContainer.innerHTML = ''; 
  logs.slice(0, 5).forEach(l => { logsContainer.innerHTML += '<div class="log-entry"><span class="log-time">' + l.time + '</span><span class="log-action">' + l.action + '</span><span class="log-note">' + l.note + '</span></div>'; });

  let expTablero = expedientes.filter(exp => exp.enTablero && (exp.titulo.toLowerCase().includes(queryBoard) || exp.id.toLowerCase().includes(queryBoard) || exp.idSys.toLowerCase().includes(queryBoard) || exp.observacion.toLowerCase().includes(queryBoard)) && (!boardDateFilter || exp.dateISO === boardDateFilter) && (boardAreaFilter === 'todas' || exp.area === boardAreaFilter)).sort((a, b) => b.lastModified - a.lastModified);
  document.getElementById('boardHeaderTitle').innerText = 'Tablero de Circulacion Activa (' + expTablero.length + ')';

  if (vistaActualTablero === 'kanban') {
    const kanbanCont = document.getElementById('kanbanColumnsContainer'); kanbanCont.innerHTML = '';
    
    let columnAreas = [
      { code: 'CIS', title: 'CIS', cls: 'col-cis' },
      { code: 'DICTAMINACION', title: 'Dictaminacion', cls: 'col-dic' },
      { code: 'SUBDIRECTOR', title: 'Subdireccion S.A.A.', cls: 'col-saa' },
      { code: 'INFRACCIONES', title: 'Infracciones', cls: 'col-inf' },
      { code: 'INSPECCION', title: 'Inspeccion', cls: 'col-ins' },
      { code: 'TECNICA', title: 'Tecnica', cls: 'col-tec' },
      { code: 'JURIDICO', title: 'Juridico', cls: 'col-jur' },
      { code: 'DIRECCION', title: 'Direccion', cls: 'col-dir' }
    ];

    columnAreas.forEach(c => {
      if (boardAreaFilter !== 'todas' && boardAreaFilter !== c.code) return;
      let cnt = expTablero.filter(e => e.area === c.code).length;
      if (queryBoard.trim() !== '' && cnt === 0) return;

      let colDiv = document.createElement('div');
      colDiv.className = 'kanban-col ' + c.cls;
      colDiv.setAttribute('data-area', c.code);
      colDiv.innerHTML = '<h3><span>' + c.title + '</span> <span style="font-size:12px;background:var(--card-bg);padding:2px 8px;border-radius:10px;">' + cnt + '</span></h3><div class="col-content" id="col-' + c.code.toLowerCase() + '"></div>';
      kanbanCont.appendChild(colDiv);
    });

    expTablero.forEach(exp => {
      let el = document.getElementById('col-' + exp.area.toLowerCase());
      let obsHtml = exp.observacion ? '<div class="k-obs" title="' + exp.observacion + '">[Obs] ' + exp.observacion + '</div>' : '';
      if(el) {
        let card = document.createElement('div');
        card.className = 'k-card ' + getCardColorClass(exp.area);
        card.title = 'Doble clic para ver detalles y editar / Arrastrar para mover';
        card.innerHTML = '<span class="k-titulo-main">' + exp.titulo + '</span><div class="k-meta-row"><span class="sys-id-tag" style="width:fit-content;">' + exp.idSys + '</span><span class="k-id">Exp: ' + exp.id + '</span></div><div class="k-info"><strong>Titular:</strong> ' + exp.titular + '</div>' + obsHtml + '<div class="k-time">Ingreso: ' + exp.tiempo + '</div><div class="k-footer"><button class="btn-card-outline" onclick="abrirDetalles(\\'' + exp.id + '\\')">Detalles</button><button class="btn-card-tonal" onclick="modificarExpediente(\\'' + exp.id + '\\')">Editar</button><button class="btn-card-filled" onclick="moverExpediente(\\'' + exp.id + '\\')">Mover</button></div>';
        
        card.addEventListener('mousedown', (e) => initDrag(e, exp.id, card));
        card.addEventListener('dblclick', () => abrirDetalles(exp.id));
        el.appendChild(card);
      }
    });
  } else {
    const tCont = document.getElementById('timelineListContainer'); tCont.innerHTML = '';
    if (expTablero.length === 0) { tCont.innerHTML = '<div style="text-align:center; padding:40px;">No se encontraron expedientes en tablero.</div>'; } 
    else { expTablero.forEach(exp => {
        let pts = exp.tiempo.split(' ');
        let obsHtml = exp.observacion ? '<div style="font-size:13px; margin-top:8px; font-style:italic; opacity:0.8;">[Obs] ' + exp.observacion + '</div>' : '';
        tCont.innerHTML += '<div class="timeline-item"><div class="timeline-badge-col"><div class="timeline-date-box">' + (pts[0]||'') + '<br>' + (pts[1]||'') + ' ' + (pts[2]||'') + '</div><span class="' + getBadgeClass(exp.area) + '" style="margin-top:12px;">' + exp.area + '</span></div><div class="timeline-content-card ' + getCardColorClass(exp.area) + '"><div><span class="k-titulo-main" style="margin:0; font-size:20px;">' + exp.titulo + '</span><div style="display:flex; gap:8px; align-items:center; margin-top:8px;"><span class="sys-id-tag">SYS: ' + exp.idSys + '</span><span style="font-size:13px; font-weight:500; opacity:0.8;">Exp: ' + exp.id + '</span></div></div><div class="k-info" style="font-size:15px; margin-top:16px;"><strong>Titular:</strong> ' + exp.titular + '</div>' + obsHtml + '<div class="timeline-actions-row" style="display:flex; gap:8px; margin-top:20px; border-top:1px solid rgba(0,0,0,0.1); padding-top:16px;"><button class="btn-card-outline" onclick="abrirDetalles(\\'' + exp.id + '\\')">Ver Historial</button><button class="btn-card-tonal" onclick="modificarExpediente(\\'' + exp.id + '\\')">Editar Datos</button><button class="btn-card-filled" onclick="moverExpediente(\\'' + exp.id + '\\')">Mover de Area</button></div></div></div>';
    }); }
  }
}

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
  render();
});
`
};

// Crear directorios si faltan
dirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log('[+] Carpeta creada: ' + dir);
  }
});

// Escribir los archivos completos
Object.keys(files).forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  fs.writeFileSync(fullPath, files[filePath], 'utf8');
  console.log('[+] Archivo sincronizado: ' + filePath);
});

console.log('\\n=========================================');
console.log('✅ PRODUCCIÓN DE PRUEBA LISTA PARA EJECUCIÓN');
console.log('=========================================\\n');