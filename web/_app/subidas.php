<?php
/**
 * Subidas por partes (para canciones y episodios grandes).
 * iniciar -> parte (N veces, en orden) -> finalizar. Los temporales viven en _datos/tmp.
 */
declare(strict_types=1);

require_once __DIR__ . '/nucleo.php';

const SUBIDA_TMP = DATOS_DIR . '/tmp';
const SUBIDA_LIMITES = [
    'musica'   => 300 * 1024 * 1024,
    'episodio' => 8 * 1024 * 1024 * 1024,
];

function subida_tipos(string $proposito): array
{
    return match ($proposito) {
        'musica'   => MIME_AUDIO,
        'episodio' => MIME_VIDEO,
        default    => throw new InvalidArgumentException('Propósito de subida inválido'),
    };
}

function subida_iniciar(string $proposito, string $nombre, int $tamano, array $meta): string
{
    $tipos = subida_tipos($proposito);
    $ext = strtolower(pathinfo($nombre, PATHINFO_EXTENSION));
    if (!isset($tipos[$ext])) {
        throw new InvalidArgumentException('Formato no permitido (.' . $ext . '). Se aceptan: ' . implode(', ', array_keys($tipos)));
    }
    if ($tamano <= 0 || $tamano > SUBIDA_LIMITES[$proposito]) {
        throw new InvalidArgumentException('Tamaño inválido o demasiado grande (máx. ' . bytes_legibles(SUBIDA_LIMITES[$proposito]) . ')');
    }
    asegurar_dir(SUBIDA_TMP);
    subida_limpiar_viejas();
    $id = bin2hex(random_bytes(16));
    file_put_contents(SUBIDA_TMP . "/$id.json", json_encode([
        'proposito' => $proposito, 'nombre' => mb_substr($nombre, 0, 200), 'ext' => $ext,
        'mime' => $tipos[$ext], 'tamano' => $tamano, 'meta' => $meta, 'inicio' => time(),
    ], JSON_UNESCAPED_UNICODE));
    file_put_contents(SUBIDA_TMP . "/$id.part", '');
    return $id;
}

function subida_info(string $id): array
{
    if (!preg_match('/^[a-f0-9]{32}$/', $id) || !is_file(SUBIDA_TMP . "/$id.json")) {
        throw new InvalidArgumentException('Subida inexistente o vencida');
    }
    return json_decode((string)file_get_contents(SUBIDA_TMP . "/$id.json"), true) ?: [];
}

/** Agrega una parte. El offset tiene que coincidir con lo ya recibido (evita huecos). */
function subida_parte(string $id, int $offset, array $file): int
{
    $info = subida_info($id);
    $part = SUBIDA_TMP . "/$id.part";
    clearstatcache(true, $part);
    $actual = filesize($part);
    if ($offset !== $actual) {
        throw new InvalidArgumentException("Parte fuera de orden (esperado $actual)");
    }
    if (($file['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'] ?? '')) {
        throw new RuntimeException('La parte llegó con error');
    }
    $tam = (int)$file['size'];
    if ($actual + $tam > $info['tamano']) {
        throw new InvalidArgumentException('Se recibió más de lo anunciado');
    }
    $in = fopen($file['tmp_name'], 'rb');
    $out = fopen($part, 'ab');
    stream_copy_to_stream($in, $out);
    fclose($in);
    fclose($out);
    clearstatcache(true, $part);
    return (int)filesize($part);
}

/** Verifica que este completa y devuelve [ruta_temporal, info]. El llamador mueve el archivo. */
function subida_finalizar(string $id): array
{
    $info = subida_info($id);
    $part = SUBIDA_TMP . "/$id.part";
    clearstatcache(true, $part);
    if (filesize($part) !== (int)$info['tamano']) {
        throw new InvalidArgumentException('La subida está incompleta');
    }
    @unlink(SUBIDA_TMP . "/$id.json");
    return [$part, $info];
}

function subida_cancelar(string $id): void
{
    if (preg_match('/^[a-f0-9]{32}$/', $id)) {
        @unlink(SUBIDA_TMP . "/$id.json");
        @unlink(SUBIDA_TMP . "/$id.part");
    }
}

function subida_limpiar_viejas(): void
{
    foreach (glob(SUBIDA_TMP . '/*.{json,part}', GLOB_BRACE) ?: [] as $f) {
        if (filemtime($f) < time() - 86400) {
            @unlink($f);
        }
    }
}

/** Guarda una imagen subida (portada/banner/miniatura) validando su firma. Devuelve el nombre final. */
function guardar_imagen_subida(array $file, string $dir, string $base, int $max = 8 * 1024 * 1024): string
{
    if (($file['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'] ?? '')) {
        throw new RuntimeException('La imagen no llegó bien');
    }
    if ((int)$file['size'] > $max) {
        throw new InvalidArgumentException('La imagen supera ' . bytes_legibles($max));
    }
    $ext = tipo_imagen_real($file['tmp_name']);
    if ($ext === null) {
        throw new InvalidArgumentException('El archivo no es una imagen válida (jpg, png, webp o gif)');
    }
    asegurar_dir($dir);
    foreach (glob("$dir/$base.*") ?: [] as $viejo) {
        @unlink($viejo);
    }
    $nombre = "$base.$ext";
    if (!move_uploaded_file($file['tmp_name'], "$dir/$nombre")) {
        throw new RuntimeException('No se pudo guardar la imagen');
    }
    return $nombre;
}
