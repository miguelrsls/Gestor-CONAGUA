export function obtenerFechaYHora(fechaIngresadaISO) {
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
  
  return { formatted: `${dia}/${mes}/${anio} ${horasStr}:${minutos} ${ampm}`, iso: `${anio}-${mes}-${dia}`, dateOnly: `${dia}/${mes}/${anio}`, timestamp: d.getTime() };
}