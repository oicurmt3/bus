<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/sanitize.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    cpanel_send_json('error', 'Invalid request method.', 405);
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($origin !== '') {
    $originHost = parse_url($origin, PHP_URL_HOST);
    if ($originHost !== $host) {
        cpanel_send_json('error', 'Invalid request origin.', 403);
    }
}

$raw = file_get_contents('php://input');
if ($raw === false || trim($raw) === '') {
    cpanel_send_json('error', 'No data received.', 400);
}
if (strlen($raw) > MAX_SUBMISSION_BYTES) {
    cpanel_send_json('error', 'Submission is too large.', 413);
}

$input = json_decode($raw, true);
if (!is_array($input)) {
    cpanel_send_json('error', 'Invalid JSON data.', 400);
}

$payload = cpanel_validate_submission($input);
if ($payload === null) {
    cpanel_send_json('error', 'Invalid submission.', 400);
}

cpanel_assert_rate_limit();

$dataDir = cpanel_data_dir();
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0750, true);
}
$jsonPath = $dataDir . '/bus_ratings.json';

$ratings = [];
if (is_file($jsonPath)) {
    $existing = json_decode(file_get_contents($jsonPath) ?: '[]', true);
    if (is_array($existing)) {
        $ratings = $existing;
    }
}
$ratings[] = $payload;

$fp = fopen($jsonPath, 'c');
if ($fp === false) {
    cpanel_send_json('error', 'Server error: Could not open log file.', 500);
}
$ok = false;
if (flock($fp, LOCK_EX)) {
    ftruncate($fp, 0);
    $encoded = json_encode($ratings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($encoded !== false && fwrite($fp, $encoded) !== false) {
        fflush($fp);
        $ok = true;
    }
    flock($fp, LOCK_UN);
}
fclose($fp);

if (!$ok) {
    cpanel_send_json('error', 'Server error: Failed to write rating.', 500);
}

cpanel_send_json('success', 'Rating logged successfully.', 200);
