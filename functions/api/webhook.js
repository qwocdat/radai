// Cloudflare Pages Function: Xử lý Webhook cộng tiền theo Tên Tài Khoản
// Lưu trữ biến động số dư theo dạng: { "USERNAME": số_tiền_tích_lũy }
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

    // 1. FRONT-END GỌI LẤY SỐ DƯ THEO TÊN USER (GET /api/webhook?user=USERNAME)
    if (request.method === 'GET') {
        const username = (url.searchParams.get('user') || '').toUpperCase().trim();
        
        if (!username) {
            return new Response(JSON.stringify({ status: 'error', message: 'Thiếu tên tài khoản' }), {
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

    // 2. SEPAY BẮN DỮ LIỆU VỀ (POST /api/webhook)
    if (request.method === 'POST') {
        try {
            const data = await request.json();
            const transferAmount = parseFloat(data.transferAmount || data.amountIn || 0);
            const content = (data.content || '').toUpperCase();

            if (transferAmount > 0 && content) {
                // Tách lấy Tên tài khoản từ nội dung chuyển khoản
                // Cú pháp ngân hàng: "NAP <TENTAIKHOAN>" hoặc chứa tên user trực tiếp
                // Ví dụ: "NAP DIGITALSMOD", "SEQR NAP DIGITALSMOD TKPDGS"
                
                // Thuật toán bóc tách tên user: tìm từ đứng sau chữ "NAP" hoặc lấy từ khóa phù hợp
                let extractedUser = "";
                const match = content.match(/NAP\s+([A-Z0-9_]+)/);

                if (match && match[1]) {
                    extractedUser = match[1];
                } else if (content.includes("DIGITALSMOD")) {
                    extractedUser = "DIGITALSMOD";
                }

                if (extractedUser) {
                    // Cộng tiền vào tài khoản tương ứng
                    userBalances[extractedUser] = (userBalances[extractedUser] || 0) + transferAmount;
                    console.log(`[SEPAY] Cộng thành công +${transferAmount} VNĐ cho tài khoản: ${extractedUser}`);
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
