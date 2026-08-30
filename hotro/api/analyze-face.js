export default async function handler(req, res) {
    // 1. Cấu hình CORS để tránh bị lỗi Cross-Origin khi gọi API
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
    res.setHeader('Content-Type', 'application/json');

    // Xử lý request OPTIONS preflight từ trình duyệt
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

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
        const { parts } = req.body || {};

        if (!parts || !Array.isArray(parts) || parts.length === 0) {
            return res.status(400).json({ error: 'Dữ liệu ảnh gửi lên không hợp lệ.' });
        }

        // Gọi Google Gemini API với model gemini-3.6-flash
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: parts }],
                generationConfig: { 
                    response_mime_type: "application/json",
                    maxOutputTokens: 2048
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: data.error?.message || 'Lỗi từ dịch vụ AI Google.'
            });
        }

        return res.status(200).json(data);

    } catch (error) {
        console.error('Lỗi Backend Proxy:', error);
        return res.status(500).json({ error: 'Lỗi Server: ' + error.message });
    }
}
