import Database from '@tauri-apps/plugin-sql';

let dbInstance = null;

export async function getDb() {
  if (!dbInstance) {
    if (window.__TAURI_INTERNALS__) {
      dbInstance = await Database.load('sqlite:conagua_local.db');
      await initSchema(dbInstance);
    } else {
      console.warn("Entorno Tauri no detectado, usando DB simulada en memoria.");
      dbInstance = crearDbSimulada();
    }
  }
  return dbInstance;
}

async function initSchema(db) {
  await db.execute('PRAGMA foreign_keys = ON;');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS areas (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      color_bg TEXT NOT NULL,
      color_text TEXT NOT NULL,
      orden INTEGER NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS expedientes (
      id_sistema TEXT PRIMARY KEY,
      numero_expediente TEXT NOT NULL,
      titulo TEXT NOT NULL,
      titular TEXT NOT NULL,
      area_actual TEXT NOT NULL,
      observacion TEXT DEFAULT '',
      fecha_registro TEXT NOT NULL,
      ts_registro INTEGER NOT NULL,
      en_tablero INTEGER DEFAULT 0,
      tiempo TEXT DEFAULT '---',
      date_iso TEXT DEFAULT '',
      last_modified INTEGER NOT NULL,
      FOREIGN KEY (area_actual) REFERENCES areas(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_sistema TEXT NOT NULL,
      tipo TEXT NOT NULL,
      usuario TEXT NOT NULL DEFAULT 'Admin Local',
      titulo_actual TEXT NOT NULL,
      valor_previo TEXT,
      valor_nuevo TEXT,
      justificacion TEXT NOT NULL,
      fecha_hora TEXT NOT NULL,
      fecha_iso TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (id_sistema) REFERENCES expedientes(id_sistema) ON DELETE CASCADE
    );
  `);

  await db.execute('CREATE INDEX IF NOT EXISTS idx_exp_busqueda ON expedientes(titulo, numero_expediente, id_sistema, titular);');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_auditoria_sistema ON auditoria(id_sistema);');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha_iso);');

  const areasExistentes = await db.select('SELECT COUNT(*) as count FROM areas');
  if (areasExistentes[0].count === 0) {
    await db.execute(`
      INSERT INTO areas (id, nombre, color_bg, color_text, orden) VALUES
      ('CIS', 'Centro Integral de Servicios', '#e0f2f1', '#004d40', 1),
      ('DICTAMINACION', 'Dictaminación', '#fff3e0', '#e65100', 2),
      ('SUBDIRECTOR', 'Subdirección Adm. Agua', '#e8eaf6', '#1a237e', 3),
      ('INFRACCIONES', 'Calificación de Infracciones', '#fce4ec', '#880e4f', 4),
      ('INSPECCION', 'Inspección', '#fff8e1', '#ff6f00', 5),
      ('TECNICA', 'Técnica', '#e3f2fd', '#0d47a1', 6),
      ('JURIDICO', 'Jurídico', '#f3e5f5', '#4a148c', 7),
      ('DIRECCION', 'Dirección', '#e8f5e9', '#1b5e20', 8),
      ('ARCHIVO', 'Archivo General', '#e1e3e8', '#444746', 9);
    `);
  }
}

function crearDbSimulada() {
  return {
    select: async () => [],
    execute: async () => true
  };
}