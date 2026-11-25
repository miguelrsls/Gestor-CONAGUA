// ==========================================================================
// CONAGUA - GESTOR LOCAL DE EXPEDIENTES
// Persistencia Local, Tablero, Filtros Inteligentes y Guardado Nativo Tauri
// ==========================================================================

const STORAGE_KEY = 'CONAGUA_EXPEDIENTES_DATA_V1';
const SNAPSHOTS_KEY = 'CONAGUA_AUTO_SNAPSHOTS_V1';
const BACKUP_DIR_KEY = 'CONAGUA_BACKUP_DIR_V1';
const MAX_SNAPSHOTS = 3;

const AREAS_CATALOGO = [
  { val: '', label: 'Todas' },
  { val: 'CIS', label: 'CIS' },
  { val: 'ATENCION', label: 'Atención a Usuarios' },
  { val: 'DICTAMINACION', label: 'Dictaminación' },
  { val: 'SUBDIRECTOR', label: 'Subdirector' },
  { val: 'INFRACCIONES', label: 'Infracciones' },
  { val: 'INSPECCION', label: 'Inspección' },
  { val: 'TECNICA', label: 'Técnica' },
  { val: 'JURIDICO', label: 'Jurídico' },
  { val: 'DIRECCION', label: 'Dirección' },
  { val: 'ARCHIVO', label: 'Archivo' }
];

// --- GESTOR DE ALMACENAMIENTO PERSISTENTE (OFFLINE-FIRST) ---
const StorageManager = {
  datosSemilla: [],

  cargar() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Aviso al leer almacenamiento local:', e);
    }
    this.guardar(this.datosSemilla, false);
    return this.datosSemilla;
  },

  guardar(listaExpedientes, dispararAutoBackup = true) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(listaExpedientes));
      if (dispararAutoBackup) {
        programarAutoRespaldoDisco('Respaldo automático tras cambio en datos');
      }
    } catch (e) {
      console.error('Error al persistir expedientes en disco:', e);
    }
  }
};

// --- ESTADO GLOBAL ---
let expedientes = StorageManager.cargar();
let logs = [];
let vistaActualTablero = 'kanban';
let tabActualAuditoria = 'documental';
let ultimaTabRenderizada = null;
let isCompactView = false;
let timerDebounceBackup = null;

// --- UTILIDADES ---
function mostrarToast(mensaje) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.innerText = mensaje;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { if (toast.parentNode) container.removeChild(toast); }, 300);
  }, 3500);
}

async function confirmarAccionUsuario(mensaje, titulo = 'Confirmar acción') {
  const tauriDialog = window.__TAURI__ && window.__TAURI__.dialog;
  try {
    if (tauriDialog && typeof tauriDialog.ask === 'function') {
      const respuesta = await tauriDialog.ask(mensaje, {
        title: titulo,
        kind: 'warning',
        okLabel: 'Sí, restaurar',
        cancelLabel: 'No, cancelar'
      });
      return respuesta === true;
    }
    if (tauriDialog && typeof tauriDialog.confirm === 'function') {
      const respuesta = await tauriDialog.confirm(mensaje, {
        title: titulo,
        kind: 'warning'
      });
      return respuesta === true;
    }
  } catch (err) {
    console.warn('Aviso en diálogo nativo, usando confirmación estándar:', err);
  }
  return window.confirm(mensaje) === true;
}

function generarIdSistema() {
  return 'SYS-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

function getPastTimestamp(daysAgo) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).getTime();
}

function obtenerFechaYHora(fechaIngresadaISO) {
  let d = new Date();
  let anio, mes, dia;
  if (fechaIngresadaISO) {
    let p = fechaIngresadaISO.split('-');
    anio = p[0];
    mes = p[1];
    dia = p[2];
    d.setFullYear(anio, mes - 1, dia);
  } else {
    anio = d.getFullYear();
    mes = String(d.getMonth() + 1).padStart(2, '0');
    dia = String(d.getDate()).padStart(2, '0');
  }
  let horas = d.getHours();
  let minutos = String(d.getMinutes()).padStart(2, '0');
  let ampm = horas >= 12 ? 'PM' : 'AM';
  horas = horas % 12 || 12;
  let horasStr = String(horas).padStart(2, '0');

  return {
    formatted: `${dia}/${mes}/${anio} ${horasStr}:${minutos} ${ampm}`,
    iso: `${anio}-${mes}-${dia}`,
    dateOnly: `${dia}/${mes}/${anio}`,
    timestamp: d.getTime()
  };
}

function registrarLog(accion, nota) {
  let now = obtenerFechaYHora();
  logs.unshift({
    time: now.formatted,
    user: 'Admin Local',
    action: accion,
    note: nota || 'Sin nota.'
  });
}

function toggleCompactMode() {
  isCompactView = !isCompactView;
  const btn = document.getElementById('btnCompactToggle');
  if (btn) {
    btn.classList.toggle('active', isCompactView);
    btn.innerHTML = isCompactView ? 'Vista: Standard' : 'Vista: Ultra Compacta';
  }
  const viewKanban = document.getElementById('viewKanban');
  const viewTimeline = document.getElementById('viewTimeline');
  if (viewKanban) viewKanban.classList.toggle('is-compact', isCompactView);
  if (viewTimeline) viewTimeline.classList.toggle('is-compact', isCompactView);
}

function cambiarVista(tipo) {
  vistaActualTablero = tipo;
  const btnKanban = document.getElementById('btnKanban');
  const btnTimeline = document.getElementById('btnTimeline');
  const viewKanban = document.getElementById('viewKanban');
  const viewTimeline = document.getElementById('viewTimeline');

  if (btnKanban) btnKanban.classList.toggle('active', tipo === 'kanban');
  if (btnTimeline) btnTimeline.classList.toggle('active', tipo === 'timeline');
  if (viewKanban) viewKanban.style.display = (tipo === 'kanban') ? 'flex' : 'none';
  if (viewTimeline) viewTimeline.style.display = (tipo === 'timeline') ? 'flex' : 'none';
  render();
}

function getBadgeClass(area) {
  return 'badge badge-' + (area || '').replace(/ /g, '');
}

function getCardColorClass(area) {
  const map = {
    'CIS': 'bg-cis',
    'ATENCION': 'bg-ate',
    'DICTAMINACION': 'bg-dic',
    'SUBDIRECTOR': 'bg-saa',
    'INFRACCIONES': 'bg-inf',
    'INSPECCION': 'bg-ins',
    'TECNICA': 'bg-tec',
    'JURIDICO': 'bg-jur',
    'DIRECCION': 'bg-dir',
    'ARCHIVO': 'bg-arc'
  };
  return map[area] || '';
}

// ==========================================================================
// SISTEMA DE FILTROS DINÁMICOS Y LISTAS DESPLEGABLES
// ==========================================================================
function escaparAttr(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function construirOpcionesDatalist(valoresUnicos) {
  return valoresUnicos
    .filter(v => v && String(v).trim() !== '' && v !== '---')
    .map(v => `<option value="${escaparAttr(v)}"></option>`)
    .join('');
}

function inicializarControlesFiltro() {
  if (!document.getElementById('filterEnhancementStyles')) {
    const style = document.createElement('style');
    style.id = 'filterEnhancementStyles';
    style.textContent = `
      .col-filter-input {
        height: 28px;
        box-sizing: border-box;
        font-family: inherit;
        color: var(--md-sys-color-on-surface);
      }
      select.col-filter-input {
        cursor: pointer;
        padding: 2px 6px;
      }
    `;
    document.head.appendChild(style);
  }

  if (!document.getElementById('appDatalistsContainer')) {
    const dlContainer = document.createElement('div');
    dlContainer.id = 'appDatalistsContainer';
    dlContainer.innerHTML = `
      <datalist id="dl-exp-general"></datalist>
      <datalist id="dl-inv-sys"></datalist>
      <datalist id="dl-inv-titulo"></datalist>
      <datalist id="dl-inv-exp"></datalist>
      <datalist id="dl-inv-titular"></datalist>
      <datalist id="dl-inv-fecha"></datalist>
      <datalist id="dl-audit-fecha"></datalist>
      <datalist id="dl-audit-sys"></datalist>
      <datalist id="dl-audit-titulo"></datalist>
      <datalist id="dl-audit-exp"></datalist>
      <datalist id="dl-audit-detalle-doc"></datalist>
      <datalist id="dl-audit-detalle-mov"></datalist>
      <datalist id="dl-audit-nota"></datalist>
    `;
    document.body.appendChild(dlContainer);
  }

  const invAreaInput = document.getElementById('inv-f-area');
  if (invAreaInput && invAreaInput.tagName === 'INPUT') {
    const selectArea = document.createElement('select');
    selectArea.className = 'col-filter-input';
    selectArea.id = 'inv-f-area';
    selectArea.innerHTML = AREAS_CATALOGO
      .map(a => `<option value="${a.val}">${a.label}</option>`)
      .join('');
    selectArea.addEventListener('change', () => render());
    invAreaInput.parentNode.replaceChild(selectArea, invAreaInput);
  }

  const mapaListas = {
    'searchBox': 'dl-exp-general',
    'boardSearchBox': 'dl-exp-general',
    'modalSearchBox': 'dl-exp-general',
    'auditSearchBox': 'dl-exp-general',
    'inv-f-sys': 'dl-inv-sys',
    'inv-f-titulo': 'dl-inv-titulo',
    'inv-f-exp': 'dl-inv-exp',
    'inv-f-titular': 'dl-inv-titular',
    'inv-f-fecha': 'dl-inv-fecha'
  };

  Object.keys(mapaListas).forEach(id => {
    const el = document.getElementById(id);
    if (el && el.tagName === 'INPUT') {
      el.setAttribute('list', mapaListas[id]);
    }
  });

  actualizarDatalistsGlobales();
}

function actualizarDatalistsGlobales() {
  const setGeneral = new Set();
  const setSys = new Set();
  const setTitulo = new Set();
  const setExp = new Set();
  const setTitular = new Set();
  const setFechaReg = new Set();

  const setAuditFecha = new Set();
  const setAuditSys = new Set();
  const setAuditTitulo = new Set();
  const setAuditExp = new Set();
  const setAuditMov = new Set();
  const setAuditNota = new Set();

  expedientes.forEach(exp => {
    if (exp.idSys) { setGeneral.add(exp.idSys); setSys.add(exp.idSys); }
    if (exp.titulo) { setGeneral.add(exp.titulo); setTitulo.add(exp.titulo); }
    if (exp.id) { setGeneral.add(exp.id); setExp.add(exp.id); }
    if (exp.titular) { setTitular.add(exp.titular); }
    if (exp.fechaRegistro) { setFechaReg.add(exp.fechaRegistro); }

    (exp.historial || []).forEach(h => {
      if (h.fecha) {
        setAuditFecha.add(h.fecha);
        const soloFecha = h.fecha.split(' ')[0];
        if (soloFecha) setAuditFecha.add(soloFecha);
      }
      if (exp.idSys) setAuditSys.add(exp.idSys);
      const tit = h.tituloActual || exp.titulo;
      if (tit) setAuditTitulo.add(tit);
      if (exp.id) setAuditExp.add(exp.id);
      if (h.tipo === 'movimiento' && h.origen && h.destino) {
        setAuditMov.add(`${h.origen} -> ${h.destino}`);
      }
      if (h.nota) setAuditNota.add(h.nota);
    });
  });

  const asignaciones = {
    'dl-exp-general': [...setGeneral],
    'dl-inv-sys': [...setSys],
    'dl-inv-titulo': [...setTitulo],
    'dl-inv-exp': [...setExp],
    'dl-inv-titular': [...setTitular],
    'dl-inv-fecha': [...setFechaReg],
    'dl-audit-fecha': [...setAuditFecha],
    'dl-audit-sys': [...setAuditSys],
    'dl-audit-titulo': [...setAuditTitulo],
    'dl-audit-exp': [...setAuditExp],
    'dl-audit-detalle-doc': ['[Doc]', '[Obs]', '[Titular]'],
    'dl-audit-detalle-mov': [...setAuditMov],
    'dl-audit-nota': [...setAuditNota]
  };

  Object.keys(asignaciones).forEach(dlId => {
    const dlEl = document.getElementById(dlId);
    if (dlEl) {
      dlEl.innerHTML = construirOpcionesDatalist(asignaciones[dlId]);
    }
  });
}

// --- MOTOR VIRTUAL DRAG & DROP CON AUTO-SCROLL HORIZONTAL ---
let dragState = {
  isDragging: false,
  hasMoved: false,
  cloneEl: null,
  sourceEl: null,
  expId: null,
  offsetX: 0,
  offsetY: 0,
  initMouseX: 0,
  initMouseY: 0,
  hoverCol: null
};
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
    } else {
      return;
    }
  }
  if (dragState.hasMoved && !dragRAF) {
    dragRAF = requestAnimationFrame(updateDragVisuals);
  }
}

function procesarAutoScrollKanban(clientX) {
  const kanbanCont = document.getElementById('kanbanColumnsContainer');
  const viewKanban = document.getElementById('viewKanban');
  if (!kanbanCont && !viewKanban) return false;

  let scrollEl = null;
  if (kanbanCont && kanbanCont.scrollWidth > kanbanCont.clientWidth) {
    scrollEl = kanbanCont;
  } else if (viewKanban && viewKanban.scrollWidth > viewKanban.clientWidth) {
    scrollEl = viewKanban;
  } else if (kanbanCont && kanbanCont.parentElement && kanbanCont.parentElement.scrollWidth > kanbanCont.parentElement.clientWidth) {
    scrollEl = kanbanCont.parentElement;
  }

  if (!scrollEl) return false;

  const rect = scrollEl.getBoundingClientRect();
  const zonaDeteccion = 110;
  const velocidadMax = 18;
  let deltaX = 0;

  if (clientX > rect.right - zonaDeteccion) {
    const intensidad = Math.min(1, Math.max(0.15, (clientX - (rect.right - zonaDeteccion)) / zonaDeteccion));
    deltaX = Math.ceil(velocidadMax * intensidad);
  } else if (clientX < rect.left + zonaDeteccion) {
    const intensidad = Math.min(1, Math.max(0.15, ((rect.left + zonaDeteccion) - clientX) / zonaDeteccion));
    deltaX = -Math.ceil(velocidadMax * intensidad);
  }

  if (deltaX !== 0) {
    const scrollAnterior = scrollEl.scrollLeft;
    scrollEl.scrollLeft += deltaX;
    return scrollEl.scrollLeft !== scrollAnterior;
  }
  return false;
}

function updateDragVisuals() {
  if (!dragState.isDragging || !dragState.cloneEl) {
    dragRAF = null;
    return;
  }
  let x = currentMouseX - dragState.offsetX;
  let y = currentMouseY - dragState.offsetY;
  dragState.cloneEl.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(3deg)`;

  const huboScroll = procesarAutoScrollKanban(currentMouseX);

  let elUnder = document.elementFromPoint(currentMouseX, currentMouseY);
  let col = elUnder ? elUnder.closest('.kanban-col') : null;
  if (dragState.hoverCol !== col) {
    if (dragState.hoverCol) dragState.hoverCol.classList.remove('drag-over');
    if (col) col.classList.add('drag-over');
    dragState.hoverCol = col;
  }

  if (huboScroll) {
    dragRAF = requestAnimationFrame(updateDragVisuals);
  } else {
    dragRAF = null;
  }
}

function onDragEnd() {
  if (!dragState.isDragging) return;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  if (dragRAF) {
    cancelAnimationFrame(dragRAF);
    dragRAF = null;
  }
  if (dragState.hasMoved && dragState.cloneEl) {
    dragState.cloneEl.remove();
    dragState.sourceEl.classList.remove('dragging');
    document.body.classList.remove('is-dragging');
    if (dragState.hoverCol) {
      dragState.hoverCol.classList.remove('drag-over');
      let newArea = dragState.hoverCol.getAttribute('data-area');
      let expObj = expedientes.find(x => x.id === dragState.expId || x.idSys === dragState.expId);
      if (expObj && expObj.area !== newArea) {
        moverExpediente(expObj.id, newArea);
      }
    }
  }
  dragState = {
    isDragging: false,
    hasMoved: false,
    cloneEl: null,
    sourceEl: null,
    expId: null,
    offsetX: 0,
    offsetY: 0,
    initMouseX: 0,
    initMouseY: 0,
    hoverCol: null
  };
}

// --- GESTIÓN DE MODALES DE ACCIÓN Y VALIDACIÓN DE EXCEPCIONES ---
let accionPendienteCallback = null;

function asegurarEstilosValidacion() {
  if (document.getElementById('validationExceptionStyles')) return;
  const style = document.createElement('style');
  style.id = 'validationExceptionStyles';
  style.textContent = `
    .input-error {
      border-color: var(--md-sys-color-error, #b3261e) !important;
      box-shadow: 0 0 0 3px rgba(179, 38, 30, 0.16) !important;
    }
    .error-msg-inline {
      display: none;
      color: var(--md-sys-color-error, #b3261e);
      font-size: 12px;
      font-weight: 600;
      margin-top: 2px;
      padding-left: 6px;
    }
    .error-msg-inline.visible {
      display: block;
    }
  `;
  document.head.appendChild(style);
}

function marcarErrorCampo(inputEl, errEl, mensaje) {
  if (inputEl) inputEl.classList.add('input-error');
  if (errEl) {
    errEl.textContent = mensaje;
    errEl.classList.add('visible');
  }
}

function limpiarErrorCampo(inputEl, errEl) {
  if (inputEl) inputEl.classList.remove('input-error');
  if (errEl) {
    errEl.textContent = '';
    errEl.classList.remove('visible');
  }
}

function vincularLimpiezaError(inputId, errId, evento = 'input') {
  const inputEl = document.getElementById(inputId);
  const errEl = document.getElementById(errId);
  if (!inputEl) return;
  inputEl.addEventListener(evento, () => {
    if (evento === 'change' || inputEl.value.trim().length > 0) {
      limpiarErrorCampo(inputEl, errEl);
    }
  });
}

function abrirActionModal(titulo, subtitulo, camposHTML, onConfirmar) {
  asegurarEstilosValidacion();
  document.getElementById('actionModalTitle').innerText = titulo;
  document.getElementById('actionModalSubtitle').innerText = subtitulo;
  document.getElementById('actionModalFieldsContainer').innerHTML = camposHTML;
  document.getElementById('actionModalOverlay').style.display = 'flex';
  accionPendienteCallback = onConfirmar;
}

function cerrarActionModal() {
  document.getElementById('actionModalOverlay').style.display = 'none';
  accionPendienteCallback = null;
}

async function ejecutarAccionPopup() {
  if (accionPendienteCallback) {
    const resultado = await accionPendienteCallback();
    // Si la validación detecta una excepción, aborta el cierre y conserva los datos capturados
    if (resultado === false) return;
  }
  cerrarActionModal();
}

// --- CREACIÓN, EDICIÓN Y MOVIMIENTO CON PERSISTENCIA ---
function abrirModalCrearExpediente() {
  let nextNum = expedientes.length + 1;
  let nextId = `EXP-CNA-${String(nextNum).padStart(3, '0')}`;
  let newSysId = generarIdSistema();
  let diaHoy = obtenerFechaYHora().iso;

  let campos = `
    <div class="action-modal-form-group">
      <label>Fecha de Registro:</label>
      <input type="date" class="search-box" id="popupFechaAccion" value="${diaHoy}">
    </div>
    <div class="action-modal-form-group">
      <label>ID Sistema (Automático):</label>
      <input type="text" class="search-box" value="${newSysId}" disabled style="background:var(--md-sys-color-surface-container); font-family: monospace;">
    </div>
    <div class="action-modal-form-group">
      <label>No. de Expediente:</label>
      <input type="text" class="search-box" id="popupNewId" value="${nextId}">
    </div>
    <div class="action-modal-form-group">
      <label>Título / Clave Principal:</label>
      <input type="text" class="search-box" id="popupNewTitulo" placeholder="Ej. TIT-2026-B12" style="font-weight:bold;">
    </div>
    <div class="action-modal-form-group">
      <label>Titular:</label>
      <input type="text" class="search-box" id="popupNewTitular" placeholder="Ej. Módulo de Riego No. 3">
    </div>
    <div class="action-modal-form-group">
      <label>Área de Inicio:</label>
      <select class="control-modern" id="popupNewArea" style="width:100%; height:40px;">
        <option value="CIS">CIS (Entrada / Tablero)</option>
        <option value="ATENCION">Atención a Usuarios</option>
        <option value="DICTAMINACION">Dictaminación</option>
        <option value="SUBDIRECTOR">Subdirección Adm. Agua</option>
        <option value="INFRACCIONES">Infracciones</option>
        <option value="INSPECCION">Inspección</option>
        <option value="TECNICA">Técnica</option>
        <option value="JURIDICO">Jurídico</option>
        <option value="DIRECCION">Dirección</option>
        <option value="ARCHIVO">Archivo General (En resguardo)</option>
      </select>
    </div>
    <div class="action-modal-form-group">
      <label>Observaciones iniciales:</label>
      <input type="text" class="search-box" id="popupNewObs" placeholder="Anotaciones, pendientes o estado físico...">
    </div>`;

  abrirActionModal('Registrar Expediente', 'Apertura de nuevo registro en el sistema.', campos, () => {
    let fSeleccionada = document.getElementById('popupFechaAccion').value;
    let noExp = document.getElementById('popupNewId').value.trim() || nextId;
    let titulo = document.getElementById('popupNewTitulo').value.trim() || 'TIT-PENDIENTE';
    let titular = document.getElementById('popupNewTitular').value.trim() || 'Sin Titular';
    let areaInicial = document.getElementById('popupNewArea').value;
    let obs = document.getElementById('popupNewObs').value.trim();
    let ts = obtenerFechaYHora(fSeleccionada);
    let vaATablero = (areaInicial !== 'ARCHIVO');

    const nuevoExpediente = {
      idSys: newSysId,
      id: noExp,
      titulo: titulo,
      titular: titular,
      area: areaInicial,
      observacion: obs,
      fechaRegistro: ts.dateOnly,
      tsRegistro: ts.timestamp,
      tiempo: vaATablero ? ts.formatted : '---',
      dateISO: vaATablero ? ts.iso : '',
      lastModified: ts.timestamp,
      enTablero: vaATablero,
      historial: [
        {
          ts: ts.timestamp,
          tipo: 'movimiento',
          usuario: 'Admin Local',
          tituloActual: titulo,
          origen: 'Nuevo',
          destino: areaInicial,
          fecha: ts.formatted,
          nota: 'Alta de expediente en sistema',
          iso: ts.iso
        }
      ]
    };

    expedientes.unshift(nuevoExpediente);
    StorageManager.guardar(expedientes);
    actualizarDatalistsGlobales();
    registrarLog(`Alta (${newSysId})`, `Título: ${titulo} -> ${areaInicial}`);
    mostrarToast(`Expediente registrado en ${areaInicial}.`);
    render();
  });
}

function moverExpediente(id, areaDestinoForzada) {
  let exp = expedientes.find(e => e.id === id || e.idSys === id);
  if (!exp) return;

  let diaHoy = obtenerFechaYHora().iso;
  let areasOpciones = [
    { val: 'CIS', label: 'CIS' },
    { val: 'ATENCION', label: 'Atención a Usuarios' },
    { val: 'DICTAMINACION', label: 'Dictaminación' },
    { val: 'SUBDIRECTOR', label: 'Subdirección Adm. Agua' },
    { val: 'INFRACCIONES', label: 'Infracciones' },
    { val: 'INSPECCION', label: 'Inspección' },
    { val: 'TECNICA', label: 'Técnica' },
    { val: 'JURIDICO', label: 'Jurídico' },
    { val: 'DIRECCION', label: 'Dirección' },
    { val: 'ARCHIVO', label: 'Archivo General (Retirar del tablero)' }
  ];

  let selectHtml = '<select id="popupSelectDestino" class="control-modern" style="width:100%; height:40px;">';
  areasOpciones.forEach(a => {
    let selected = (areaDestinoForzada && areaDestinoForzada === a.val) || (!areaDestinoForzada && exp.area === a.val) ? 'selected' : '';
    selectHtml += `<option value="${a.val}" ${selected}>${a.label}</option>`;
  });
  selectHtml += '</select>';

  let campos = `
    <div class="action-modal-form-group">
      <label>Fecha del Movimiento:</label>
      <input type="date" class="search-box" id="popupFechaAccion" value="${diaHoy}">
    </div>
    <div class="action-modal-form-group">
      <label>Área Destino:</label>
      ${selectHtml}
      <span id="errPopupSelectDestino" class="error-msg-inline"></span>
    </div>
    <div class="action-modal-form-group">
      <label>Observación opcional:</label>
      <input type="text" class="search-box" id="popupInputObs" value="${escaparAttr(exp.observacion || '')}" placeholder="Actualizar notas del expediente...">
    </div>
    <div class="action-modal-form-group">
      <label>Justificación del Pase (Bitácora):</label>
      <input type="text" class="search-box" id="popupInputNota" value="Transferencia departamental">
    </div>`;

  abrirActionModal('Mover Expediente', `Reubicar documento: ${exp.titulo}`, campos, () => {
    let fSeleccionada = document.getElementById('popupFechaAccion').value;
    let selectDestino = document.getElementById('popupSelectDestino');
    let errDestino = document.getElementById('errPopupSelectDestino');
    let destino = selectDestino.value;
    let nObs = document.getElementById('popupInputObs').value.trim();
    let nota = document.getElementById('popupInputNota').value.trim() || 'Sin justificación';
    let areaAnterior = exp.area;

    if (destino === areaAnterior) {
      marcarErrorCampo(selectDestino, errDestino, 'El expediente ya se encuentra en esta área. Selecciona un destino diferente.');
      selectDestino.focus();
      mostrarToast('Error: Selecciona un área destino distinta a la actual.');
      return false;
    }

    let ts = obtenerFechaYHora(fSeleccionada);

    exp.historial.unshift({
      ts: ts.timestamp,
      tipo: 'movimiento',
      usuario: 'Admin Local',
      tituloActual: exp.titulo,
      origen: areaAnterior,
      destino: destino,
      fecha: ts.formatted,
      nota: nota,
      iso: ts.iso
    });

    if (exp.observacion !== nObs) {
      exp.historial.unshift({
        ts: ts.timestamp + 1,
        tipo: 'observacion',
        usuario: 'Admin Local',
        tituloActual: exp.titulo,
        previo: exp.observacion || 'Ninguna',
        actual: nObs || 'Ninguna',
        fecha: ts.formatted,
        nota: 'Actualización en transferencia',
        iso: ts.iso
      });
      exp.observacion = nObs;
    }

    exp.area = destino;
    exp.enTablero = (destino !== 'ARCHIVO');
    exp.tiempo = exp.enTablero ? ts.formatted : '---';
    exp.dateISO = exp.enTablero ? ts.iso : '';
    exp.lastModified = ts.timestamp;

    StorageManager.guardar(expedientes);
    actualizarDatalistsGlobales();
    registrarLog(`Pase (${exp.idSys})`, `${areaAnterior} ➔ ${destino}`);
    mostrarToast(`Expediente movido a ${destino}.`);
    render();
    return true;
  });

  vincularLimpiezaError('popupSelectDestino', 'errPopupSelectDestino', 'change');
}

function modificarExpediente(id) {
  let exp = expedientes.find(e => e.id === id || e.idSys === id);
  if (!exp) return;

  let diaHoy = obtenerFechaYHora().iso;

  let campos = `
    <div class="action-modal-form-group">
      <label>Fecha de Actualización:</label>
      <input type="date" class="search-box" id="popupFechaAccion" value="${diaHoy}">
    </div>
    <div class="action-modal-form-group">
      <label>ID Sistema (Inmutable):</label>
      <input type="text" class="search-box" value="${escaparAttr(exp.idSys)}" disabled style="background:var(--md-sys-color-surface-container); font-family: monospace;">
    </div>
    <div class="action-modal-form-group">
      <label>No. de Expediente:</label>
      <input type="text" class="search-box" id="popupInputNoExp" value="${escaparAttr(exp.id || '')}">
      <span id="errPopupInputNoExp" class="error-msg-inline"></span>
    </div>
    <div class="action-modal-form-group">
      <label>Título / Clave Principal:</label>
      <input type="text" class="search-box" id="popupInputTitulo" value="${escaparAttr(exp.titulo || '')}" style="font-weight:bold;">
      <span id="errPopupInputTitulo" class="error-msg-inline"></span>
    </div>
    <div class="action-modal-form-group">
      <label>Titular:</label>
      <input type="text" class="search-box" id="popupInputTitular" value="${escaparAttr(exp.titular || '')}">
    </div>
    <div class="action-modal-form-group">
      <label>Observaciones:</label>
      <input type="text" class="search-box" id="popupInputObs" value="${escaparAttr(exp.observacion || '')}">
    </div>
    <div class="action-modal-form-group">
      <label>Justificación para Bitácora:</label>
      <input type="text" class="search-box" id="popupInputNota" placeholder="Ej. Corrección de datos o anexo de trámite">
    </div>`;

  abrirActionModal('Modificar Expediente', `Editar metadatos de ${exp.idSys}`, campos, () => {
    const inpNoExp = document.getElementById('popupInputNoExp');
    const inpTit = document.getElementById('popupInputTitulo');
    const errNoExp = document.getElementById('errPopupInputNoExp');
    const errTit = document.getElementById('errPopupInputTitulo');

    let fSeleccionada = document.getElementById('popupFechaAccion').value;
    let nNoExp = (inpNoExp.value || '').trim();
    let nTit = (inpTit.value || '').trim();
    let nTitular = (document.getElementById('popupInputTitular').value || '').trim() || 'Sin Titular';
    let nObs = (document.getElementById('popupInputObs').value || '').trim();
    let nota = (document.getElementById('popupInputNota').value || '').trim() || 'Actualización manual';

    // Validación estricta de excepciones antes de modificar memoria o bitácora
    limpiarErrorCampo(inpNoExp, errNoExp);
    limpiarErrorCampo(inpTit, errTit);

    let primerCampoInvalido = null;

    if (!nNoExp) {
      marcarErrorCampo(inpNoExp, errNoExp, 'El No. de Expediente es obligatorio y no puede quedar vacío.');
      primerCampoInvalido = inpNoExp;
    }

    if (!nTit) {
      marcarErrorCampo(inpTit, errTit, 'El Título / Clave Principal es obligatorio y no puede quedar vacío.');
      if (!primerCampoInvalido) primerCampoInvalido = inpTit;
    }

    if (primerCampoInvalido) {
      primerCampoInvalido.focus();
      mostrarToast('Error: Completa los campos obligatorios antes de guardar.');
      return false; // Mantiene el modal abierto y aborta el guardado
    }

    let ts = obtenerFechaYHora(fSeleccionada);
    let huboCambios = false;

    if (nTit !== exp.titulo) {
      exp.historial.unshift({
        ts: ts.timestamp,
        tipo: 'titulo',
        usuario: 'Admin Local',
        tituloActual: nTit,
        previo: exp.titulo,
        actual: nTit,
        fecha: ts.formatted,
        nota: 'TITULO: ' + nota,
        iso: ts.iso
      });
      exp.titulo = nTit;
      huboCambios = true;
    }
    if (nNoExp !== exp.id) {
      exp.historial.unshift({
        ts: ts.timestamp,
        tipo: 'titulo',
        usuario: 'Admin Local',
        tituloActual: exp.titulo,
        previo: `Exp: ${exp.id}`,
        actual: `Exp: ${nNoExp}`,
        fecha: ts.formatted,
        nota: 'NO. EXP: ' + nota,
        iso: ts.iso
      });
      exp.id = nNoExp;
      huboCambios = true;
    }
    if (nTitular !== exp.titular) {
      exp.historial.unshift({
        ts: ts.timestamp,
        tipo: 'titular',
        usuario: 'Admin Local',
        tituloActual: exp.titulo,
        previo: exp.titular || 'Sin Titular',
        actual: nTitular,
        fecha: ts.formatted,
        nota: 'TITULAR: ' + nota,
        iso: ts.iso
      });
      exp.titular = nTitular;
      huboCambios = true;
    }
    if ((exp.observacion || '') !== nObs) {
      exp.historial.unshift({
        ts: ts.timestamp,
        tipo: 'observacion',
        usuario: 'Admin Local',
        tituloActual: exp.titulo,
        previo: exp.observacion || 'Ninguna',
        actual: nObs || 'Ninguna',
        fecha: ts.formatted,
        nota: 'OBS: ' + nota,
        iso: ts.iso
      });
      exp.observacion = nObs;
      registrarLog('Observación editada', `Para: ${exp.idSys}`);
      huboCambios = true;
    }

    if (!huboCambios) {
      mostrarToast('No se detectaron cambios en el expediente.');
      return true;
    }

    exp.lastModified = ts.timestamp;
    StorageManager.guardar(expedientes);
    actualizarDatalistsGlobales();
    mostrarToast('Cambios guardados con éxito.');
    render();
    return true;
  });

  vincularLimpiezaError('popupInputNoExp', 'errPopupInputNoExp');
  vincularLimpiezaError('popupInputTitulo', 'errPopupInputTitulo');
}

function abrirDetalles(id) {
  let exp = expedientes.find(e => e.id === id || e.idSys === id);
  if (!exp) return;

  document.getElementById('detallesTituloActual').innerText = exp.titulo;
  document.getElementById('detallesIdSysActual').innerText = 'ID Sistema: ' + exp.idSys;
  document.getElementById('detallesFechaRegistro').innerText = exp.fechaRegistro;
  document.getElementById('detallesSubtitle').innerText = `No. Exp: ${exp.id} | Titular: ${exp.titular}`;

  let btnAuditoriaLink = document.getElementById('btnVerEnAuditoriaGlobal');
  if (btnAuditoriaLink) {
    btnAuditoriaLink.onclick = () => {
      cerrarDetallesModal();
      abrirModalAuditoriaGlobal(exp.idSys);
    };
  }

  let cTit = document.getElementById('detallesMiniBitacoraTitulos');
  let cMov = document.getElementById('detallesMiniBitacoraMovimientos');
  cTit.innerHTML = '';
  cMov.innerHTML = '';

  let histTitulos = (exp.historial || []).filter(h => h.tipo === 'titulo' || h.tipo === 'observacion' || h.tipo === 'titular');
  let histMovs = (exp.historial || []).filter(h => h.tipo === 'movimiento');

  if (histTitulos.length === 0) {
    cTit.innerHTML = '<span style="color:var(--md-sys-color-on-surface-variant); font-size:12px;">Sin modificaciones documentales.</span>';
  } else {
    histTitulos.forEach(h => {
      let lblIcon = '[Doc]';
      if (h.tipo === 'observacion') lblIcon = '[Obs]';
      if (h.tipo === 'titular') lblIcon = '[Titular]';
      cTit.innerHTML += `<div class="mini-bitacora-item type-${h.tipo}"><span class="mb-fecha">${h.fecha} (${h.usuario || 'Admin'})</span><div class="mb-titulo">${lblIcon} <span style="text-decoration:line-through; opacity:0.6; font-weight:400;">${h.previo}</span> <br> -> ${h.actual}</div><div class="mb-nota">Justificación: ${h.nota}</div></div>`;
    });
  }

  if (histMovs.length === 0) {
    cMov.innerHTML = '<span style="color:var(--md-sys-color-on-surface-variant); font-size:12px;">Sin transferencias registradas.</span>';
  } else {
    histMovs.forEach(h => {
      let badgeO = 'badge badge-' + h.origen.replace(/ /g, '');
      let badgeD = 'badge badge-' + h.destino.replace(/ /g, '');
      cMov.innerHTML += `<div class="mini-bitacora-item type-movimiento"><span class="mb-fecha">${h.fecha} (${h.usuario || 'Admin'})</span><div class="mb-titulo" style="display:flex; align-items:center; gap:6px;"><span class="${badgeO}" style="font-size:10px; padding:2px 6px;">${h.origen}</span> <span style="color:var(--md-sys-color-outline);">➔</span> <span class="${badgeD}" style="font-size:10px; padding:2px 6px;">${h.destino}</span></div><div class="mb-nota">Justificación: ${h.nota}</div></div>`;
    });
  }
  document.getElementById('detallesModalOverlay').style.display = 'flex';
}

function cerrarDetallesModal() {
  document.getElementById('detallesModalOverlay').style.display = 'none';
}

function abrirModalInventario() {
  actualizarDatalistsGlobales();
  document.getElementById('modalInventario').style.display = 'flex';
  render();
}

function cerrarModalInventario() {
  document.getElementById('modalInventario').style.display = 'none';
}

function abrirModalAuditoriaGlobal(filtroPrestablecido) {
  actualizarDatalistsGlobales();
  document.getElementById('modalAuditoriaGlobal').style.display = 'flex';
  if (filtroPrestablecido) {
    document.getElementById('auditSearchBox').value = filtroPrestablecido;
  }
  renderAuditoria();
}

function cerrarModalAuditoriaGlobal() {
  document.getElementById('modalAuditoriaGlobal').style.display = 'none';
}

function cambiarTabAuditoria(tab) {
  tabActualAuditoria = tab;
  document.getElementById('tabDocGlobal').classList.toggle('active', tab === 'documental');
  document.getElementById('tabMovGlobal').classList.toggle('active', tab === 'transferencias');
  renderAuditoria();
}

function limpiarFiltrosAuditoria() {
  const sBox = document.getElementById('auditSearchBox');
  const dFrom = document.getElementById('auditDateFrom');
  const dTo = document.getElementById('auditDateTo');
  if (sBox) sBox.value = '';
  if (dFrom) dFrom.value = '';
  if (dTo) dTo.value = '';
  document.querySelectorAll('#modalAuditoriaGlobal .col-filter-input').forEach(el => {
    el.value = '';
  });
  renderAuditoria();
}

function limpiarFiltrosInventario() {
  const mSearch = document.getElementById('modalSearchBox');
  const mArea = document.getElementById('modalAreaFilter');
  const mFrom = document.getElementById('modalDateFrom');
  const mTo = document.getElementById('modalDateTo');
  if (mSearch) mSearch.value = '';
  if (mArea) mArea.value = 'todas';
  if (mFrom) mFrom.value = '';
  if (mTo) mTo.value = '';
  document.querySelectorAll('#modalInventario .col-filter-input').forEach(el => {
    el.value = '';
  });
  render();
}

// --- CONSULTA Y RENDERIZADO DE BITÁCORA DE AUDITORÍA ---
function obtenerRegistrosAuditoriaFiltrados() {
  let search = (document.getElementById('auditSearchBox') ? document.getElementById('auditSearchBox').value : '').toLowerCase();
  let dateFrom = document.getElementById('auditDateFrom') ? document.getElementById('auditDateFrom').value : '';
  let dateTo = document.getElementById('auditDateTo') ? document.getElementById('auditDateTo').value : '';

  let fFecha = (document.getElementById('f-fecha') ? document.getElementById('f-fecha').value : '').toLowerCase();
  let fUsuario = (document.getElementById('f-usuario') ? document.getElementById('f-usuario').value : '').toLowerCase();
  let fSys = (document.getElementById('f-sys') ? document.getElementById('f-sys').value : '').toLowerCase();
  let fTitulo = (document.getElementById('f-titulo') ? document.getElementById('f-titulo').value : '').toLowerCase();
  let fExp = (document.getElementById('f-exp') ? document.getElementById('f-exp').value : '').toLowerCase();
  let fDetalle = (document.getElementById('f-detalle') ? document.getElementById('f-detalle').value : '').toLowerCase();
  let fArea = (tabActualAuditoria === 'transferencias' && document.getElementById('f-area')) ? document.getElementById('f-area').value : '';
  let fNota = (document.getElementById('f-nota') ? document.getElementById('f-nota').value : '').toLowerCase();

  let historialGlobal = [];
  expedientes.forEach(exp => {
    (exp.historial || []).forEach(h => {
      historialGlobal.push({
        idSys: exp.idSys,
        expId: exp.id,
        tituloReal: h.tituloActual || exp.titulo,
        expTitular: exp.titular,
        tipo: h.tipo,
        usuario: h.usuario,
        origen: h.origen,
        destino: h.destino,
        previo: h.previo,
        actual: h.actual,
        fecha: h.fecha,
        nota: h.nota,
        iso: h.iso,
        ts: h.ts,
        detalleTexto: (h.tipo === 'titulo' || h.tipo === 'observacion' || h.tipo === 'titular')
          ? (h.previo + ' -> ' + h.actual)
          : (h.origen + ' -> ' + h.destino)
      });
    });
  });

  let filtrado = historialGlobal.filter(h =>
    tabActualAuditoria === 'documental'
      ? (h.tipo === 'titulo' || h.tipo === 'observacion' || h.tipo === 'titular')
      : h.tipo === 'movimiento'
  );

  filtrado = filtrado.filter(h => {
    let matchGlobal = !search ||
      h.idSys.toLowerCase().includes(search) ||
      h.expId.toLowerCase().includes(search) ||
      h.tituloReal.toLowerCase().includes(search) ||
      (h.nota || '').toLowerCase().includes(search);
    let matchFrom = !dateFrom || h.iso >= dateFrom;
    let matchTo = !dateTo || h.iso <= dateTo;

    let matchFecha = !fFecha || h.fecha.toLowerCase().includes(fFecha);
    let matchUsu = !fUsuario || (h.usuario || 'Admin Local').toLowerCase() === fUsuario;
    let matchSys = !fSys || h.idSys.toLowerCase().includes(fSys);
    let matchTit = !fTitulo || h.tituloReal.toLowerCase().includes(fTitulo);
    let matchExpCol = !fExp || h.expId.toLowerCase().includes(fExp);
    let matchDet = !fDetalle || h.detalleTexto.toLowerCase().includes(fDetalle);
    let matchArea = !fArea || (h.destino && h.destino === fArea);
    let matchNot = !fNota || (h.nota || '').toLowerCase().includes(fNota);

    return matchGlobal && matchFrom && matchTo && matchFecha && matchUsu && matchSys && matchTit && matchExpCol && matchDet && matchArea && matchNot;
  });

  filtrado.sort((a, b) => b.ts - a.ts);
  return filtrado;
}

function obtenerUsuariosUnicosAuditoria() {
  const usuarios = new Set(['Admin Local']);
  expedientes.forEach(exp => {
    (exp.historial || []).forEach(h => {
      if (h.usuario) usuarios.add(h.usuario);
    });
  });
  return [...usuarios];
}

function renderAuditoria() {
  let head = document.getElementById('audit-table-head');
  let body = document.getElementById('audit-table-body');
  if (!head || !body) return;

  if (ultimaTabRenderizada !== tabActualAuditoria) {
    ultimaTabRenderizada = tabActualAuditoria;

    const usuarios = obtenerUsuariosUnicosAuditoria();
    const opcionesUsuarioHtml = '<option value="">Todos</option>' +
      usuarios.map(u => `<option value="${escaparAttr(u)}">${escaparAttr(u)}</option>`).join('');

    const opcionesAreaHtml = AREAS_CATALOGO
      .map(a => `<option value="${a.val}">${a.label}</option>`)
      .join('');

    const baseHeaders =
      '<th>Fecha / Hora<br><input type="text" class="col-filter-input" id="f-fecha" list="dl-audit-fecha" placeholder="Elegir o escribir..." oninput="renderAuditoria()"></th>' +
      '<th>Usuario<br><select class="col-filter-input" id="f-usuario" onchange="renderAuditoria()">' + opcionesUsuarioHtml + '</select></th>' +
      '<th>ID Sistema<br><input type="text" class="col-filter-input" id="f-sys" list="dl-audit-sys" placeholder="Elegir o escribir..." oninput="renderAuditoria()"></th>' +
      '<th>Título (Clave Principal)<br><input type="text" class="col-filter-input" id="f-titulo" list="dl-audit-titulo" placeholder="Elegir o escribir..." oninput="renderAuditoria()"></th>' +
      '<th>No. Expediente<br><input type="text" class="col-filter-input" id="f-exp" list="dl-audit-exp" placeholder="Elegir o escribir..." oninput="renderAuditoria()"></th>';

    if (tabActualAuditoria === 'documental') {
      head.innerHTML = '<tr>' + baseHeaders +
        '<th>Detalle Documental / Obs.<br><input type="text" class="col-filter-input" id="f-detalle" list="dl-audit-detalle-doc" placeholder="Elegir o escribir..." oninput="renderAuditoria()"></th>' +
        '<th>Justificación<br><input type="text" class="col-filter-input" id="f-nota" list="dl-audit-nota" placeholder="Elegir o escribir..." oninput="renderAuditoria()"></th></tr>';
    } else {
      head.innerHTML = '<tr>' + baseHeaders +
        '<th>Origen -> Destino<br><input type="text" class="col-filter-input" id="f-detalle" list="dl-audit-detalle-mov" placeholder="Elegir o escribir..." oninput="renderAuditoria()"></th>' +
        '<th>Área<br><select class="col-filter-input" id="f-area" onchange="renderAuditoria()">' + opcionesAreaHtml + '</select></th>' +
        '<th>Justificación<br><input type="text" class="col-filter-input" id="f-nota" list="dl-audit-nota" placeholder="Elegir o escribir..." oninput="renderAuditoria()"></th></tr>';
    }
  } else {
    const selUsuario = document.getElementById('f-usuario');
    if (selUsuario) {
      const valActual = selUsuario.value;
      const usuarios = obtenerUsuariosUnicosAuditoria();
      selUsuario.innerHTML = '<option value="">Todos</option>' +
        usuarios.map(u => `<option value="${escaparAttr(u)}"${valActual === u ? ' selected' : ''}>${escaparAttr(u)}</option>`).join('');
    }
  }

  let fFecha = (document.getElementById('f-fecha') ? document.getElementById('f-fecha').value : '');
  let fUsuario = (document.getElementById('f-usuario') ? document.getElementById('f-usuario').value : '');
  let fSys = (document.getElementById('f-sys') ? document.getElementById('f-sys').value : '');
  let fTitulo = (document.getElementById('f-titulo') ? document.getElementById('f-titulo').value : '');
  let fExp = (document.getElementById('f-exp') ? document.getElementById('f-exp').value : '');
  let fDetalle = (document.getElementById('f-detalle') ? document.getElementById('f-detalle').value : '');
  let fArea = (document.getElementById('f-area') ? document.getElementById('f-area').value : '');
  let fNota = (document.getElementById('f-nota') ? document.getElementById('f-nota').value : '');

  let search = (document.getElementById('auditSearchBox') ? document.getElementById('auditSearchBox').value : '');
  let dateFrom = (document.getElementById('auditDateFrom') ? document.getElementById('auditDateFrom').value : '');
  let dateTo = (document.getElementById('auditDateTo') ? document.getElementById('auditDateTo').value : '');

  let hayFiltrosActivos = search || dateFrom || dateTo || fFecha || fUsuario || fSys || fTitulo || fExp || fDetalle || (tabActualAuditoria === 'transferencias' && fArea) || fNota;
  const btnLimpiar = document.getElementById('btnLimpiarFiltros');
  if (btnLimpiar) btnLimpiar.style.display = hayFiltrosActivos ? 'inline-flex' : 'none';

  body.innerHTML = '';
  let historialFiltrado = obtenerRegistrosAuditoriaFiltrados();
  let totalColumnas = tabActualAuditoria === 'transferencias' ? 8 : 7;

  if (historialFiltrado.length === 0) {
    body.innerHTML = '<tr><td colspan="' + totalColumnas + '" style="text-align:center; padding: 24px;">No se encontraron registros.</td></tr>';
  } else {
    historialFiltrado.forEach(h => {
      if (tabActualAuditoria === 'documental') {
        let etiquetaPrefijo = '[Doc]';
        if (h.tipo === 'observacion') etiquetaPrefijo = '<strong style="color:#e65100;">[Obs]</strong>';
        if (h.tipo === 'titular') etiquetaPrefijo = '<strong style="color:var(--md-sys-color-primary);">[Titular]</strong>';
        let detalleHtml = etiquetaPrefijo + ' <span style="text-decoration:line-through; opacity:0.6;">' + h.previo + '</span> -> <strong>' + h.actual + '</strong>';

        body.innerHTML +=
          '<tr><td>' + h.fecha + '</td>' +
          '<td><span style="font-weight:500; font-size:12px; padding:3px 8px; border-radius:6px; background:var(--md-sys-color-surface-container); color:var(--md-sys-color-on-surface);">' + (h.usuario || 'Admin Local') + '</span></td>' +
          '<td><span class="sys-id-tag">' + h.idSys + '</span></td>' +
          '<td style="font-weight:700; color:var(--md-sys-color-primary);">' + h.tituloReal + '</td>' +
          '<td style="font-weight:500;">' + h.expId + '</td>' +
          '<td>' + detalleHtml + '</td>' +
          '<td style="color:var(--md-sys-color-on-surface-variant);">' + (h.nota || '') + '</td></tr>';
      } else {
        let badgeO = 'badge badge-' + (h.origen || '').replace(/ /g, '');
        let badgeD = 'badge badge-' + (h.destino || '').replace(/ /g, '');
        let movimientoHtml = '<span class="' + badgeO + '" style="font-size:11px; padding:2px 8px;">' + h.origen + '</span> <span style="color:var(--md-sys-color-outline); margin: 0 4px;">➔</span> <span class="' + badgeD + '" style="font-size:11px; padding:2px 8px;">' + h.destino + '</span>';
        let areaActualMovimientoHtml = '<span class="' + badgeD + '" style="font-size:11px; padding:2px 8px;">' + h.destino + '</span>';

        body.innerHTML +=
          '<tr><td>' + h.fecha + '</td>' +
          '<td><span style="font-weight:500; font-size:12px; padding:3px 8px; border-radius:6px; background:var(--md-sys-color-surface-container); color:var(--md-sys-color-on-surface);">' + (h.usuario || 'Admin Local') + '</span></td>' +
          '<td><span class="sys-id-tag">' + h.idSys + '</span></td>' +
          '<td style="font-weight:700; color:var(--md-sys-color-primary);">' + h.tituloReal + '</td>' +
          '<td style="font-weight:500;">' + h.expId + '</td>' +
          '<td>' + movimientoHtml + '</td>' +
          '<td>' + areaActualMovimientoHtml + '</td>' +
          '<td style="color:var(--md-sys-color-on-surface-variant);">' + (h.nota || '') + '</td></tr>';
      }
    });
  }
}

// ==========================================================================
// MÓDULO DE EXPORTACIÓN DOCUMENTAL Y PERSISTENCIA EN DISCO
// ==========================================================================
async function descargarArchivo(contenido, nombreArchivo, opciones = {}) {
  const mimeType = opciones.mimeType || 'text/plain;charset=utf-8;';
  const tauriDialog = window.__TAURI__ && window.__TAURI__.dialog;
  const tauriFs = window.__TAURI__ && window.__TAURI__.fs;

  if (tauriDialog && tauriFs && typeof tauriDialog.save === 'function' && typeof tauriFs.writeTextFile === 'function') {
    try {
      const rutaDestino = await tauriDialog.save({
        title: opciones.titulo || 'Seleccionar ubicación de guardado',
        defaultPath: nombreArchivo,
        filters: opciones.filtros || []
      });

      if (!rutaDestino) {
        return { guardado: false, cancelado: true };
      }

      await tauriFs.writeTextFile(rutaDestino, contenido);
      return { guardado: true, ruta: rutaDestino };
    } catch (err) {
      console.error('Error al guardar archivo vía Tauri FS:', err);
      mostrarToast('No se pudo guardar en esa ruta: ' + (err.message || err));
      return { guardado: false, cancelado: false };
    }
  }

  const blob = new Blob([contenido], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
  return { guardado: true, ruta: nombreArchivo };
}

async function exportarAuditoriaCSV() {
  const registros = obtenerRegistrosAuditoriaFiltrados();
  if (registros.length === 0) {
    mostrarToast('No hay registros para exportar con los filtros actuales.');
    return;
  }

  const esTransferencias = tabActualAuditoria === 'transferencias';
  const tipoReporte = esTransferencias ? 'Transferencias' : 'Documental_y_Obs';
  const ahora = obtenerFechaYHora();
  const nombreArchivo = 'Bitacora_CONAGUA_' + tipoReporte + '_' + ahora.iso + '.csv';

  const encabezados = esTransferencias
    ? ['Fecha/Hora', 'Usuario', 'ID Sistema', 'Titulo (Clave)', 'No. Expediente', 'Origen -> Destino', 'Area', 'Justificacion']
    : ['Fecha/Hora', 'Usuario', 'ID Sistema', 'Titulo (Clave)', 'No. Expediente', 'Detalle del Evento', 'Justificacion'];

  let lineas = [encabezados.map(h => '"' + h + '"').join(',')];

  registros.forEach(r => {
    let fila;
    if (esTransferencias) {
      fila = [
        r.fecha || '',
        r.usuario || 'Admin Local',
        r.idSys || '',
        r.tituloReal || '',
        r.expId || '',
        (r.origen || '') + ' -> ' + (r.destino || ''),
        r.destino || '',
        r.nota || ''
      ];
    } else {
      const prefijo = r.tipo === 'observacion' ? '[Obs] ' : (r.tipo === 'titular' ? '[Titular] ' : '[Doc] ');
      fila = [
        r.fecha || '',
        r.usuario || 'Admin Local',
        r.idSys || '',
        r.tituloReal || '',
        r.expId || '',
        prefijo + r.previo + ' -> ' + r.actual,
        r.nota || ''
      ];
    }

    lineas.push(fila.map(campo => '"' + String(campo).replace(/"/g, '""') + '"').join(','));
  });

  const contenidoCSV = '\uFEFF' + lineas.join('\r\n');
  const resultado = await descargarArchivo(contenidoCSV, nombreArchivo, {
    titulo: 'Guardar Reporte CSV de Auditoría',
    mimeType: 'text/csv;charset=utf-8;',
    filtros: [{ name: 'Archivo CSV (Excel)', extensions: ['csv'] }]
  });

  if (resultado.guardado) {
    mostrarToast('Reporte CSV guardado con éxito (' + registros.length + ' registros).');
  }
}

async function exportarAuditoriaExcel() {
  const registros = obtenerRegistrosAuditoriaFiltrados();
  if (registros.length === 0) {
    mostrarToast('No hay registros para exportar con los filtros actuales.');
    return;
  }

  const esTransferencias = tabActualAuditoria === 'transferencias';
  const tipoReporte = esTransferencias ? 'Historial de Transferencias Departamentales' : 'Historial Documental y Observaciones';
  const ahora = obtenerFechaYHora();
  const nombreArchivo = 'Reporte_CONAGUA_' + tabActualAuditoria + '_' + ahora.iso + '.xls';
  const colSpanHeader = esTransferencias ? 8 : 7;

  let filasHtml = '';
  registros.forEach(r => {
    if (esTransferencias) {
      let mov = '<b>' + r.origen + '</b> &rarr; <b>' + r.destino + '</b>';
      filasHtml += '<tr>' +
        '<td style="border:1px solid #dcdcdc; padding:6px 10px;">' + r.fecha + '</td>' +
        '<td style="border:1px solid #dcdcdc; padding:6px 10px;">' + (r.usuario || 'Admin Local') + '</td>' +
        '<td style="border:1px solid #dcdcdc; padding:6px 10px; font-family:monospace;">' + r.idSys + '</td>' +
        '<td style="border:1px solid #dcdcdc; padding:6px 10px; font-weight:bold; color:#0b57d0;">' + r.tituloReal + '</td>' +
        '<td style="border:1px solid #dcdcdc; padding:6px 10px;">' + r.expId + '</td>' +
        '<td style="border:1px solid #dcdcdc; padding:6px 10px;">' + mov + '</td>' +
        '<td style="border:1px solid #dcdcdc; padding:6px 10px; font-weight:bold;">' + (r.destino || '') + '</td>' +
        '<td style="border:1px solid #dcdcdc; padding:6px 10px; color:#444;">' + (r.nota || '') + '</td>' +
      '</tr>';
    } else {
      const prefijo = r.tipo === 'observacion' ? '<b>[Obs]</b> ' : (r.tipo === 'titular' ? '<b>[Titular]</b> ' : '<b>[Doc]</b> ');
      let detalle = prefijo + '<span style="color:#777; text-decoration:line-through;">' + r.previo + '</span> &rarr; <b>' + r.actual + '</b>';
      filasHtml += '<tr>' +
        '<td style="border:1px solid #dcdcdc; padding:6px 10px;">' + r.fecha + '</td>' +
        '<td style="border:1px solid #dcdcdc; padding:6px 10px;">' + (r.usuario || 'Admin Local') + '</td>' +
        '<td style="border:1px solid #dcdcdc; padding:6px 10px; font-family:monospace;">' + r.idSys + '</td>' +
        '<td style="border:1px solid #dcdcdc; padding:6px 10px; font-weight:bold; color:#0b57d0;">' + r.tituloReal + '</td>' +
        '<td style="border:1px solid #dcdcdc; padding:6px 10px;">' + r.expId + '</td>' +
        '<td style="border:1px solid #dcdcdc; padding:6px 10px;">' + detalle + '</td>' +
        '<td style="border:1px solid #dcdcdc; padding:6px 10px; color:#444;">' + (r.nota || '') + '</td>' +
      '</tr>';
    }
  });

  let theadHtml = esTransferencias
    ? '<th style="border:1px solid #003c99; padding:8px 10px;">Origen -&gt; Destino</th><th style="border:1px solid #003c99; padding:8px 10px;">Área</th>'
    : '<th style="border:1px solid #003c99; padding:8px 10px;">Detalle del Registro</th>';

  const templateExcel = '<' + 'html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    '<' + 'head><' + 'meta charset="utf-8">' + '<' + '/head>' +
    '<' + 'body>' +
    '<table>' +
      '<tr><td colspan="' + colSpanHeader + '" style="font-size:16pt; font-weight:bold; color:#004d40;">COMISIÓN NACIONAL DEL AGUA (CONAGUA)</td></tr>' +
      '<tr><td colspan="' + colSpanHeader + '" style="font-size:11pt; color:#555;">Reporte de Auditoría: ' + tipoReporte + '</td></tr>' +
      '<tr><td colspan="' + colSpanHeader + '" style="font-size:10pt; color:#777;">Generado el: ' + ahora.formatted + ' | Por: Administrador Local</td></tr>' +
      '<tr><td colspan="' + colSpanHeader + '"></td></tr>' +
      '<thead>' +
        '<tr style="background:#0b57d0; color:#fff; font-weight:bold;">' +
          '<th style="border:1px solid #003c99; padding:8px 10px;">Fecha / Hora</th>' +
          '<th style="border:1px solid #003c99; padding:8px 10px;">Usuario</th>' +
          '<th style="border:1px solid #003c99; padding:8px 10px;">ID Sistema</th>' +
          '<th style="border:1px solid #003c99; padding:8px 10px;">Título (Clave Principal)</th>' +
          '<th style="border:1px solid #003c99; padding:8px 10px;">No. Expediente</th>' +
          theadHtml +
          '<th style="border:1px solid #003c99; padding:8px 10px;">Justificación</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' + filasHtml + '</tbody>' +
    '</table>' +
    '<' + '/body>' + '<' + '/html>';

  const resultado = await descargarArchivo('\uFEFF' + templateExcel, nombreArchivo, {
    titulo: 'Guardar Reporte Excel de Auditoría',
    mimeType: 'application/vnd.ms-excel;charset=utf-8',
    filtros: [{ name: 'Libro de Excel', extensions: ['xls'] }]
  });

  if (resultado.guardado) {
    mostrarToast('Reporte Excel guardado con éxito (' + registros.length + ' registros).');
  }
}

function exportarAuditoriaPDF() {
  const registros = obtenerRegistrosAuditoriaFiltrados();
  if (registros.length === 0) {
    mostrarToast('No hay registros para exportar con los filtros actuales.');
    return;
  }

  const esTransferencias = tabActualAuditoria === 'transferencias';
  const tipoReporte = esTransferencias ? 'Historial de Transferencias Departamentales' : 'Historial Documental y Observaciones';
  const ahora = obtenerFechaYHora();

  let filasHtml = '';
  registros.forEach((r, idx) => {
    let bg = idx % 2 === 0 ? '#ffffff' : '#f9fbfd';
    if (esTransferencias) {
      let mov = '<b>' + r.origen + '</b> &rarr; <b>' + r.destino + '</b>';
      filasHtml += '<tr style="background-color: ' + bg + ';">' +
        '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-size: 11px;">' + r.fecha + '</td>' +
        '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-size: 11px;">' + (r.usuario || 'Admin') + '</td>' +
        '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-family: monospace; font-size: 11px;">' + r.idSys + '</td>' +
        '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-weight: bold; font-size: 11px; color: #0b57d0;">' + r.tituloReal + '</td>' +
        '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-size: 11px;">' + r.expId + '</td>' +
        '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-size: 11px;">' + mov + '</td>' +
        '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-weight: bold; font-size: 11px;">' + (r.destino || '') + '</td>' +
        '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-size: 11px; color: #555;">' + (r.nota || '-') + '</td>' +
      '</tr>';
    } else {
      const prefijo = r.tipo === 'observacion' ? '<b>[Obs]</b> ' : (r.tipo === 'titular' ? '<b>[Titular]</b> ' : '<b>[Doc]</b> ');
      let detalle = prefijo + '<span style="text-decoration:line-through; opacity:0.6;">' + r.previo + '</span> &rarr; <b>' + r.actual + '</b>';
      filasHtml += '<tr style="background-color: ' + bg + ';">' +
        '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-size: 11px;">' + r.fecha + '</td>' +
        '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-size: 11px;">' + (r.usuario || 'Admin') + '</td>' +
        '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-family: monospace; font-size: 11px;">' + r.idSys + '</td>' +
        '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-weight: bold; font-size: 11px; color: #0b57d0;">' + r.tituloReal + '</td>' +
        '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-size: 11px;">' + r.expId + '</td>' +
        '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-size: 11px;">' + detalle + '</td>' +
        '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-size: 11px; color: #555;">' + (r.nota || '-') + '</td>' +
      '</tr>';
    }
  });

  let iframe = document.getElementById('printFrame');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'printFrame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
  }

  let colsPdfHtml = esTransferencias
    ? '<th style="width: 17%;">Origen &rarr; Destino</th><th style="width: 10%;">Área</th>'
    : '<th style="width: 24%;">Detalle de Operación</th>';

  const plantillaReporte = '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
      '<meta charset="UTF-8">' +
      '<title>Reporte CONAGUA - ' + tipoReporte + '</title>' +
      '<style>' +
        '@page { size: letter landscape; margin: 12mm 15mm; }' +
        'body { font-family: Arial, sans-serif; color: #222; margin: 0; padding: 12px; }' +
        '.header-table { width: 100%; border-bottom: 2px solid #0b57d0; padding-bottom: 8px; margin-bottom: 12px; }' +
        '.title { font-size: 16px; font-weight: bold; color: #0b57d0; text-transform: uppercase; margin: 0; }' +
        '.sub { font-size: 12px; color: #555; margin: 2px 0 0 0; }' +
        '.meta-info { font-size: 10px; color: #666; text-align: right; }' +
        'table.data { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }' +
        'table.data th { background-color: #0b57d0; color: #ffffff; padding: 7px 8px; font-weight: 500; text-align: left; border: 1px solid #0b57d0; }' +
        '.footer { margin-top: 20px; font-size: 9px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 6px; }' +
      '</style>' +
    '</head>' +
    '<body>' +
      '<table class="header-table">' +
        '<tr>' +
          '<td>' +
            '<div class="title">COMISIÓN NACIONAL DEL AGUA (CONAGUA)</div>' +
            '<div class="sub">Sistema Local de Seguimiento y Trazabilidad Documental | ' + tipoReporte + '</div>' +
          '</td>' +
          '<td class="meta-info">' +
            '<b>Fecha de Emisión:</b> ' + ahora.formatted + '<br>' +
            '<b>Registros:</b> ' + registros.length + '<br>' +
            '<b>Usuario:</b> Administrador Local' +
          '</td>' +
        '</tr>' +
      '</table>' +
      '<table class="data">' +
        '<thead>' +
          '<tr>' +
            '<th style="width: 13%;">Fecha / Hora</th>' +
            '<th style="width: 9%;">Usuario</th>' +
            '<th style="width: 10%;">ID Sistema</th>' +
            '<th style="width: 14%;">Título (Clave)</th>' +
            '<th style="width: 12%;">No. Expediente</th>' +
            colsPdfHtml +
            '<th style="width: 15%;">Justificación</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + filasHtml + '</tbody>' +
      '</table>' +
      '<div class="footer">Documento generado automáticamente para fines de control y auditoría interna de expedientes. CONAGUA 2026.</div>' +
    '</body>' +
    '</html>';

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(plantillaReporte);
  doc.close();

  mostrarToast('Selecciona "Guardar como PDF" para elegir dónde guardarlo...');
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 300);
}

// ==========================================================================
// MOTOR DE RESPALDOS MANUALES, CARPETA EN DISCO Y ROTACIÓN INTERNA
// ==========================================================================
function construirPaqueteRespaldo() {
  const ahora = obtenerFechaYHora();
  return {
    sistema: 'CONAGUA - Gestor Local de Expedientes',
    versionApp: '1.0.0',
    fechaEmision: ahora.formatted,
    iso: ahora.iso,
    totalExpedientes: expedientes.length,
    datos: expedientes
  };
}

async function crearRespaldoDescargable() {
  const paqueteRespaldo = construirPaqueteRespaldo();
  const jsonString = JSON.stringify(paqueteRespaldo, null, 2);
  const nombreArchivo = `Respaldo_CONAGUA_${paqueteRespaldo.iso}_${Date.now()}.json`;

  const resultado = await descargarArchivo(jsonString, nombreArchivo, {
    titulo: 'Guardar Copia de Seguridad (JSON)',
    mimeType: 'application/json',
    filtros: [{ name: 'Respaldo JSON CONAGUA', extensions: ['json'] }]
  });

  if (resultado.guardado) {
    mostrarToast('Copia de seguridad guardada con éxito.');
  }
}

async function aplicarContenidoRespaldo(textoJson) {
  try {
    const contenido = JSON.parse(textoJson);
    if (!contenido.datos || !Array.isArray(contenido.datos)) {
      throw new Error('Estructura de archivo incompatible.');
    }

    const confirmado = await confirmarAccionUsuario(
      `¿Deseas restaurar este respaldo con ${contenido.datos.length} expedientes?\n\nLos datos actuales serán reemplazados.`,
      'Confirmar restauración de respaldo'
    );

    if (!confirmado) {
      mostrarToast('Restauración cancelada. No se modificó ningún dato.');
      return;
    }

    await ejecutarAutoSnapshot('Punto previo a restauración', false);
    expedientes = contenido.datos;
    StorageManager.guardar(expedientes, true);
    actualizarDatalistsGlobales();
    mostrarToast('Base de datos restaurada con éxito.');
    cerrarModalAjustes();
    render();
  } catch (err) {
    alert('Error al leer el archivo de respaldo: ' + err.message);
  }
}

async function abrirSelectorRestaurarRespaldo() {
  const tauriDialog = window.__TAURI__ && window.__TAURI__.dialog;
  const tauriFs = window.__TAURI__ && window.__TAURI__.fs;

  if (tauriDialog && tauriFs && typeof tauriDialog.open === 'function' && typeof tauriFs.readTextFile === 'function') {
    try {
      const rutaArchivo = await tauriDialog.open({
        title: 'Seleccionar archivo de respaldo (.JSON)',
        multiple: false,
        directory: false,
        filters: [{ name: 'Respaldo JSON CONAGUA', extensions: ['json'] }]
      });

      if (!rutaArchivo) return;
      const rutaStr = Array.isArray(rutaArchivo) ? rutaArchivo[0] : (rutaArchivo.path || rutaArchivo);
      const texto = await tauriFs.readTextFile(rutaStr);
      await aplicarContenidoRespaldo(texto);
      return;
    } catch (err) {
      console.error('Error al abrir respaldo vía Tauri:', err);
      mostrarToast('No se pudo abrir el archivo: ' + (err.message || err));
      return;
    }
  }

  const inputEl = document.getElementById('inputImportarRespaldo');
  if (inputEl) inputEl.click();
}

function restaurarRespaldoDesdeArchivo(event) {
  const archivo = event.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = async function (e) {
    await aplicarContenidoRespaldo(e.target.result);
  };
  lector.readAsText(archivo);
  event.target.value = '';
}

async function guardarRespaldoEnCarpetaFisica(motivo = 'Automático', notificarUsuario = false) {
  const carpetaDestino = localStorage.getItem(BACKUP_DIR_KEY);
  if (!carpetaDestino) return false;

  const tauriFs = window.__TAURI__ && window.__TAURI__.fs;
  if (!tauriFs || typeof tauriFs.writeTextFile !== 'function') {
    if (notificarUsuario) {
      mostrarToast('El plugin de escritura en disco no está activo en esta ventana.');
    }
    return false;
  }

  try {
    const ahora = obtenerFechaYHora();
    const separador = carpetaDestino.includes('\\') ? '\\' : '/';
    const carpetaLimpia = carpetaDestino.replace(/[\\/]+$/, '');
    const nombreAuto = `AutoRespaldo_CONAGUA_${ahora.iso}_${Date.now()}.json`;
    const rutaCompleta = `${carpetaLimpia}${separador}${nombreAuto}`;

    const paquete = construirPaqueteRespaldo();
    paquete.motivoAutomatico = motivo;

    await tauriFs.writeTextFile(rutaCompleta, JSON.stringify(paquete, null, 2));

    if (notificarUsuario) {
      mostrarToast(`Respaldo guardado en carpeta: ${nombreAuto}`);
    }
    return true;
  } catch (e) {
    console.error('Error al escribir auto-respaldo en carpeta:', e);
    if (notificarUsuario) {
      alert('No se pudo escribir en la carpeta seleccionada:\n' + (e.message || e));
    }
    return false;
  }
}

function programarAutoRespaldoDisco(motivo = 'Actualización automática') {
  const carpetaDestino = localStorage.getItem(BACKUP_DIR_KEY);
  if (!carpetaDestino) return;

  if (timerDebounceBackup) {
    clearTimeout(timerDebounceBackup);
  }

  timerDebounceBackup = setTimeout(() => {
    guardarRespaldoEnCarpetaFisica(motivo, false);
  }, 2000);
}

async function seleccionarCarpetaAutoRespaldo() {
  const tauriDialog = window.__TAURI__ && window.__TAURI__.dialog;
  if (!tauriDialog || typeof tauriDialog.open !== 'function') {
    mostrarToast('El selector de carpetas requiere ejecutar la aplicación de escritorio.');
    return;
  }

  try {
    const seleccion = await tauriDialog.open({
      title: 'Seleccionar carpeta para respaldos automáticos',
      directory: true,
      multiple: false
    });

    if (!seleccion) return;

    const rutaCarpeta = Array.isArray(seleccion)
      ? seleccion[0]
      : (typeof seleccion === 'object' && seleccion.path ? seleccion.path : seleccion);

    localStorage.setItem(BACKUP_DIR_KEY, rutaCarpeta);
    actualizarVistaCarpetaBackup();

    // Genera respaldo inicial al vincular el directorio
    await guardarRespaldoEnCarpetaFisica('Respaldo inicial al vincular carpeta', true);
  } catch (err) {
    console.error('Error al seleccionar carpeta:', err);
    mostrarToast('Error al seleccionar carpeta: ' + (err.message || err));
  }
}

function limpiarCarpetaAutoRespaldo() {
  localStorage.removeItem(BACKUP_DIR_KEY);
  actualizarVistaCarpetaBackup();
  mostrarToast('Carpeta externa desvinculada.');
}

function actualizarVistaCarpetaBackup() {
  const textoEl = document.getElementById('rutaCarpetaBackupTexto');
  const btnQuitar = document.getElementById('btnLimpiarCarpetaBackup');
  const ruta = localStorage.getItem(BACKUP_DIR_KEY);

  if (textoEl) {
    textoEl.innerText = ruta ? ruta : 'No configurada (solo memoria interna rotativa)';
  }
  if (btnQuitar) {
    btnQuitar.style.display = ruta ? 'inline-flex' : 'none';
  }
}

function obtenerSnapshots() {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

async function ejecutarAutoSnapshot(motivo = 'Automático programado', escribirEnDisco = true) {
  if (!expedientes || expedientes.length === 0) return;

  let snapshots = obtenerSnapshots();
  const ahora = obtenerFechaYHora();

  const nuevaSnapshot = {
    id: 'SNAP-' + Date.now(),
    motivo: motivo,
    fecha: ahora.formatted,
    total: expedientes.length,
    datos: expedientes
  };

  snapshots.unshift(nuevaSnapshot);
  if (snapshots.length > MAX_SNAPSHOTS) {
    snapshots = snapshots.slice(0, MAX_SNAPSHOTS);
  }

  try {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
  } catch (e) {
    console.warn('No se pudo guardar la instantánea automática:', e);
  }

  if (escribirEnDisco) {
    await guardarRespaldoEnCarpetaFisica(motivo, false);
  }
}

async function restaurarSnapshot(snapId) {
  const snapshots = obtenerSnapshots();
  const objetivo = snapshots.find(s => s.id === snapId);
  if (!objetivo) return;

  const confirmado = await confirmarAccionUsuario(
    `¿Restaurar la instantánea del ${objetivo.fecha} (${objetivo.total} expedientes)?\n\nLos datos actuales serán reemplazados.`,
    'Confirmar restauración de instantánea'
  );

  if (!confirmado) {
    mostrarToast('Restauración cancelada.');
    return;
  }

  expedientes = objetivo.datos;
  StorageManager.guardar(expedientes, true);
  actualizarDatalistsGlobales();
  mostrarToast('Instantánea restaurada con éxito.');
  cerrarModalAjustes();
  render();
}

function abrirModalAjustes() {
  const container = document.getElementById('listaSnapshotsAuto');
  const modal = document.getElementById('modalAjustesOverlay');
  if (!modal) return;

  actualizarVistaCarpetaBackup();

  if (container) {
    const snapshots = obtenerSnapshots();
    if (snapshots.length === 0) {
      container.innerHTML = '<span style="font-size:12px; color:var(--md-sys-color-on-surface-variant); font-style:italic;">No hay instantáneas automáticas generadas aún.</span>';
    } else {
      container.innerHTML = '';
      snapshots.forEach(s => {
        container.innerHTML += `
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--card-bg); padding:10px 14px; border-radius:10px; border:1px solid var(--md-sys-color-outline-variant);">
            <div>
              <div style="font-weight:600; font-size:13px;">${s.motivo}</div>
              <div style="font-size:11px; color:var(--md-sys-color-on-surface-variant);">${s.fecha} | ${s.total} expedientes</div>
            </div>
            <button class="btn-card-outline" onclick="restaurarSnapshot('${s.id}')">Restaurar</button>
          </div>`;
      });
    }
  }

  modal.style.display = 'flex';
}

function cerrarModalAjustes() {
  const modal = document.getElementById('modalAjustesOverlay');
  if (modal) modal.style.display = 'none';
}

// Ejecución periódica de respaldo automático (intervalo: 60 min)
setInterval(() => {
  ejecutarAutoSnapshot('Copia automática periódica (1 hr)', true);
}, 60 * 60 * 1000);

// --- RENDERIZADO REACTIVO DEL TABLERO Y BARRA LATERAL ---
function render() {
  let queryInv = (document.getElementById('searchBox') ? document.getElementById('searchBox').value : '').toLowerCase();
  let sidebarAreaFilter = document.getElementById('sidebarAreaFilter') ? document.getElementById('sidebarAreaFilter').value : 'todas';

  let queryModal = (document.getElementById('modalSearchBox') ? document.getElementById('modalSearchBox').value : '').toLowerCase();
  let modalAreaFilter = document.getElementById('modalAreaFilter') ? document.getElementById('modalAreaFilter').value : 'todas';
  let modalDateFrom = document.getElementById('modalDateFrom') ? document.getElementById('modalDateFrom').value : '';
  let modalDateTo = document.getElementById('modalDateTo') ? document.getElementById('modalDateTo').value : '';
  let modalSortOrder = document.getElementById('modalSortOrder') ? document.getElementById('modalSortOrder').value : 'desc';

  let fInvSys = (document.getElementById('inv-f-sys') ? document.getElementById('inv-f-sys').value : '').toLowerCase();
  let fInvTitulo = (document.getElementById('inv-f-titulo') ? document.getElementById('inv-f-titulo').value : '').toLowerCase();
  let fInvExp = (document.getElementById('inv-f-exp') ? document.getElementById('inv-f-exp').value : '').toLowerCase();
  let fInvTitular = (document.getElementById('inv-f-titular') ? document.getElementById('inv-f-titular').value : '').toLowerCase();
  let fInvObs = (document.getElementById('inv-f-obs') ? document.getElementById('inv-f-obs').value : '').toLowerCase();
  let fInvArea = (document.getElementById('inv-f-area') ? document.getElementById('inv-f-area').value : '').toLowerCase();
  let fInvFecha = (document.getElementById('inv-f-fecha') ? document.getElementById('inv-f-fecha').value : '').toLowerCase();

  let hayFiltrosInv = queryModal || modalAreaFilter !== 'todas' || modalDateFrom || modalDateTo || fInvSys || fInvTitulo || fInvExp || fInvTitular || fInvArea || fInvFecha || fInvObs;
  const btnLimpiarInv = document.getElementById('btnLimpiarFiltrosInv');
  if (btnLimpiarInv) btnLimpiarInv.style.display = hayFiltrosInv ? 'inline-flex' : 'none';

  let queryBoard = (document.getElementById('boardSearchBox') ? document.getElementById('boardSearchBox').value : '').toLowerCase();
  let boardAreaFilter = document.getElementById('boardAreaFilter') ? document.getElementById('boardAreaFilter').value : 'todas';
  let boardDateFilter = document.getElementById('boardDateFilter') ? document.getElementById('boardDateFilter').value : '';

  // 1. Sidebar: Lista de Inventario
  const invList = document.getElementById('inventory-list');
  if (invList) {
    invList.innerHTML = '';
    let expInvFiltrados = expedientes.filter(exp =>
      (exp.titulo.toLowerCase().includes(queryInv) ||
        exp.id.toLowerCase().includes(queryInv) ||
        exp.idSys.toLowerCase().includes(queryInv) ||
        (exp.observacion || '').toLowerCase().includes(queryInv)) &&
      (sidebarAreaFilter === 'todas' || exp.area === sidebarAreaFilter)
    );
    const sidebarTitleEl = document.getElementById('sidebarTitle');
    if (sidebarTitleEl) sidebarTitleEl.innerText = `Archivo Físico (${expInvFiltrados.length})`;

    expInvFiltrados.forEach(exp => {
      const invItem = document.createElement('div');
      invItem.className = 'expediente-item';
      let obsHtml = exp.observacion ? `<div class="inv-obs">${exp.observacion}</div>` : '';
      invItem.innerHTML = `<div class="inv-header"><span style="font-size:16px;">${exp.titulo}</span><div style="display:flex; justify-content:space-between; width:100%; align-items:center; margin-top:4px;"><span class="sys-id-tag">ID: ${exp.idSys}</span><span class="${getBadgeClass(exp.area)}">${exp.area}</span></div></div><div class="inv-body"><strong>Exp:</strong> ${exp.id}<br><strong>Titular:</strong> ${exp.titular}</div>${obsHtml}<div class="inv-actions"><button class="btn-card-outline" onclick="abrirDetalles('${exp.id}')">Historial</button><button class="btn-card-tonal" onclick="modificarExpediente('${exp.id}')">Editar</button><button class="btn-card-filled" onclick="moverExpediente('${exp.id}')">Mover</button></div>`;
      invList.appendChild(invItem);
    });
  }

  // 2. Modal: Tabla Completa de Expedientes
  const modalTableBody = document.getElementById('modal-table-body');
  if (modalTableBody) {
    modalTableBody.innerHTML = '';
    let modalFiltrados = expedientes.filter(exp => {
      let matchesText =
        exp.titulo.toLowerCase().includes(queryModal) ||
        exp.id.toLowerCase().includes(queryModal) ||
        exp.idSys.toLowerCase().includes(queryModal) ||
        exp.titular.toLowerCase().includes(queryModal) ||
        (exp.observacion || '').toLowerCase().includes(queryModal);
      let matchesArea = modalAreaFilter === 'todas' || exp.area === modalAreaFilter;
      let expDateISO = exp.fechaRegistro.split('/').reverse().join('-');
      let matchesFrom = !modalDateFrom || expDateISO >= modalDateFrom;
      let matchesTo = !modalDateTo || expDateISO <= modalDateTo;
      let mSys = !fInvSys || exp.idSys.toLowerCase().includes(fInvSys);
      let mTit = !fInvTitulo || exp.titulo.toLowerCase().includes(fInvTitulo);
      let mExp = !fInvExp || exp.id.toLowerCase().includes(fInvExp);
      let mTitular = !fInvTitular || exp.titular.toLowerCase().includes(fInvTitular);
      let mObs = !fInvObs || (exp.observacion || '').toLowerCase().includes(fInvObs);
      let mAreaCol = !fInvArea || exp.area.toLowerCase() === fInvArea;
      let mFecha = !fInvFecha || exp.fechaRegistro.toLowerCase().includes(fInvFecha);
      return matchesText && matchesArea && matchesFrom && matchesTo && mSys && mTit && mExp && mTitular && mObs && mAreaCol && mFecha;
    });

    modalFiltrados.sort((a, b) => modalSortOrder === 'desc' ? b.tsRegistro - a.tsRegistro : a.tsRegistro - b.tsRegistro);

    if (modalFiltrados.length === 0) {
      modalTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px; color:var(--md-sys-color-on-surface-variant);">Sin coincidencias con los filtros aplicados.</td></tr>';
    } else {
      modalFiltrados.forEach(exp => {
        modalTableBody.innerHTML += `<tr><td><span class="sys-id-tag">${exp.idSys}</span></td><td style="font-weight:700; color:var(--md-sys-color-primary);">${exp.titulo}</td><td style="font-weight:500;">${exp.id}</td><td>${exp.titular}</td><td style="color:var(--md-sys-color-on-surface-variant); font-style:italic;">${exp.observacion || ''}</td><td><span class="${getBadgeClass(exp.area)}">${exp.area}</span></td><td>${exp.fechaRegistro}</td><td><div class="compact-actions"><button class="btn-card-outline" onclick="abrirDetalles('${exp.id}')">Bitácora</button><button class="btn-card-tonal" onclick="modificarExpediente('${exp.id}')">Modificar</button><button class="btn-card-filled" onclick="moverExpediente('${exp.id}')">Mover</button></div></td></tr>`;
      });
    }
  }

  // 3. Actividad Global (Sidebar)
  const logsContainer = document.getElementById('logs-list');
  if (logsContainer) {
    logsContainer.innerHTML = '';
    logs.slice(0, 5).forEach(l => {
      logsContainer.innerHTML += `<div class="log-entry"><span class="log-time">${l.time}</span><span class="log-action">${l.action}</span><span class="log-note">${l.note}</span></div>`;
    });
  }

  // 4. Tablero Kanban / Línea de Tiempo
  let expTablero = expedientes
    .filter(exp =>
      exp.enTablero &&
      (exp.titulo.toLowerCase().includes(queryBoard) ||
        exp.id.toLowerCase().includes(queryBoard) ||
        exp.idSys.toLowerCase().includes(queryBoard) ||
        (exp.observacion || '').toLowerCase().includes(queryBoard)) &&
      (!boardDateFilter || exp.dateISO === boardDateFilter) &&
      (boardAreaFilter === 'todas' || exp.area === boardAreaFilter)
    )
    .sort((a, b) => b.lastModified - a.lastModified);

  const boardHeaderTitleEl = document.getElementById('boardHeaderTitle');
  if (boardHeaderTitleEl) boardHeaderTitleEl.innerText = `Tablero de Circulación Activa (${expTablero.length})`;

  if (vistaActualTablero === 'kanban') {
    const kanbanCont = document.getElementById('kanbanColumnsContainer');
    if (kanbanCont) {
      kanbanCont.innerHTML = '';

      let columnAreas = [
        { code: 'CIS', title: 'CIS', cls: 'col-cis' },
        { code: 'ATENCION', title: 'Atención a Usuarios', cls: 'col-ate' },
        { code: 'DICTAMINACION', title: 'Dictaminación', cls: 'col-dic' },
        { code: 'SUBDIRECTOR', title: 'Subdirección S.A.A.', cls: 'col-saa' },
        { code: 'INFRACCIONES', title: 'Infracciones', cls: 'col-inf' },
        { code: 'INSPECCION', title: 'Inspección', cls: 'col-ins' },
        { code: 'TECNICA', title: 'Técnica', cls: 'col-tec' },
        { code: 'JURIDICO', title: 'Jurídico', cls: 'col-jur' },
        { code: 'DIRECCION', title: 'Dirección', cls: 'col-dir' }
      ];

      columnAreas.forEach(c => {
        if (boardAreaFilter !== 'todas' && boardAreaFilter !== c.code) return;
        let cnt = expTablero.filter(e => e.area === c.code).length;
        if (queryBoard.trim() !== '' && cnt === 0) return;

        let colDiv = document.createElement('div');
        colDiv.className = 'kanban-col ' + c.cls;
        colDiv.setAttribute('data-area', c.code);
        colDiv.innerHTML = `<h3><span>${c.title}</span> <span style="font-size:12px;background:var(--card-bg);padding:2px 8px;border-radius:10px;">${cnt}</span></h3><div class="col-content" id="col-${c.code.toLowerCase()}"></div>`;
        kanbanCont.appendChild(colDiv);
      });

      expTablero.forEach(exp => {
        let el = document.getElementById('col-' + exp.area.toLowerCase());
        let obsHtml = exp.observacion ? `<div class="k-obs" title="${exp.observacion}">[Obs] ${exp.observacion}</div>` : '';
        if (el) {
          let card = document.createElement('div');
          card.className = 'k-card ' + getCardColorClass(exp.area);
          card.title = 'Doble clic para ver detalles / Arrastrar para mover';
          card.innerHTML = `<span class="k-titulo-main">${exp.titulo}</span><div class="k-meta-row"><span class="sys-id-tag" style="width:fit-content;">${exp.idSys}</span><span class="k-id">Exp: ${exp.id}</span></div><div class="k-info"><strong>Titular:</strong> ${exp.titular}</div>${obsHtml}<div class="k-time">Ingreso: ${exp.tiempo}</div><div class="k-footer"><button class="btn-card-outline" onclick="abrirDetalles('${exp.id}')">Detalles</button><button class="btn-card-tonal" onclick="modificarExpediente('${exp.id}')">Editar</button><button class="btn-card-filled" onclick="moverExpediente('${exp.id}')">Mover</button></div>`;

          card.addEventListener('mousedown', (e) => initDrag(e, exp.id, card));
          card.addEventListener('dblclick', () => abrirDetalles(exp.id));
          el.appendChild(card);
        }
      });
    }
  } else {
    const tCont = document.getElementById('timelineListContainer');
    if (tCont) {
      tCont.innerHTML = '';
      if (expTablero.length === 0) {
        tCont.innerHTML = '<div style="text-align:center; padding:40px;">No se encontraron expedientes en tablero.</div>';
      } else {
        expTablero.forEach(exp => {
          let pts = exp.tiempo.split(' ');
          let obsHtml = exp.observacion ? `<div style="font-size:13px; margin-top:8px; font-style:italic; opacity:0.8;">[Obs] ${exp.observacion}</div>` : '';
          tCont.innerHTML += `<div class="timeline-item"><div class="timeline-badge-col"><div class="timeline-date-box">${pts[0] || ''}<br>${pts[1] || ''} ${pts[2] || ''}</div><span class="${getBadgeClass(exp.area)}" style="margin-top:12px;">${exp.area}</span></div><div class="timeline-content-card ${getCardColorClass(exp.area)}"><div><span class="k-titulo-main" style="margin:0; font-size:20px;">${exp.titulo}</span><div style="display:flex; gap:8px; align-items:center; margin-top:8px;"><span class="sys-id-tag">SYS: ${exp.idSys}</span><span style="font-size:13px; font-weight:500; opacity:0.8;">Exp: ${exp.id}</span></div></div><div class="k-info" style="font-size:15px; margin-top:16px;"><strong>Titular:</strong> ${exp.titular}</div>${obsHtml}<div class="timeline-actions-row" style="display:flex; gap:8px; margin-top:20px; border-top:1px solid rgba(0,0,0,0.1); padding-top:16px;"><button class="btn-card-outline" onclick="abrirDetalles('${exp.id}')">Ver Historial</button><button class="btn-card-tonal" onclick="modificarExpediente('${exp.id}')">Editar Datos</button><button class="btn-card-filled" onclick="moverExpediente('${exp.id}')">Mover de Área</button></div></div></div>`;
        });
      }
    }
  }
}

// --- EXPOSICIÓN GLOBAL A WINDOW PARA LOS EVENTOS DEL HTML ---
window.abrirModalInventario = abrirModalInventario;
window.cerrarModalInventario = cerrarModalInventario;
window.abrirModalAuditoriaGlobal = abrirModalAuditoriaGlobal;
window.cerrarModalAuditoriaGlobal = cerrarModalAuditoriaGlobal;
window.abrirModalCrearExpediente = abrirModalCrearExpediente;
window.abrirActionModal = abrirActionModal;
window.cerrarActionModal = cerrarActionModal;
window.ejecutarAccionPopup = ejecutarAccionPopup;
window.abrirDetalles = abrirDetalles;
window.cerrarDetallesModal = cerrarDetallesModal;
window.moverExpediente = moverExpediente;
window.modificarExpediente = modificarExpediente;
window.toggleCompactMode = toggleCompactMode;
window.cambiarVista = cambiarVista;
window.cambiarTabAuditoria = cambiarTabAuditoria;
window.limpiarFiltrosAuditoria = limpiarFiltrosAuditoria;
window.limpiarFiltrosInventario = limpiarFiltrosInventario;
window.exportarAuditoriaCSV = exportarAuditoriaCSV;
window.exportarAuditoriaExcel = exportarAuditoriaExcel;
window.exportarAuditoriaPDF = exportarAuditoriaPDF;
window.abrirModalAjustes = abrirModalAjustes;
window.cerrarModalAjustes = cerrarModalAjustes;
window.crearRespaldoDescargable = crearRespaldoDescargable;
window.abrirSelectorRestaurarRespaldo = abrirSelectorRestaurarRespaldo;
window.restaurarRespaldoDesdeArchivo = restaurarRespaldoDesdeArchivo;
window.seleccionarCarpetaAutoRespaldo = seleccionarCarpetaAutoRespaldo;
window.limpiarCarpetaAutoRespaldo = limpiarCarpetaAutoRespaldo;
window.restaurarSnapshot = restaurarSnapshot;
window.render = render;
window.renderAuditoria = renderAuditoria;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  inicializarControlesFiltro();
  render();
});