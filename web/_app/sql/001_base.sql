-- 001: tablas base (registro, sitios, indice de Good, administradores, cuentas)
-- Idempotente: se puede correr sobre el servidor actual (que ya tiene `registro`
-- y `tsline_usuarios`) o sobre una base vacia.

CREATE TABLE IF NOT EXISTS registro (
  id      INT NOT NULL AUTO_INCREMENT,
  fecha   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  evento  VARCHAR(80) NOT NULL,
  detalle VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE registro
  ADD COLUMN IF NOT EXISTS usuario VARCHAR(64) NOT NULL DEFAULT '' AFTER evento,
  ADD COLUMN IF NOT EXISTS ip VARCHAR(45) NOT NULL DEFAULT '' AFTER usuario,
  ADD INDEX IF NOT EXISTS idx_registro_fecha (fecha);

-- Tabla vieja de TS_LINE (existe en el servidor; en una base nueva queda vacia)
CREATE TABLE IF NOT EXISTS tsline_usuarios (
  usuario   VARCHAR(64) NOT NULL,
  pass_hash VARCHAR(255) NOT NULL,
  rol       VARCHAR(16) NOT NULL DEFAULT 'comun',
  creado    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sitios alojados (reemplaza paginas.json)
CREATE TABLE IF NOT EXISTS sitios (
  slug         VARCHAR(48) NOT NULL,
  nombre       VARCHAR(80) NOT NULL,
  descripcion  VARCHAR(255) NOT NULL DEFAULT '',
  categoria    VARCHAR(60) NOT NULL DEFAULT 'General',
  icono        VARCHAR(16) NOT NULL DEFAULT '🌐',
  color        VARCHAR(16) NOT NULL DEFAULT 'blue',
  publica      TINYINT(1) NOT NULL DEFAULT 0,
  activa       TINYINT(1) NOT NULL DEFAULT 1,
  sistema      TINYINT(1) NOT NULL DEFAULT 0,  -- tsline/aninube: no se borran desde el gestor de sitios
  creado       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  indexado_en  DATETIME NULL,
  PRIMARY KEY (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indice de Good
CREATE TABLE IF NOT EXISTS good_paginas (
  id          INT NOT NULL AUTO_INCREMENT,
  sitio       VARCHAR(48) NOT NULL,
  tipo        VARCHAR(12) NOT NULL DEFAULT 'pagina',   -- pagina | anime | musica
  url         VARCHAR(512) NOT NULL,
  titulo      VARCHAR(255) NOT NULL DEFAULT '',
  descripcion VARCHAR(512) NOT NULL DEFAULT '',
  contenido   MEDIUMTEXT NOT NULL,
  actualizado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_good_url (url(255)),
  KEY idx_good_sitio (sitio),
  FULLTEXT KEY ft_good (titulo, descripcion, contenido)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Administradores del panel (puerto privado)
CREATE TABLE IF NOT EXISTS admin_usuarios (
  usuario      VARCHAR(32) NOT NULL,
  pass_hash    VARCHAR(255) NOT NULL,
  activo       TINYINT(1) NOT NULL DEFAULT 1,
  creado       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_login DATETIME NULL,
  PRIMARY KEY (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Intentos fallidos de login (bloqueo anti fuerza bruta). ambito: admin | cuentas
CREATE TABLE IF NOT EXISTS login_intentos (
  id      INT NOT NULL AUTO_INCREMENT,
  ambito  VARCHAR(12) NOT NULL,
  ip      VARCHAR(45) NOT NULL,
  usuario VARCHAR(64) NOT NULL DEFAULT '',
  fecha   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_intentos (ambito, ip, fecha),
  KEY idx_intentos_u (ambito, usuario, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cuentas de los sitios publicos (musica + anime): un solo login
CREATE TABLE IF NOT EXISTS cuentas (
  id        INT NOT NULL AUTO_INCREMENT,
  usuario   VARCHAR(32) NOT NULL,
  pass_hash VARCHAR(255) NOT NULL,
  activa    TINYINT(1) NOT NULL DEFAULT 1,
  creado    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_login DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cuentas_usuario (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrar las cuentas viejas de TS_LINE (mismo hash; el rol ya no aplica:
-- administrar es solo desde el panel privado). Excluye la clave compartida interna.
INSERT IGNORE INTO cuentas (usuario, pass_hash, creado)
  SELECT usuario, pass_hash, COALESCE(creado, NOW())
  FROM tsline_usuarios
  WHERE usuario <> '__comun__';
