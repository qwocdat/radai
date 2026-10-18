const FIREBASE_DB = "https://ideo-dd376-default-rtdb.asia-southeast1.firebasedatabase.app";

export default async function handler(req, res) {
  // 1. Cấu hình Headers và xử lý CORS Preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 2. Chỉ chấp nhận phương thức POST từ Webhook Pay2S
  if (req.method !== "POST") {
    return res.status(200).json({
      status: "online",
      message: "Webhook endpoint Vercel đang hoạt động sẵn sàng nhận tín hiệu Pay2S"
    });
  }

  try {
    let data = req.body;

    // Tự động phân tích nếu dữ liệu gửi dạng chuỗi thô
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (e) {
        const params = new URLSearchParams(data);
        data = Object.fromEntries(params.entries());
      }
    }

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ status: "error", message: "Dữ liệu Webhook rỗng" });
    }

    // 3. Trích xuất số tiền chuyển khoản
    const amount = parseInt(data.amount || data.transferAmount || data.price || 0, 10);

    // Ghép toàn bộ nội dung tìm kiếm mã định danh
    const rawSearch = `${data.orderId || ''} ${data.content || ''} ${data.description || ''} ${data.orderInfo || ''} ${JSON.stringify(data)}`;

    // 4. Bóc tách UID tài khoản (AETH_...)
    const match = rawSearch.match(/AETH_([A-Za-z0-9_-]+)/i);

    if (match && amount > 0) {
      let rawUid = match[1];
      const parts = rawUid.split("_");
      // Loại bỏ phần đuôi timestamp nếu có
      if (parts.length >= 2 && !isNaN(parts[parts.length - 1])) {
        parts.pop();
        rawUid = parts.join("_");
      }
      const userUid = rawUid;

      // 5. Kiểm tra chống cộng trùng lặp (Idempotency)
      const transId = data.orderId || data.transId || data.code || `TX_${Date.now()}`;
      const orderCheckUrl = `${FIREBASE_DB}/aetheria_project/orders/${transId}.json`;
      
      const checkRes = await fetch(orderCheckUrl);
      const existingOrder = await checkRes.json();

      if (existingOrder && existingOrder.status === "SUCCESS") {
        return res.status(200).json({
          status: "success",
          message: "Giao dịch này đã được ghi nhận trước đó (bỏ qua trùng lặp)"
        });
      }

      // 6. Tính toán và cộng Token vào Firebase (1 VNĐ = 1 Token)
      const tokensToAdd = amount;
      const userTokenUrl = `${FIREBASE_DB}/aetheria_project/users/${userUid}/tokens.json`;

      const getRes = await fetch(userTokenUrl);
      const currentTokens = (await getRes.json()) || 0;
      const newBalance = Number(currentTokens) + tokensToAdd;

      // Cập nhật số dư mới
      await fetch(userTokenUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBalance)
      });

      // 7. Đánh dấu giao dịch thành công và lưu lịch sử
      await fetch(orderCheckUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: transId,
          uid: userUid,
          amount: amount,
          tokensAdded: tokensToAdd,
          bank: "ACB",
          accountNo: "28233851",
          status: "SUCCESS",
          timestamp: Date.now()
        })
      });

      await fetch(`${FIREBASE_DB}/aetheria_project/recharge_logs.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: transId,
          uid: userUid,
          amountVND: amount,
          tokensAdded: tokensToAdd,
          bank: "ACB",
          accountNo: "28233851",
          time: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
          status: "THÀNH CÔNG"
        })
      });

      return res.status(200).json({
        status: "success",
        message: "Xác nhận nạp tiền và cộng Token thành công",
        uid: userUid,
        added: tokensToAdd,
        newBalance: newBalance
      });
    }

    return res.status(200).json({
      status: "ignored",
      message: "Không tìm thấy mã định danh UID hoặc số tiền không hợp lệ"
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "Lỗi xử lý Webhook: " + err.message
    });
  }
}
