export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.status(200).json({
            status: "success",
            message: "Webhook Bank API đang hoạt động bình thường!",
            time: new Date().toISOString()
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ status: "error", message: "Method Not Allowed" });
    }

    try {
        const data = req.body || {};
        const content = (data.content || data.description || '').toUpperCase().trim();
        const amount = parseFloat(data.transferAmount || data.accumulated || data.amount_in || 0);
        const transId = data.id || data.referenceCode || Date.now();
        const transferType = data.transferType || 'in';

        if (transferType !== 'in' || amount <= 0) {
            return res.status(200).json({ status: "ignored", reason: "Not money in" });
        }

        const FIREBASE_PROJECT_ID = "quocdat-396fe";
        const BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

        // 1. Kiểm tra đơn trùng
        const checkRes = await fetch(`${BASE_URL}/deposits/sepay_${transId}`);
        if (checkRes.status === 200) {
            return res.status(200).json({ status: "success", message: "Already processed" });
        }

        // 2. Lấy danh sách User từ Firestore
        const userRes = await fetch(`${BASE_URL}/users?pageSize=300`);
        if (!userRes.ok) throw new Error("Cannot fetch users");
        
        const userData = await userRes.json();
        const documents = userData.documents || [];

        // Sắp xếp danh sách user theo độ dài tên giảm dần (Ưu tiên tên dài như QUOCDATDV5 trước, tránh nhầm DAT)
        documents.sort((a, b) => {
            let nameA = (a.fields?.username?.stringValue || '').length;
            let nameB = (b.fields?.username?.stringValue || '').length;
            return nameB - nameA;
        });

        let targetUser = null;
        for (let doc of documents) {
            const fields = doc.fields || {};
            const username = fields.username ? fields.username.stringValue.toUpperCase().trim() : '';
            const email = fields.email ? fields.email.stringValue.toUpperCase().trim() : '';

            // Kiểm tra nội dung chuyển khoản có chứa username hoặc email không
            if ((username && content.includes(username)) || (email && content.includes(email))) {
                const docId = doc.name.split('/').pop();
                let currentBalance = 0;
                if (fields.balance) {
                    currentBalance = fields.balance.doubleValue !== undefined 
                        ? parseFloat(fields.balance.doubleValue) 
                        : parseInt(fields.balance.integerValue || 0);
                }
                targetUser = { id: docId, username: username || email, balance: currentBalance };
                break;
            }
        }

        // 3. Cộng tiền & Lưu lịch sử
        if (targetUser) {
            const newBalance = targetUser.balance + amount;

            await fetch(`${BASE_URL}/users/${targetUser.id}?updateMask.fieldPaths=balance`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: { balance: { doubleValue: newBalance } } })
            });

            await fetch(`${BASE_URL}/deposits/sepay_${transId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fields: {
                        id: { stringValue: `sepay_${transId}` },
                        user_id: { stringValue: targetUser.id },
                        username: { stringValue: targetUser.username },
                        amount: { doubleValue: amount },
                        payment_method: { stringValue: 'SePay Webhook Bank Vercel' },
                        status: { stringValue: 'success' },
                        created_at: { stringValue: new Date().toISOString() }
                    }
                })
            });

            return res.status(200).json({ status: "success", user: targetUser.username, added: amount });
        }

        return res.status(200).json({ status: "ignored", reason: "User not match" });

    } catch (err) {
        return res.status(500).json({ status: "error", message: err.message });
    }
}
