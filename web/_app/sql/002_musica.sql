-- 002: musica (TS_LINE)

CREATE TABLE IF NOT EXISTS musica_pistas (
  id           INT NOT NULL AUTO_INCREMENT,
  archivo      VARCHAR(255) NOT NULL,            -- nombre dentro de _datos/media/musica/audio/
  mime         VARCHAR(64) NOT NULL DEFAULT 'audio/mpeg',
  titulo       VARCHAR(200) NOT NULL,
  artista      VARCHAR(160) NOT NULL DEFAULT '',
  album        VARCHAR(160) NOT NULL DEFAULT '',
  genero       VARCHAR(60) NOT NULL DEFAULT 'Otros',
  duracion     INT NOT NULL DEFAULT 0,           -- segundos
  portada      VARCHAR(255) NOT NULL DEFAULT '', -- nombre dentro de portadas/
  letra        VARCHAR(255) NOT NULL DEFAULT '', -- nombre dentro de letras/ (.lrc)
  bytes        BIGINT NOT NULL DEFAULT 0,
  reproducciones INT NOT NULL DEFAULT 0,
  subido       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mp_genero (genero),
  KEY idx_mp_artista (artista)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS musica_likes (
  cuenta_id INT NOT NULL,
  pista_id  INT NOT NULL,
  fecha     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cuenta_id, pista_id),
  CONSTRAINT fk_ml_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas(id) ON DELETE CASCADE,
  CONSTRAINT fk_ml_pista  FOREIGN KEY (pista_id)  REFERENCES musica_pistas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS musica_listas (
  id        INT NOT NULL AUTO_INCREMENT,
  cuenta_id INT NOT NULL,
  nombre    VARCHAR(80) NOT NULL,
  creado    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mlis_cuenta (cuenta_id),
  CONSTRAINT fk_mlis_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS musica_lista_pistas (
  lista_id INT NOT NULL,
  pista_id INT NOT NULL,
  orden    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (lista_id, pista_id),
  CONSTRAINT fk_mlp_lista FOREIGN KEY (lista_id) REFERENCES musica_listas(id) ON DELETE CASCADE,
  CONSTRAINT fk_mlp_pista FOREIGN KEY (pista_id) REFERENCES musica_pistas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS musica_historial (
  id        INT NOT NULL AUTO_INCREMENT,
  cuenta_id INT NOT NULL,
  pista_id  INT NOT NULL,
  fecha     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mh_cuenta (cuenta_id, fecha),
  CONSTRAINT fk_mh_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas(id) ON DELETE CASCADE,
  CONSTRAINT fk_mh_pista  FOREIGN KEY (pista_id)  REFERENCES musica_pistas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS musica_prefs (
  cuenta_id INT NOT NULL,
  generos   VARCHAR(500) NOT NULL DEFAULT '',   -- separados por coma
  volumen   TINYINT UNSIGNED NOT NULL DEFAULT 80,
  PRIMARY KEY (cuenta_id),
  CONSTRAINT fk_mpref_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
