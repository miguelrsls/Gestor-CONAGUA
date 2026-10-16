// ==========================================================================
// CONAGUA - GESTOR LOCAL DE EXPEDIENTES (PRODUCCIÓN DE PRUEBA)
// Motor de Persistencia Local y Lógica de Tablero
// ==========================================================================

const STORAGE_KEY = 'CONAGUA_EXPEDIENTES_DATA_V1';
const DB_NAME = 'sqlite:conagua_local.db';

// --- GESTOR DE ALMACENAMIENTO PERSISTENTE ---
const StorageManager = {
  datosSemilla: [], // Sistema en blanco para producción

  cargar() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn("Aviso al leer almacenamiento local:", e);
    }
    this.guardar(this.datosSemilla);
    return this.datosSemilla;
  },

  guardar(listaExpedientes) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(listaExpedientes));
    } catch (e) {
      console.error("Error al persistir expedientes en disco:", e);
    }
  }
};

// --- ESTADO GLOBAL ---
let expedientes = StorageManager.cargar();
let logs = [];
let vistaActualTablero = 'kanban';
let tabActualAuditoria = 'documental';
let isCompactView = false;

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
    anio = p[0]; mes = p[1]; dia = p[2];
    d.setFullYear(anio, mes - 1, dia);
  } else {
    anio = d.getFullYear(); mes = String(d.getMonth() + 1).padStart(2, '0'); dia = String(d.getDate()).padStart(2, '0');
  }
  let horas = d.getHours(); let minutos = String(d.getMinutes()).padStart(2, '0');
  let ampm = horas >= 12 ? 'PM' : 'AM'; horas = horas % 12 || 12; let horasStr = String(horas).padStart(2, '0');
  
  return { 
    formatted: `${dia}/${mes}/${anio} ${horasStr}:${minutos} ${ampm}`, 
    iso: `${anio}-${mes}-${dia}`, 
    dateOnly: `${dia}/${mes}/${anio}`, 
    timestamp: d.getTime() 
  };
}

function registrarLog(accion, nota) {
  let now = obtenerFechaYHora();
  logs.unshift({ time: now.formatted, user: 'Admin Local', action: accion, note: nota || 'Sin nota.' });
}

function toggleCompactMode() {
  isCompactView = !isCompactView;
  const btn = document.getElementById('btnCompactToggle');
  if (btn) {
    btn.classList.toggle('active', isCompactView);
    btn.innerHTML = isCompactView ? 'Vista: Standard' : 'Vista: Ultra Compacta';
  }
  document.getElementById('viewKanban').classList.toggle('is-compact', isCompactView);
  document.getElementById('viewTimeline').classList.toggle('is-compact', isCompactView);
}

function cambiarVista(tipo) {
  vistaActualTablero = tipo;
  document.getElementById('btnKanban').classList.toggle('active', tipo === 'kanban');
  document.getElementById('btnTimeline').classList.toggle('active', tipo === 'timeline');
  document.getElementById('viewKanban').style.display = (tipo === 'kanban') ? 'flex' : 'none';
  document.getElementById('viewTimeline').style.display = (tipo === 'timeline') ? 'flex' : 'none';
  render();
}

function getBadgeClass(area) { 
  return 'badge badge-' + area.replace(/ /g, ''); 
}

function getCardColorClass(area) { 
  const map = { 
    'CIS':'bg-cis', 'DICTAMINACION':'bg-dic', 'SUBDIRECTOR':'bg-saa', 
    'INFRACCIONES':'bg-inf', 'INSPECCION':'bg-ins', 'TECNICA':'bg-tec', 
    'JURIDICO':'bg-jur', 'DIRECCION':'bg-dir', 'ARCHIVO':'bg-arc'
  };
  return map[area] || ''; 
}

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
  if (dragState.hasMoved && !dragRAF) { 
    dragRAF = requestAnimationFrame(updateDragVisuals); 
  }
}

function updateDragVisuals() {
  if (!dragState.isDragging || !dragState.cloneEl) { dragRAF = null; return; }
  let x = currentMouseX - dragState.offsetX;
  let y = currentMouseY - dragState.offsetY;
  dragState.cloneEl.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(3deg)`;
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
      let expObj = expedientes.find(x => x.id === dragState.expId || x.idSys === dragState.expId);
      if (expObj && expObj.area !== newArea) {
        moverExpediente(expObj.id, newArea);
      }
    }
  }
  dragState = { isDragging: false, hasMoved: false, cloneEl: null, sourceEl: null, expId: null, offsetX: 0, offsetY: 0, initMouseX: 0, initMouseY: 0, hoverCol: null };
}

// --- GESTIÓN DE MODALES DE ACCIÓN ---
let accionPendienteCallback = null;

function abrirActionModal(titulo, subtitulo, camposHTML, onConfirmar) {
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

function ejecutarAccionPopup() { 
  if (accionPendienteCallback) {
    accionPendienteCallback();
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
    registrarLog(`Alta (${newSysId})`, `Título: ${titulo} -> ${areaInicial}`); 
    mostrarToast(`Expediente registrado en ${areaInicial}.`); 
    render();
  });
}

function moverExpediente(id, areaDestinoForzada) {
  let exp = expedientes.find(e => e.id === id || e.idSys === id); 
  if (!exp) return;
  
  let diaHoy = obtenerFechaYHora().iso;
  let areasOpciones = ['CIS', 'DICTAMINACION', 'SUBDIRECTOR', 'INFRACCIONES', 'INSPECCION', 'TECNICA', 'JURIDICO', 'DIRECCION', 'ARCHIVO'];
  
  let selectHtml = '<select id="popupSelectDestino" class="control-modern" style="width:100%; height:40px;">';
  areasOpciones.forEach(a => {
    let selected = (areaDestinoForzada && areaDestinoForzada === a) || (!areaDestinoForzada && exp.area === a) ? 'selected' : '';
    selectHtml += `<option value="${a}" ${selected}>${a === 'ARCHIVO' ? 'Archivo General (Retirar del tablero)' : a}</option>`;
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
    </div>
    <div class="action-modal-form-group">
      <label>Observación opcional:</label>
      <input type="text" class="search-box" id="popupInputObs" value="${exp.observacion || ''}" placeholder="Actualizar notas del expediente...">
    </div>
    <div class="action-modal-form-group">
      <label>Justificación del Pase (Bitácora):</label>
      <input type="text" class="search-box" id="popupInputNota" value="Transferencia departamental">
    </div>`;
    
  abrirActionModal('Mover Expediente', `Reubicar documento: ${exp.titulo}`, campos, () => {
    let fSeleccionada = document.getElementById('popupFechaAccion').value;
    let destino = document.getElementById('popupSelectDestino').value; 
    let nObs = document.getElementById('popupInputObs').value.trim();
    let nota = document.getElementById('popupInputNota').value.trim() || 'Sin justificación';
    let ts = obtenerFechaYHora(fSeleccionada); 
    let areaAnterior = exp.area;
    
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
    registrarLog(`Pase (${exp.idSys})`, `${areaAnterior} ➔ ${destino}`); 
    mostrarToast(`Expediente movido a ${destino}.`); 
    render();
  });
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
      <input type="text" class="search-box" value="${exp.idSys}" disabled style="background:var(--md-sys-color-surface-container); font-family: monospace;">
    </div>
    <div class="action-modal-form-group">
      <label>No. de Expediente:</label>
      <input type="text" class="search-box" id="popupInputNoExp" value="${exp.id}">
    </div>
    <div class="action-modal-form-group">
      <label>Título / Clave Principal:</label>
      <input type="text" class="search-box" id="popupInputTitulo" value="${exp.titulo}" style="font-weight:bold;">
    </div>
    <div class="action-modal-form-group">
      <label>Titular:</label>
      <input type="text" class="search-box" id="popupInputTitular" value="${exp.titular}">
    </div>
    <div class="action-modal-form-group">
      <label>Observaciones:</label>
      <input type="text" class="search-box" id="popupInputObs" value="${exp.observacion || ''}">
    </div>
    <div class="action-modal-form-group">
      <label>Justificación para Bitácora:</label>
      <input type="text" class="search-box" id="popupInputNota" placeholder="Ej. Corrección de datos o anexo de trámite">
    </div>`;
  
  abrirActionModal('Modificar Expediente', `Editar metadatos de ${exp.idSys}`, campos, () => {
    let fSeleccionada = document.getElementById('popupFechaAccion').value;
    let nNoExp = document.getElementById('popupInputNoExp').value.trim(); 
    let nTit = document.getElementById('popupInputTitulo').value.trim();
    let nTitular = document.getElementById('popupInputTitular').value.trim(); 
    let nObs = document.getElementById('popupInputObs').value.trim();
    let nota = document.getElementById('popupInputNota').value.trim() || 'Actualización manual';
    let ts = obtenerFechaYHora(fSeleccionada);
    
    if (nTit !== exp.titulo) { 
      exp.historial.unshift({ ts: ts.timestamp, tipo: 'titulo', usuario: 'Admin Local', tituloActual: nTit, previo: exp.titulo, actual: nTit, fecha: ts.formatted, nota: 'TITULO: ' + nota, iso: ts.iso }); 
      exp.titulo = nTit; 
    }
    if (nNoExp !== exp.id) { 
      exp.historial.unshift({ ts: ts.timestamp, tipo: 'titulo', usuario: 'Admin Local', tituloActual: exp.titulo, previo: `Exp: ${exp.id}`, actual: `Exp: ${nNoExp}`, fecha: ts.formatted, nota: 'NO. EXP: ' + nota, iso: ts.iso }); 
      exp.id = nNoExp; 
    }
    if (nTitular !== exp.titular) {
      exp.historial.unshift({ ts: ts.timestamp, tipo: 'titular', usuario: 'Admin Local', tituloActual: exp.titulo, previo: exp.titular || 'Sin Titular', actual: nTitular, fecha: ts.formatted, nota: 'TITULAR: ' + nota, iso: ts.iso });
      exp.titular = nTitular;
    }
    if (exp.observacion !== nObs) { 
      exp.historial.unshift({ ts: ts.timestamp, tipo: 'observacion', usuario: 'Admin Local', tituloActual: exp.titulo, previo: exp.observacion || 'Ninguna', actual: nObs || 'Ninguna', fecha: ts.formatted, nota: 'OBS: ' + nota, iso: ts.iso }); 
      exp.observacion = nObs; 
      registrarLog(`Observación editada`, `Para: ${exp.idSys}`); 
    }
    
    exp.lastModified = ts.timestamp;
    StorageManager.guardar(expedientes);
    mostrarToast('Cambios guardados con éxito.'); 
    render();
  });
}

function abrirDetalles(id) {
  let exp = expedientes.find(e => e.id === id || e.idSys === id); 
  if (!exp) return;
  
  document.getElementById('detallesTituloActual').innerText = exp.titulo; 
  document.getElementById('detallesIdSysActual').innerText = 'ID Sistema: ' + exp.idSys;
  document.getElementById('detallesFechaRegistro').innerText = exp.fechaRegistro; 
  document.getElementById('detallesSubtitle').innerText = `No. Exp: ${exp.id} | Titular: ${exp.titular}`;
  
  let btnAuditoriaLink = document.getElementById('btnVerEnAuditoriaGlobal');
  btnAuditoriaLink.onclick = () => { cerrarDetallesModal(); abrirModalAuditoriaGlobal(exp.idSys); };

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
  document.getElementById('modalInventario').style.display = 'flex'; 
  render(); 
}

function cerrarModalInventario() { 
  document.getElementById('modalInventario').style.display = 'none'; 
}

function abrirModalAuditoriaGlobal(filtroPrestablecido) { 
  document.getElementById('modalAuditoriaGlobal').style.display = 'flex'; 
  if (filtroPrestablecido) { 
    document.getElementById('auditSearchBox').value = filtroPrestablecido; 
  }
  renderAuditoria(); 
}

function cerrarModalAuditoriaGlobal() { 
  document.getElementById('modalAuditoriaGlobal').style.display = 'none'; 
}

// --- MOTORES DE EXPORTACIÓN (CSV, EXCEL, PDF) ---
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
        detalleTexto: (h.tipo === 'titulo' || h.tipo === 'observacion' || h.tipo === 'titular') ? (h.previo + ' -> ' + h.actual) : (h.origen + ' -> ' + h.destino)
      });
    });
  });

  let filtrado = historialGlobal.filter(h => tabActualAuditoria === 'documental' ? (h.tipo === 'titulo' || h.tipo === 'observacion' || h.tipo === 'titular') : h.tipo === 'movimiento');

  filtrado = filtrado.filter(h => {
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

  filtrado.sort((a, b) => b.ts - a.ts);
  return filtrado;
}

function descargarArchivo(contenido, nombreArchivo, mimeType) {
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
}

function exportarAuditoriaCSV() {
  const registros = obtenerRegistrosAuditoriaFiltrados();
  if (registros.length === 0) {
    mostrarToast('No hay registros para exportar con los filtros actuales.');
    return;
  }

  const tipoReporte = tabActualAuditoria === 'documental' ? 'Documental_y_Obs' : 'Transferencias';
  const ahora = obtenerFechaYHora();
  const nombreArchivo = 'Bitacora_CONAGUA_' + tipoReporte + '_' + ahora.iso + '.csv';

  const encabezados = ['Fecha/Hora', 'Usuario', 'ID Sistema', 'Titulo (Clave)', 'No. Expediente', 'Detalle del Evento', 'Justificacion'];
  let lineas = [encabezados.map(h => '"' + h + '"').join(',')];

  registros.forEach(r => {
    let detalle = '';
    if (r.tipo === 'titulo' || r.tipo === 'observacion' || r.tipo === 'titular') {
      const prefijo = r.tipo === 'observacion' ? '[Obs] ' : (r.tipo === 'titular' ? '[Titular] ' : '[Doc] ');
      detalle = prefijo + r.previo + ' -> ' + r.actual;
    } else {
      detalle = r.origen + ' -> ' + r.destino;
    }

    const fila = [
      r.fecha || '',
      r.usuario || 'Admin Local',
      r.idSys || '',
      r.tituloReal || '',
      r.expId || '',
      detalle,
      r.nota || ''
    ];

    lineas.push(fila.map(campo => '"' + String(campo).replace(/"/g, '""') + '"').join(','));
  });

  const contenidoCSV = '\uFEFF' + lineas.join('\r\n');
  descargarArchivo(contenidoCSV, nombreArchivo, 'text/csv;charset=utf-8;');
  mostrarToast('Reporte CSV descargado con éxito (' + registros.length + ' registros).');
}

function exportarAuditoriaExcel() {
  const registros = obtenerRegistrosAuditoriaFiltrados();
  if (registros.length === 0) {
    mostrarToast('No hay registros para exportar con los filtros actuales.');
    return;
  }

  const tipoReporte = tabActualAuditoria === 'documental' ? 'Historial Documental y Observaciones' : 'Historial de Transferencias Departamentales';
  const ahora = obtenerFechaYHora();
  const nombreArchivo = 'Reporte_CONAGUA_' + tabActualAuditoria + '_' + ahora.iso + '.xls';

  let filasHtml = '';
  registros.forEach(r => {
    let detalle = '';
    if (r.tipo === 'titulo' || r.tipo === 'observacion' || r.tipo === 'titular') {
      const prefijo = r.tipo === 'observacion' ? '<b>[Obs]</b> ' : (r.tipo === 'titular' ? '<b>[Titular]</b> ' : '<b>[Doc]</b> ');
      detalle = prefijo + '<span style="color:#777; text-decoration:line-through;">' + r.previo + '</span> &rarr; <b>' + r.actual + '</b>';
    } else {
      detalle = '<b>' + r.origen + '</b> &rarr; <b>' + r.destino + '</b>';
    }

    filasHtml += '<tr>' +
      '<td style="border:1px solid #dcdcdc; padding:6px 10px;">' + r.fecha + '</td>' +
      '<td style="border:1px solid #dcdcdc; padding:6px 10px;">' + (r.usuario || 'Admin Local') + '</td>' +
      '<td style="border:1px solid #dcdcdc; padding:6px 10px; font-family:monospace;">' + r.idSys + '</td>' +
      '<td style="border:1px solid #dcdcdc; padding:6px 10px; font-weight:bold; color:#0b57d0;">' + r.tituloReal + '</td>' +
      '<td style="border:1px solid #dcdcdc; padding:6px 10px;">' + r.expId + '</td>' +
      '<td style="border:1px solid #dcdcdc; padding:6px 10px;">' + detalle + '</td>' +
      '<td style="border:1px solid #dcdcdc; padding:6px 10px; color:#444;">' + (r.nota || '') + '</td>' +
    '</tr>';
  });

  const templateExcel = '<' + 'html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    '<' + 'head><' + 'meta charset="utf-8">' + '<' + '/head>' +
    '<' + 'body>' +
    '<table>' +
      '<tr><td colspan="7" style="font-size:16pt; font-weight:bold; color:#004d40;">COMISIÓN NACIONAL DEL AGUA (CONAGUA)</td></tr>' +
      '<tr><td colspan="7" style="font-size:11pt; color:#555;">Reporte de Auditoría: ' + tipoReporte + '</td></tr>' +
      '<tr><td colspan="7" style="font-size:10pt; color:#777;">Generado el: ' + ahora.formatted + ' | Por: Administrador Local</td></tr>' +
      '<tr><td colspan="7"></td></tr>' +
      '<thead>' +
        '<tr style="background:#0b57d0; color:#fff; font-weight:bold;">' +
          '<th style="border:1px solid #003c99; padding:8px 10px;">Fecha / Hora</th>' +
          '<th style="border:1px solid #003c99; padding:8px 10px;">Usuario</th>' +
          '<th style="border:1px solid #003c99; padding:8px 10px;">ID Sistema</th>' +
          '<th style="border:1px solid #003c99; padding:8px 10px;">Título (Clave Principal)</th>' +
          '<th style="border:1px solid #003c99; padding:8px 10px;">No. Expediente</th>' +
          '<th style="border:1px solid #003c99; padding:8px 10px;">Detalle del Registro</th>' +
          '<th style="border:1px solid #003c99; padding:8px 10px;">Justificación</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' + filasHtml + '</tbody>' +
    '</table>' +
    '<' + '/body>' + '<' + '/html>';

  descargarArchivo('\uFEFF' + templateExcel, nombreArchivo, 'application/vnd.ms-excel;charset=utf-8');
  mostrarToast('Reporte Excel generado (' + registros.length + ' registros).');
}

function exportarAuditoriaPDF() {
  const registros = obtenerRegistrosAuditoriaFiltrados();
  if (registros.length === 0) {
    mostrarToast('No hay registros para exportar con los filtros actuales.');
    return;
  }

  const tipoReporte = tabActualAuditoria === 'documental' ? 'Historial Documental y Observaciones' : 'Historial de Transferencias Departamentales';
  const ahora = obtenerFechaYHora();

  let filasHtml = '';
  registros.forEach((r, idx) => {
    let detalle = '';
    if (r.tipo === 'titulo' || r.tipo === 'observacion' || r.tipo === 'titular') {
      const prefijo = r.tipo === 'observacion' ? '<b>[Obs]</b> ' : (r.tipo === 'titular' ? '<b>[Titular]</b> ' : '<b>[Doc]</b> ');
      detalle = prefijo + '<span style="text-decoration:line-through; opacity:0.6;">' + r.previo + '</span> &rarr; <b>' + r.actual + '</b>';
    } else {
      detalle = '<b>' + r.origen + '</b> &rarr; <b>' + r.destino + '</b>';
    }

    filasHtml += '<tr style="background-color: ' + (idx % 2 === 0 ? '#ffffff' : '#f9fbfd') + ';">' +
      '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-size: 11px;">' + r.fecha + '</td>' +
      '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-size: 11px;">' + (r.usuario || 'Admin') + '</td>' +
      '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-family: monospace; font-size: 11px;">' + r.idSys + '</td>' +
      '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-weight: bold; font-size: 11px; color: #0b57d0;">' + r.tituloReal + '</td>' +
      '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-size: 11px;">' + r.expId + '</td>' +
      '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-size: 11px;">' + detalle + '</td>' +
      '<td style="padding: 6px 8px; border: 1px solid #d3d3d3; font-size: 11px; color: #555;">' + (r.nota || '-') + '</td>' +
    '</tr>';
  });

  // Reutiliza o crea un iframe invisible en el DOM
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
            '<th style="width: 14%;">Fecha / Hora</th>' +
            '<th style="width: 10%;">Usuario</th>' +
            '<th style="width: 11%;">ID Sistema</th>' +
            '<th style="width: 15%;">Título (Clave)</th>' +
            '<th style="width: 13%;">No. Expediente</th>' +
            '<th style="width: 22%;">Detalle de Operación</th>' +
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

  mostrarToast('Generando vista de impresión / PDF...');
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 300);
}

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
  let search = (document.getElementById('auditSearchBox').value || '').toLowerCase();
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
  const btnLimpiar = document.getElementById('btnLimpiarFiltros');
  if (btnLimpiar) btnLimpiar.style.display = hayFiltrosActivos ? 'inline-flex' : 'none';

  let head = document.getElementById('audit-table-head');
  let body = document.getElementById('audit-table-body');
  if (!head || !body) return;
  head.innerHTML = ''; body.innerHTML = '';

  let historialGlobal = [];
  expedientes.forEach(exp => {
    (exp.historial || []).forEach(h => {
      historialGlobal.push({
        ...h,
        idSys: exp.idSys, 
        expId: exp.id, 
        tituloReal: h.tituloActual || exp.titulo, 
        expTitular: exp.titular,
        detalleTexto: (h.tipo === 'titulo' || h.tipo === 'observacion' || h.tipo === 'titular') ? (`${h.previo} -> ${h.actual}`) : (`${h.origen} -> ${h.destino}`)
      });
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

  let baseHeaders = `<th>Fecha / Hora<br><input type="text" class="col-filter-input" id="f-fecha" placeholder="Filtrar..." value="${fFecha}" oninput="renderAuditoria()"></th>
    <th>Usuario<br><input type="text" class="col-filter-input" id="f-usuario" placeholder="Filtrar..." value="${fUsuario}" oninput="renderAuditoria()"></th>
    <th>ID Sistema<br><input type="text" class="col-filter-input" id="f-sys" placeholder="Filtrar..." value="${fSys}" oninput="renderAuditoria()"></th>
    <th>Título (Principal)<br><input type="text" class="col-filter-input" id="f-titulo" placeholder="Filtrar..." value="${fTitulo}" oninput="renderAuditoria()"></th>
    <th>No. Expediente<br><input type="text" class="col-filter-input" id="f-exp" placeholder="Filtrar..." value="${fExp}" oninput="renderAuditoria()"></th>`;

  if (tabActualAuditoria === 'documental') {
    head.innerHTML = `<tr>${baseHeaders}
      <th>Detalle Documental / Obs.<br><input type="text" class="col-filter-input" id="f-detalle" placeholder="Filtrar..." value="${fDetalle}" oninput="renderAuditoria()"></th>
      <th>Justificación<br><input type="text" class="col-filter-input" id="f-nota" placeholder="Filtrar..." value="${fNota}" oninput="renderAuditoria()"></th></tr>`;
  } else {
    head.innerHTML = `<tr>${baseHeaders}
      <th>Origen -> Destino<br><input type="text" class="col-filter-input" id="f-detalle" placeholder="Filtrar..." value="${fDetalle}" oninput="renderAuditoria()"></th>
      <th>Justificación<br><input type="text" class="col-filter-input" id="f-nota" placeholder="Filtrar..." value="${fNota}" oninput="renderAuditoria()"></th></tr>`;
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
        detalleHtml = `${etiquetaPrefijo} <span style="text-decoration:line-through; opacity:0.6;">${h.previo}</span> -> <strong>${h.actual}</strong>`;
      } else {
        let badgeO = 'badge badge-' + h.origen.replace(/ /g, '');
        let badgeD = 'badge badge-' + h.destino.replace(/ /g, '');
        detalleHtml = `<span class="${badgeO}" style="font-size:11px; padding:2px 8px;">${h.origen}</span> <span style="color:var(--md-sys-color-outline); margin: 0 4px;">➔</span> <span class="${badgeD}" style="font-size:11px; padding:2px 8px;">${h.destino}</span>`;
      }
        
      body.innerHTML += `<tr><td>${h.fecha}</td><td><span style="font-weight:500; font-size:12px; padding:3px 8px; border-radius:6px; background:var(--md-sys-color-surface-container); color:var(--md-sys-color-on-surface);">${h.usuario || 'Admin Local'}</span></td><td><span class="sys-id-tag">${h.idSys}</span></td><td style="font-weight:700; color:var(--md-sys-color-primary);">${h.tituloReal}</td><td style="font-weight:500;">${h.expId}</td><td>${detalleHtml}</td><td style="color:var(--md-sys-color-on-surface-variant);">${h.nota}</td></tr>`;
    });
  }
}

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
      (exp.titulo.toLowerCase().includes(queryInv) || exp.id.toLowerCase().includes(queryInv) || exp.idSys.toLowerCase().includes(queryInv) || (exp.observacion || '').toLowerCase().includes(queryInv)) 
      && (sidebarAreaFilter === 'todas' || exp.area === sidebarAreaFilter)
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
      let matchesText = exp.titulo.toLowerCase().includes(queryModal) || exp.id.toLowerCase().includes(queryModal) || exp.idSys.toLowerCase().includes(queryModal) || exp.titular.toLowerCase().includes(queryModal) || (exp.observacion || '').toLowerCase().includes(queryModal);
      let matchesArea = modalAreaFilter === 'todas' || exp.area === modalAreaFilter;
      let expDateISO = exp.fechaRegistro.split('/').reverse().join('-');
      let matchesFrom = !modalDateFrom || expDateISO >= modalDateFrom;
      let matchesTo = !modalDateTo || expDateISO <= modalDateTo;
      let mSys = !fInvSys || exp.idSys.toLowerCase().includes(fInvSys);
      let mTit = !fInvTitulo || exp.titulo.toLowerCase().includes(fInvTitulo);
      let mExp = !fInvExp || exp.id.toLowerCase().includes(fInvExp);
      let mTitular = !fInvTitular || exp.titular.toLowerCase().includes(fInvTitular);
      let mObs = !fInvObs || (exp.observacion || '').toLowerCase().includes(fInvObs);
      let mAreaCol = !fInvArea || exp.area.toLowerCase().includes(fInvArea);
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
  let expTablero = expedientes.filter(exp => 
    exp.enTablero && 
    (exp.titulo.toLowerCase().includes(queryBoard) || exp.id.toLowerCase().includes(queryBoard) || exp.idSys.toLowerCase().includes(queryBoard) || (exp.observacion || '').toLowerCase().includes(queryBoard)) && 
    (!boardDateFilter || exp.dateISO === boardDateFilter) && 
    (boardAreaFilter === 'todas' || exp.area === boardAreaFilter)
  ).sort((a, b) => b.lastModified - a.lastModified);
  
  const boardHeaderTitleEl = document.getElementById('boardHeaderTitle');
  if (boardHeaderTitleEl) boardHeaderTitleEl.innerText = `Tablero de Circulación Activa (${expTablero.length})`;

  if (vistaActualTablero === 'kanban') {
    const kanbanCont = document.getElementById('kanbanColumnsContainer'); 
    if (kanbanCont) {
      kanbanCont.innerHTML = '';
      
      let columnAreas = [
        { code: 'CIS', title: 'CIS', cls: 'col-cis' },
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
          tCont.innerHTML += `<div class="timeline-item"><div class="timeline-badge-col"><div class="timeline-date-box">${pts[0]||''}<br>${pts[1]||''} ${pts[2]||''}</div><span class="${getBadgeClass(exp.area)}" style="margin-top:12px;">${exp.area}</span></div><div class="timeline-content-card ${getCardColorClass(exp.area)}"><div><span class="k-titulo-main" style="margin:0; font-size:20px;">${exp.titulo}</span><div style="display:flex; gap:8px; align-items:center; margin-top:8px;"><span class="sys-id-tag">SYS: ${exp.idSys}</span><span style="font-size:13px; font-weight:500; opacity:0.8;">Exp: ${exp.id}</span></div></div><div class="k-info" style="font-size:15px; margin-top:16px;"><strong>Titular:</strong> ${exp.titular}</div>${obsHtml}<div class="timeline-actions-row" style="display:flex; gap:8px; margin-top:20px; border-top:1px solid rgba(0,0,0,0.1); padding-top:16px;"><button class="btn-card-outline" onclick="abrirDetalles('${exp.id}')">Ver Historial</button><button class="btn-card-tonal" onclick="modificarExpediente('${exp.id}')">Editar Datos</button><button class="btn-card-filled" onclick="moverExpediente('${exp.id}')">Mover de Área</button></div></div></div>`;
        }); 
      }
    }
  }
}
// ==========================================================================
// MOTOR DE RESPALDOS MANUALES Y ROTACIÓN AUTOMÁTICA
// ==========================================================================

const SNAPSHOTS_KEY = 'CONAGUA_AUTO_SNAPSHOTS_V1';
const MAX_SNAPSHOTS = 3;

// --- RESPALDO MANUAL DESCARGABLE --- ------------------------------------------------------------------
function crearRespaldoDescargable() {
  const ahora = obtenerFechaYHora();
  const paqueteRespaldo = {
    sistema: 'CONAGUA - Gestor Local de Expedientes',
    versionApp: '1.0.0',
    fechaEmision: ahora.formatted,
    iso: ahora.iso,
    totalExpedientes: expedientes.length,
    datos: expedientes
  };

  const jsonString = JSON.stringify(paqueteRespaldo, null, 2);
  const nombreArchivo = `Respaldo_CONAGUA_${ahora.iso}_${Date.now()}.json`;
  descargarArchivo(jsonString, nombreArchivo, 'application/json');
  mostrarToast('Copia de seguridad descargada.');
}

function restaurarRespaldoDesdeArchivo(event) {
  const archivo = event.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = function(e) {
    try {
      const contenido = JSON.parse(e.target.result);
      if (!contenido.datos || !Array.isArray(contenido.datos)) {
        throw new Error('Estructura de archivo incompatible.');
      }

      if (confirm(`¿Deseas restaurar este respaldo con ${contenido.datos.length} expedientes? Los datos actuales serán sustituidos.`)) {
        expedientes = contenido.datos;
        StorageManager.guardar(expedientes);
        ejecutarAutoSnapshot('Punto previo a restauración');
        mostrarToast('Base de datos restaurada con éxito.');
        cerrarModalAjustes();
        render();
      }
    } catch (err) {
      alert('Error al leer el archivo de respaldo: ' + err.message);
    }
  };
  lector.readAsText(archivo);
  event.target.value = '';
}

// --- SNAPSHOTS AUTOMÁTICOS ROTATIVOS (MÁXIMO 3) ---
function obtenerSnapshots() {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function ejecutarAutoSnapshot(motivo = 'Automático programado') {
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

  // Agrega al inicio y mantiene estrictamente el límite de 3
  snapshots.unshift(nuevaSnapshot);
  if (snapshots.length > MAX_SNAPSHOTS) {
    snapshots = snapshots.slice(0, MAX_SNAPSHOTS);
  }

  try {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
  } catch (e) {
    console.warn('No se pudo guardar la instantánea automática:', e);
  }
}

function restaurarSnapshot(snapId) {
  const snapshots = obtenerSnapshots();
  const objetivo = snapshots.find(s => s.id === snapId);
  if (!objetivo) return;

  if (confirm(`¿Restaurar la instantánea del ${objetivo.fecha}?`)) {
    expedientes = objetivo.datos;
    StorageManager.guardar(expedientes);
    mostrarToast('Instantánea restaurada.');
    cerrarModalAjustes();
    render();
  }
}

function abrirModalAjustes() {
  const container = document.getElementById('listaSnapshotsAuto');
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

  document.getElementById('modalAjustesOverlay').style.display = 'flex';
}

function cerrarModalAjustes() {
  document.getElementById('modalAjustesOverlay').style.display = 'none';
}

// Configurar temporizador (cada 2 horas) y respaldo al cerrar ventana
setInterval(() => {
  ejecutarAutoSnapshot('Copia automática periódica (2 hrs)');
}, 2 * 60 * 60 * 1000);

window.addEventListener('beforeunload', () => {
  ejecutarAutoSnapshot('Cierre de aplicación');
});

// --- EXPOSICIÓN GLOBAL A WINDOW PARA LOS EVENTOS ONCLICK DEL HTML ---
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
window.render = render;
window.renderAuditoria = renderAuditoria;
window.abrirModalAjustes = abrirModalAjustes;
window.cerrarModalAjustes = cerrarModalAjustes;
window.crearRespaldoDescargable = crearRespaldoDescargable;
window.restaurarRespaldoDesdeArchivo = restaurarRespaldoDesdeArchivo;
window.restaurarSnapshot = restaurarSnapshot;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  render();
});