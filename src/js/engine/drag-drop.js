export let dragState = { isDragging: false, hasMoved: false, cloneEl: null, sourceEl: null, expId: null, offsetX: 0, offsetY: 0, initMouseX: 0, initMouseY: 0, hoverCol: null };
let dragRAF = null;
let currentMouseX = 0;
let currentMouseY = 0;
let dropCallback = null;

export function setDropCallback(cb) { dropCallback = cb; }

export function initDrag(e, expId, cardEl) {
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
      if (dropCallback) { dropCallback(dragState.expId, newArea); }
    }
  }
  dragState = { isDragging: false, hasMoved: false, cloneEl: null, sourceEl: null, expId: null, offsetX: 0, offsetY: 0, initMouseX: 0, initMouseY: 0, hoverCol: null };
}