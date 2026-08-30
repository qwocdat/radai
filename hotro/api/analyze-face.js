export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ 
            error: 'Chưa cấu hình GEMINI_API_KEY trong Cài đặt (Environment Variables) trên Vercel.' 
        });
    }

    try {
        const { parts } = req.body;

        if (!parts || !Array.isArray(parts) || parts.length === 0) {
            return res.status(400).json({ error: 'Dữ liệu ảnh gửi lên không hợp lệ.' });
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                contents: [{ parts: parts }],
                generationConfig: { 
                    response_mime_type: "application/json",
                    maxOutputTokens: 2048
                }
            })
        });

        // Đọc dữ liệu dưới dạng Text để kiểm tra an toàn trước khi Parse
        const rawTextResponse = await response.text();

        if (!rawTextResponse) {
            return res.status(500).json({ error: 'Máy chủ Google trả về phản hồi rỗng.' });
        }

        let data;
        try {
            data = JSON.parse(rawTextResponse);
        } catch (e) {
            return res.status(500).json({ error: 'Không thể đọc phản hồi từ AI (Phản hồi không đúng định dạng JSON).' });
        }

        if (!response.ok) {
            return res.status(response.status).json({
                error: data.error?.message || 'Lỗi xác thực hoặc vượt quá giới hạn API từ Google.'
            });
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error('Lỗi Backend Proxy:', error);
        return res.status(500).json({ error: 'Lỗi Server: ' + error.message });
    }
}
