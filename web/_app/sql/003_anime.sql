-- 003: anime (AniNube), todo cargado desde el panel

CREATE TABLE IF NOT EXISTS anime_series (
  id          INT NOT NULL AUTO_INCREMENT,
  titulo      VARCHAR(200) NOT NULL,
  titulo_alt  VARCHAR(200) NOT NULL DEFAULT '',
  sinopsis    TEXT NOT NULL,
  anio        SMALLINT NULL,
  estado      VARCHAR(16) NOT NULL DEFAULT 'emision',   -- emision | finalizado | proximamente
  portada     VARCHAR(255) NOT NULL DEFAULT '',
  banner      VARCHAR(255) NOT NULL DEFAULT '',
  destacada   TINYINT(1) NOT NULL DEFAULT 0,
  creado      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anime_generos (
  serie_id INT NOT NULL,
  genero   VARCHAR(40) NOT NULL,
  PRIMARY KEY (serie_id, genero),
  KEY idx_ag_genero (genero),
  CONSTRAINT fk_ag_serie FOREIGN KEY (serie_id) REFERENCES anime_series(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anime_episodios (
  id         INT NOT NULL AUTO_INCREMENT,
  serie_id   INT NOT NULL,
  temporada  SMALLINT NOT NULL DEFAULT 1,
  numero     SMALLINT NOT NULL,
  titulo     VARCHAR(200) NOT NULL DEFAULT '',
  archivo    VARCHAR(255) NOT NULL,
  mime       VARCHAR(64) NOT NULL DEFAULT 'video/mp4',
  duracion   INT NOT NULL DEFAULT 0,
  miniatura  VARCHAR(255) NOT NULL DEFAULT '',
  bytes      BIGINT NOT NULL DEFAULT 0,
  subido     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ae_num (serie_id, temporada, numero),
  CONSTRAINT fk_ae_serie FOREIGN KEY (serie_id) REFERENCES anime_series(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anime_lista (
  cuenta_id INT NOT NULL,
  serie_id  INT NOT NULL,
  fecha     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cuenta_id, serie_id),
  CONSTRAINT fk_al_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas(id) ON DELETE CASCADE,
  CONSTRAINT fk_al_serie  FOREIGN KEY (serie_id)  REFERENCES anime_series(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anime_progreso (
  cuenta_id   INT NOT NULL,
  episodio_id INT NOT NULL,
  segundos    INT NOT NULL DEFAULT 0,
  visto       TINYINT(1) NOT NULL DEFAULT 0,
  actualizado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (cuenta_id, episodio_id),
  KEY idx_ap_reciente (cuenta_id, actualizado),
  CONSTRAINT fk_ap_cuenta FOREIGN KEY (cuenta_id)   REFERENCES cuentas(id) ON DELETE CASCADE,
  CONSTRAINT fk_ap_ep     FOREIGN KEY (episodio_id) REFERENCES anime_episodios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
