<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/sanitize.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    cpanel_send_json('error', 'Invalid request method.', 405);
}

$jsonPath = cpanel_data_dir() . '/bus_ratings.json';
$rows = [];
if (is_file($jsonPath)) {
    $decoded = json_decode(file_get_contents($jsonPath) ?: '[]', true);
    if (is_array($decoded)) {
        $rows = $decoded;
    }
}

$public = [];
foreach ($rows as $row) {
    if (!is_array($row)) {
        continue;
    }
    $public[] = cpanel_sanitize_public_record($row);
}

usort($public, static function (array $a, array $b): int {
    $ta = strtotime((string) ($a['start_timestamp'] ?? ''));
    $tb = strtotime((string) ($b['start_timestamp'] ?? ''));
    return $tb <=> $ta;
});

if (count($public) > 500) {
    $public = array_slice($public, 0, 500);
}

echo json_encode($public, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
