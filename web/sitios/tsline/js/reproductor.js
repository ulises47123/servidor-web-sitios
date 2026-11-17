// Motor del reproductor: cola, aleatorio, repetir, controles del sistema (Media Session).
// Emite eventos: 'pista', 'estado', 'tiempo', 'cola', 'contar' (para el historial), 'error'.

export class Reproductor extends EventTarget {
  constructor(audio, buscarPista) {
    super();
    this.audio = audio;
    this.buscar = buscarPista;      // id -> pista
    this.cola = [];                 // ids en orden de reproduccion
    this.pos = -1;
    this.original = null;           // orden antes de mezclar
    this.aleatorio = false;
    this.repetir = 'no';            // no | todo | una
    this.contexto = null;           // {ruta, nombre}
    this._contada = false;

    audio.addEventListener('play', () => this._emitir('estado'));
    audio.addEventListener('pause', () => this._emitir('estado'));
    audio.addEventListener('timeupdate', () => {
      this._emitir('tiempo');
      const d = audio.duration;
      if (!this._contada && audio.currentTime >= Math.min(30, (d || 60) * 0.5)) {
        this._contada = true;
        this._emitir('contar', this.actual?.id);
      }
      if ('mediaSession' in navigator && Number.isFinite(d) && d > 0) {
        try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(audio.currentTime, d), playbackRate: 1 }); } catch { /* no soportado */ }
      }
    });
    audio.addEventListener('loadedmetadata', () => this._emitir('tiempo'));
    audio.addEventListener('ended', () => this._alTerminar());
    audio.addEventListener('error', () => {
      if (!audio.src) return;
      this._emitir('error', 'No se pudo reproducir esta canción');
      setTimeout(() => this.siguiente(true), 1200);
    });

    if ('mediaSession' in navigator) {
      const ms = navigator.mediaSession;
      const h = (a, f) => { try { ms.setActionHandler(a, f); } catch { /* accion no soportada */ } };
      h('play', () => this.play());
      h('pause', () => this.pausa());
      h('previoustrack', () => this.anterior());
      h('nexttrack', () => this.siguiente());
      h('seekbackward', d => this.saltar(-(d.seekOffset || 10)));
      h('seekforward', d => this.saltar(d.seekOffset || 10));
      h('seekto', d => { this.audio.currentTime = d.seekTime; });
    }
  }

  get actual() { return this.pos >= 0 ? this.buscar(this.cola[this.pos]) : null; }
  get sonando() { return !this.audio.paused; }

  _emitir(tipo, detalle) { this.dispatchEvent(new CustomEvent(tipo, { detail: detalle })); }

  /** Reproduce una lista de ids empezando en `inicio`. */
  reproducirLista(ids, inicio = 0, contexto = null) {
    if (!ids.length) return;
    this.contexto = contexto;
    this.original = null;
    this.cola = [...ids];
    this.pos = Math.max(0, Math.min(inicio, ids.length - 1));
    if (this.aleatorio) this._mezclar();
    this._cargar(true);
    this._emitir('cola');
  }

  agregarACola(id) {
    if (this.pos < 0) { this.reproducirLista([id], 0); return; }
    this.cola.push(id);
    this.original?.push(id);
    this._emitir('cola');
  }

  reproducirDespues(id) {
    if (this.pos < 0) { this.reproducirLista([id], 0); return; }
    this.cola.splice(this.pos + 1, 0, id);
    this.original?.push(id);
    this._emitir('cola');
  }

  quitarDeCola(i) {
    if (i === this.pos || i < 0 || i >= this.cola.length) return;
    this.cola.splice(i, 1);
    if (i < this.pos) this.pos--;
    this._emitir('cola');
  }

  moverEnCola(de, a) {
    if (de === a || de === this.pos || a <= this.pos) return;
    const [x] = this.cola.splice(de, 1);
    this.cola.splice(a, 0, x);
    this._emitir('cola');
  }

  irA(i) {
    if (i < 0 || i >= this.cola.length) return;
    this.pos = i;
    this._cargar(true);
    this._emitir('cola');
  }

  play() {
    if (this.pos < 0) return;
    this.audio.play().catch(() => { /* el navegador puede pedir un toque primero */ });
  }
  pausa() { this.audio.pause(); }
  alternar() { this.sonando ? this.pausa() : this.play(); }
  saltar(seg) { if (Number.isFinite(this.audio.duration)) this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, this.audio.currentTime + seg)); }
  irAFraccion(f) { if (Number.isFinite(this.audio.duration)) this.audio.currentTime = f * this.audio.duration; }
  volumen(v) { this.audio.volume = Math.max(0, Math.min(1, v)); }

  siguiente(auto = false) {
    if (this.pos < 0) return;
    if (this.pos + 1 < this.cola.length) {
      this.pos++;
    } else if (this.repetir === 'todo') {
      this.pos = 0;
    } else {
      // fin de la cola: si termino sola, queda en pausa al principio de la ultima
      if (auto) { this.audio.pause(); this.audio.currentTime = 0; }
      return;
    }
    this._cargar(true);
    this._emitir('cola');
  }

  anterior() {
    if (this.pos < 0) return;
    if (this.audio.currentTime > 3 || this.pos === 0) {
      if (this.pos === 0 && this.repetir === 'todo' && this.audio.currentTime <= 3) { this.pos = this.cola.length - 1; this._cargar(true); this._emitir('cola'); return; }
      this.audio.currentTime = 0; return;
    }
    this.pos--;
    this._cargar(true);
    this._emitir('cola');
  }

  alternarAleatorio() {
    this.aleatorio = !this.aleatorio;
    if (this.pos >= 0) {
      if (this.aleatorio) this._mezclar();
      else if (this.original) {
        const id = this.cola[this.pos];
        this.cola = this.original;
        this.pos = Math.max(0, this.cola.indexOf(id));
        this.original = null;
      }
      this._emitir('cola');
    }
    return this.aleatorio;
  }

  alternarRepetir() {
    this.repetir = { no: 'todo', todo: 'una', una: 'no' }[this.repetir];
    return this.repetir;
  }

  _mezclar() {
    this.original = [...this.cola];
    const actual = this.cola[this.pos];
    const resto = this.cola.filter((_, i) => i !== this.pos);
    for (let i = resto.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [resto[i], resto[j]] = [resto[j], resto[i]]; }
    this.cola = [actual, ...resto];
    this.pos = 0;
  }

  _alTerminar() {
    if (this.repetir === 'una') { this.audio.currentTime = 0; this.play(); return; }
    this.siguiente(true);
  }

  _cargar(reproducir) {
    const p = this.actual;
    if (!p) return;
    this._contada = false;
    this.audio.src = p.audio;
    if (reproducir) this.play();
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: p.titulo, artist: p.artista || 'TS_LINE', album: p.album || '',
          artwork: p.portada ? [{ src: new URL(p.portada, location.href).href, sizes: '512x512' }] : [{ src: new URL('img/logo.svg', location.href).href, sizes: '48x48', type: 'image/svg+xml' }],
        });
      } catch { /* sin Media Session */ }
    }
    this._emitir('pista');
  }
}
