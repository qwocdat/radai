<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

// Xử lý phương thức GET (Khi mở trực tiếp trên trình duyệt)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "message" => "Webhook API đang hoạt động bình thường!",
        "time" => date('Y-m-d H:i:s')
    ]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// --- PHẦN XỬ LÝ DỮ LIỆU POST TỪ SEPAY BÊN DƯỚI ---
$inputData = file_get_contents("php://input");
$data = json_decode($inputData, true);

if (!$data) {
    echo json_encode(["status" => "error", "message" => "Empty data"]);
    exit();
}

$content = strtoupper(trim($data['content'] ?? $data['description'] ?? ''));
$amount = floatval($data['transferAmount'] ?? $data['accumulated'] ?? $data['amount_in'] ?? 0);
$transId = $data['id'] ?? $data['referenceCode'] ?? time();
$transferType = $data['transferType'] ?? 'in';

if ($transferType !== 'in' || $amount <= 0) {
    echo json_encode(["status" => "ignored", "reason" => "Not money in"]);
    exit();
}

$firebaseUrl = "https://firestore.googleapis.com/v1/projects/quocdat-396fe/databases/(default)/documents";

function makeCurl($url, $method = 'GET', $body = null) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    if ($body) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'data' => json_decode($res, true)];
}

// 1. Kiểm tra đơn trùng
$checkOrder = makeCurl($firebaseUrl . "/deposits/sepay_" . $transId);
if ($checkOrder['code'] === 200) {
    echo json_encode(["status" => "success", "message" => "Already processed"]);
    exit();
}

// 2. Tìm User trong Firestore
$usersRes = makeCurl($firebaseUrl . "/users?pageSize=300");
$documents = $usersRes['data']['documents'] ?? [];

$targetUser = null;
foreach ($documents as $doc) {
    $fields = $doc['fields'] ?? [];
    $username = strtoupper(trim($fields['username']['stringValue'] ?? ''));
    $email = strtoupper(trim($fields['email']['stringValue'] ?? ''));

    if (($username && strpos($content, $username) !== false) || ($email && strpos($content, $email) !== false)) {
        $pathParts = explode('/', $doc['name']);
        $docId = end($pathParts);
        $currentBalance = floatval($fields['balance']['doubleValue'] ?? $fields['balance']['integerValue'] ?? 0);
        $targetUser = ['id' => $docId, 'username' => $username ?: $email, 'balance' => $currentBalance];
        break;
    }
}

// 3. Cộng tiền & Lưu lịch sử
if ($targetUser) {
    $newBalance = $targetUser['balance'] + $amount;

    makeCurl($firebaseUrl . "/users/" . $targetUser['id'] . "?updateMask.fieldPaths=balance", "PATCH", [
        "fields" => ["balance" => ["doubleValue" => $newBalance]]
    ]);

    makeCurl($firebaseUrl . "/deposits/sepay_" . $transId, "PATCH", [
        "fields" => [
            "id" => ["stringValue" => "sepay_" . $transId],
            "user_id" => ["stringValue" => $targetUser['id']],
            "username" => ["stringValue" => $targetUser['username']],
            "amount" => ["doubleValue" => $amount],
            "payment_method" => ["stringValue" => "SePay Webhook PHP Vercel"],
            "status" => ["stringValue" => "success"],
            "created_at" => ["stringValue" => date('c')]
        ]
    ]);

    echo json_encode(["status" => "success", "user" => $targetUser['username'], "added" => $amount]);
} else {
    echo json_encode(["status" => "ignored", "reason" => "User not match"]);
}
?>
