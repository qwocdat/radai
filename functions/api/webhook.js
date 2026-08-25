let userBalances = {};

export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    // 1. FRONT-END GỌI LẤY SỐ DƯ TẢI TRANG
    if (request.method === 'GET') {
        const username = (url.searchParams.get('user') || '').toUpperCase().trim();
        
        // Nếu gõ thử trên trình duyệt không có param user
        if (!username) {
            return new Response(JSON.stringify({ 
                status: 'online', 
                message: 'Webhook API DigitalsMod đang hoạt động bình thường!' 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const balance = userBalances[username] || 0;

        return new Response(JSON.stringify({ 
            status: 'success', 
            user: username,
            balance: balance 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // 2. SEPAY BẮN DỮ LIỆU VỀ
    if (request.method === 'POST') {
        try {
            const data = await request.json();
            const transferAmount = parseFloat(data.transferAmount || data.amountIn || 0);
            const content = (data.content || '').toUpperCase();

            if (transferAmount > 0 && content) {
                let extractedUser = "";
                const match = content.match(/NAP\s+([A-Z0-9_]+)/);

                if (match && match[1]) {
                    extractedUser = match[1];
                } else if (content.includes("DIGITALSMOD")) {
                    extractedUser = "DIGITALSMOD";
                }

                if (extractedUser) {
                    userBalances[extractedUser] = (userBalances[extractedUser] || 0) + transferAmount;
                }
            }

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), { 
                status: 500, 
                headers: corsHeaders 
            });
        }
    }

    return new Response('Method Not Allowed', { status: 405 });
}
