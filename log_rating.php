<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Configuration
$jsonLogFilePath = __DIR__ . '/bus_ratings.json';
$csvLogFilePath = __DIR__ . '/bus_ratings.csv';

// Function to Send JSON Response
function sendJsonResponse($status, $message, $httpStatusCode = 200) {
    http_response_code($httpStatusCode);
    $response = ['status' => $status, 'message' => $message];
    echo json_encode($response);
    exit;
}

// Check Request Method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse('error', 'Invalid request method.', 405);
}

// Get & Decode JSON Data
$jsonPayload = file_get_contents('php://input');
if (empty($jsonPayload)) {
    sendJsonResponse('error', 'No data received.', 400);
}
$newRatingData = json_decode($jsonPayload, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    sendJsonResponse('error', 'Invalid JSON data: ' . json_last_error_msg(), 400);
}

// Add Server-Side Metadata
$dateTime = new DateTime('now', new DateTimeZone('Australia/Perth'));
$newRatingData['serverTimestamp'] = $dateTime->format('d/m/Y, h:i A');
$newRatingData['ipAddress'] = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';

// Remove sensitive fields before logging (keeping comments now)
unset($newRatingData['user_name']);
unset($newRatingData['user_phone']);

// JSON Logging
if (file_exists($jsonLogFilePath) && (!is_readable($jsonLogFilePath) || !is_writable($jsonLogFilePath))) {
    error_log("PHP Error: JSON log file not readable/writable: " . $jsonLogFilePath);
    sendJsonResponse('error', 'Server config error: Cannot read/write JSON log file.', 500);
}

if (file_exists($jsonLogFilePath)) {
    $existingJson = file_get_contents($jsonLogFilePath);
    if (!empty($existingJson)) {
        $ratings = json_decode($existingJson, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($ratings)) {
            error_log("PHP Warning: JSON log file corrupted. Resetting. Error: " . json_last_error_msg());
            $ratings = [];
        }
    } else {
        $ratings = [];
    }
} else {
    $ratings = [];
}
$ratings[] = $newRatingData;

$fileHandle = fopen($jsonLogFilePath, 'c');
if ($fileHandle === false) {
    error_log("PHP Error: Could not open JSON log file for writing: " . $jsonLogFilePath);
    sendJsonResponse('error', 'Server error: Could not open JSON log file.', 500);
}

$logWriteSuccess = false;
if (flock($fileHandle, LOCK_EX)) {
    ftruncate($fileHandle, 0);
    $updatedJson = json_encode($ratings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($updatedJson !== false && fwrite($fileHandle, $updatedJson) !== false) {
        fflush($fileHandle);
        $logWriteSuccess = true;
    } else {
        error_log("PHP Error: Failed to write or encode JSON: " . $jsonLogFilePath . " Error: " . json_last_error_msg());
    }
    flock($fileHandle, LOCK_UN);
} else {
    error_log("PHP Warning: Could not lock JSON file: " . $jsonLogFilePath);
}
fclose($fileHandle);

if (!$logWriteSuccess) {
    sendJsonResponse('error', 'Server error: Failed to write rating to JSON log.', 500);
}

// CSV Logging
$csvFields = [
    'bus_number', 'route_number', 'destination', 'start_point', 'start_latitude', 'start_longitude', 'start_timestamp',
    'overall_experience', 'braking_quality', 'acceleration_quality', 'cornering_quality', 'cleanliness', 'crowdedness',
    'driver_conduct', 'spare_1', 'spare_2', 'spare_3', 'spare_4', 'comments', 'serverTimestamp', 'ipAddress'
];
$csvHandle = fopen($csvLogFilePath, 'a');
if ($csvHandle === false) {
    error_log("PHP Error: Could not open CSV log file for writing: " . $csvLogFilePath);
} else {
    if (!file_exists($csvLogFilePath) || filesize($csvLogFilePath) == 0) {
        fputcsv($csvHandle, $csvFields);
    }
    if (flock($csvHandle, LOCK_EX)) {
        $csvRow = [];
        foreach ($csvFields as $field) {
            if (isset($newRatingData[$field])) {
                $value = $newRatingData[$field];
                if (is_array($value)) {
                    $csvRow[] = implode(', ', array_map(fn($v) => $v['value'], $value));
                } else {
                    $csvRow[] = $value;
                }
            } else {
                $csvRow[] = '';
            }
        }
        fputcsv($csvHandle, $csvRow);
        flock($csvHandle, LOCK_UN);
    } else {
        error_log("PHP Warning: Could not lock CSV file: " . $csvLogFilePath);
    }
    fclose($csvHandle);
}

// Send Response
sendJsonResponse('success', 'Rating logged successfully.', 200);
?>