<?php
declare(strict_types=1);

const MAX_SUBMISSION_BYTES = 16384;
const RATE_LIMIT_WINDOW_SEC = 3600;
const RATE_LIMIT_MAX = 20;

function cpanel_send_json(string $status, string $message, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode(['status' => $status, 'message' => $message], JSON_UNESCAPED_SLASHES);
    exit;
}

function cpanel_clean_string($value, int $maxLen): string
{
    if ($value === null || $value === '') {
        return '';
    }
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', trim((string) $value));
    if (strlen($text) > $maxLen) {
        $text = substr($text, 0, $maxLen);
    }
    return $text;
}

function cpanel_round_coord($value): string
{
    if ($value === null || $value === '') {
        return '';
    }
    if (!is_numeric($value)) {
        return cpanel_clean_string($value, 24);
    }
    return number_format((float) $value, 2, '.', '');
}

function cpanel_sanitize_rating_array(string $field, $raw): ?array
{
    if ($raw === null || $raw === '') {
        return null;
    }
    if (!is_array($raw) || count($raw) > 4) {
        return null;
    }
    $out = [];
    foreach ($raw as $item) {
        if (!is_array($item)) {
            return null;
        }
        $ratingVal = cpanel_clean_string($item['value'] ?? '', 3);
        $ratingText = cpanel_clean_string($item['text'] ?? '', 80);
        if (!preg_match('/^\d{1,2}$/', $ratingVal) || $ratingText === '') {
            return null;
        }
        $out[] = ['value' => $ratingVal, 'text' => $ratingText];
    }
    return $out;
}

function cpanel_validate_submission(array $input): ?array
{
    $ratingFields = [
        'overall_experience', 'braking_quality', 'acceleration_quality', 'cornering_quality',
        'cleanliness', 'crowdedness', 'driver_conduct', 'passenger_conduct',
        'spare_1', 'spare_2', 'spare_3', 'spare_4',
    ];
    $stringFields = [
        'bus_number' => 16,
        'route_number' => 16,
        'destination' => 120,
        'start_point' => 200,
        'start_latitude' => 24,
        'start_longitude' => 24,
        'start_timestamp' => 40,
        'comments' => 500,
        'clientSubmissionTimestamp' => 40,
    ];

    if (count($input) > 24) {
        return null;
    }

    $payload = [];
    foreach ($stringFields as $field => $max) {
        if (!empty($input[$field])) {
            $payload[$field] = cpanel_clean_string($input[$field], $max);
        }
    }

    if (!empty($payload['start_latitude']) && !preg_match('/^-?\d{1,3}(\.\d{1,8})?$/', $payload['start_latitude'])) {
        return null;
    }
    if (!empty($payload['start_longitude']) && !preg_match('/^-?\d{1,3}(\.\d{1,8})?$/', $payload['start_longitude'])) {
        return null;
    }

    foreach ($ratingFields as $field) {
        if (!array_key_exists($field, $input)) {
            continue;
        }
        $sanitized = cpanel_sanitize_rating_array($field, $input[$field]);
        if ($sanitized === null) {
            return null;
        }
        if ($sanitized !== []) {
            $payload[$field] = $sanitized;
        }
    }

    if (empty($payload['route_number']) || empty($payload['destination'])) {
        return null;
    }
    if (empty($payload['overall_experience'])) {
        return null;
    }

    if (!empty($payload['start_latitude'])) {
        $payload['start_latitude'] = cpanel_round_coord($payload['start_latitude']);
    }
    if (!empty($payload['start_longitude'])) {
        $payload['start_longitude'] = cpanel_round_coord($payload['start_longitude']);
    }

    $dateTime = new DateTime('now', new DateTimeZone('Australia/Perth'));
    $payload['serverTimestamp'] = $dateTime->format('d/m/Y, h:i A');

    return $payload;
}

function cpanel_sanitize_public_record(array $row): array
{
    unset($row['ipAddress'], $row['user_name'], $row['user_phone']);

    $ratingFields = [
        'overall_experience', 'braking_quality', 'acceleration_quality', 'cornering_quality',
        'cleanliness', 'crowdedness', 'driver_conduct', 'passenger_conduct',
        'spare_1', 'spare_2', 'spare_3', 'spare_4',
    ];
    $stringFields = [
        'bus_number' => 16,
        'route_number' => 16,
        'destination' => 120,
        'start_point' => 200,
        'start_timestamp' => 40,
        'comments' => 500,
        'clientSubmissionTimestamp' => 40,
        'serverTimestamp' => 40,
    ];

    $out = [];
    foreach ($stringFields as $field => $max) {
        if (!empty($row[$field])) {
            $out[$field] = cpanel_clean_string($row[$field], $max);
        }
    }
    if (!empty($row['start_latitude'])) {
        $out['start_latitude'] = cpanel_round_coord($row['start_latitude']);
    }
    if (!empty($row['start_longitude'])) {
        $out['start_longitude'] = cpanel_round_coord($row['start_longitude']);
    }
    foreach ($ratingFields as $field) {
        if (!isset($row[$field])) {
            continue;
        }
        $sanitized = cpanel_sanitize_rating_array($field, $row[$field]);
        if ($sanitized) {
            $out[$field] = $sanitized;
        }
    }
    return $out;
}

function cpanel_data_dir(): string
{
    return dirname(__DIR__, 2) . '/data';
}

function cpanel_client_ip_hash(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    return hash('sha256', $ip);
}

function cpanel_assert_rate_limit(): void
{
    $dir = cpanel_data_dir();
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
    $path = $dir . '/rate_limit.json';
    $hash = cpanel_client_ip_hash();
    $now = time();
    $windowStart = $now - RATE_LIMIT_WINDOW_SEC;
    $entries = [];

    if (is_file($path)) {
        $raw = file_get_contents($path);
        $decoded = json_decode($raw ?: '[]', true);
        if (is_array($decoded)) {
            $entries = $decoded;
        }
    }

    $entries = array_values(array_filter($entries, static function ($item) use ($windowStart) {
        return is_array($item)
            && isset($item['ip_hash'], $item['submitted_at'])
            && (int) $item['submitted_at'] > $windowStart;
    }));

    $count = 0;
    foreach ($entries as $item) {
        if (($item['ip_hash'] ?? '') === $hash) {
            $count++;
        }
    }
    if ($count >= RATE_LIMIT_MAX) {
        cpanel_send_json('error', 'Too many submissions. Try again later.', 429);
    }

    $entries[] = ['ip_hash' => $hash, 'submitted_at' => $now];
    $fp = fopen($path, 'c+');
    if ($fp && flock($fp, LOCK_EX)) {
        ftruncate($fp, 0);
        fwrite($fp, json_encode($entries, JSON_UNESCAPED_SLASHES));
        fflush($fp);
        flock($fp, LOCK_UN);
    }
    if ($fp) {
        fclose($fp);
    }
}
