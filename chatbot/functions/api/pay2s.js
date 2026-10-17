export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const targetEndpoint = body.endpoint || "https://payment.pay2s.vn/v1/gateway/api/create";
    
    // Loại bỏ thuộc tính endpoint nội bộ trước khi chuyển tiếp dữ liệu sang Pay2S
    const { endpoint, ...pay2sPayload } = body;

    const response = await fetch(targetEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      body: JSON.stringify(pay2sPayload)
    });

    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ message: "Lỗi Proxy Cloudflare: " + err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
