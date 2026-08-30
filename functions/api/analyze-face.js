export async function onRequestPost(context) {
    // 1. Kiểm tra API Key từ Cloudflare Environment Variables
    const apiKey = context.env.GEMINI_API_KEY; 
    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: 'Chưa cấu hình GEMINI_API_KEY trên Cloudflare' }), 
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    try {
        // 2. Nhận dữ liệu gửi lên từ giao diện (glowmax.html)
        const body = await context.request.json();

        // 3. Gọi trực tiếp sang API của Gemini từ Serverless Function
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }
        );

        const data = await response.json();
        
        // 4. Trả kết quả về lại cho client
        return new Response(JSON.stringify(data), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }), 
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
