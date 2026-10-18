const FIREBASE_DB = "https://ideo-dd376-default-rtdb.asia-southeast1.firebasedatabase.app";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(200).json({
      status: "online",
      service: "digitalxiao Pay2S Webhook Gateway",
      endpoint: "https://radai-nine.vercel.app/api/bank.js",
      ready: true
    });
  }

  try {
    let data = req.body;

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

    // 1. TRÍCH XUẤT THÔNG TIN GIAO DỊCH TỪ MẢNG TRANSACTIONS CỦA PAY2S
    let tx = data;
    if (Array.isArray(data.transactions) && data.transactions.length > 0) {
      tx = data.transactions[0];
    }

    // Lấy số tiền chuyển khoản
    const amount = parseInt(tx.transferAmount || tx.amount || data.transferAmount || data.amount || 0, 10);

    // Lấy nội dung chuyển khoản
    const content = tx.content || tx.description || tx.orderInfo || data.content || "";
    const rawSearch = `${content} ${JSON.stringify(data)}`;

    // 2. NHẬN DIỆN UID TÀI KHOẢN (HỖ TRỢ CẢ AETH_ LẪN AETH KHÔNG CÓ GẠCH DƯỚI DO ACB LỌC BỎ)
    const match = rawSearch.match(/AETH_?([A-Za-z0-9]{20,36})/i) || rawSearch.match(/AETH_?([A-Za-z0-9_-]+)/i);

    if (match && amount > 0) {
      let rawUid = match[1];

      // Tách bỏ các từ khóa đuôi do ngân hàng tự nối thêm (GD, ACB, timestamp...)
      const cleanParts = rawUid.split(/[\s_]+/);
      let userUid = cleanParts[0];

      // 3. XỬ LÝ CHỐNG CỘNG TRÙNG LẶP (IDEMPOTENCY)
      const transId = String(tx.id || tx.transactionNumber || data.orderId || `TX_${Date.now()}`);
      const orderCheckUrl = `${FIREBASE_DB}/aetheria_project/orders/${transId}.json`;

      const checkRes = await fetch(orderCheckUrl);
      const existingOrder = await checkRes.json();

      if (existingOrder && existingOrder.status === "SUCCESS") {
        return res.status(200).json({
          status: "success",
          message: "Giao dịch này đã được ghi nhận trước đó (bỏ qua trùng lặp)"
        });
      }

      // 4. CỘNG TOKEN VÀO FIREBASE (TỶ LỆ: 1 VNĐ = 1 TOKEN)
      const tokensToAdd = amount;
      const userTokenUrl = `${FIREBASE_DB}/aetheria_project/users/${userUid}/tokens.json`;

      const getRes = await fetch(userTokenUrl);
      const currentTokens = (await getRes.json()) || 0;
      const newBalance = Number(currentTokens) + tokensToAdd;

      await fetch(userTokenUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBalance)
      });

      // 5. GHI LỊCH SỬ GIAO DỊCH
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
      message: "Không tìm thấy mã định danh UID hoặc số tiền không hợp lệ",
      content_received: content,
      amount_received: amount
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "Lỗi xử lý Webhook: " + err.message
    });
  }
}
