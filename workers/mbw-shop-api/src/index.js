export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return jsonResponse(
        {
          ok: true,
          service: "mbw-shop-api",
          message: "Mindo Bird Watching shop API is running"
        },
        200
      );
    }

    if (url.pathname === "/health") {
      return jsonResponse(
        {
          ok: true,
          status: "healthy"
        },
        200
      );
    }

    if (url.pathname === "/printify/shops") {
      return handlePrintifyShops(env);
    }

    return jsonResponse(
      {
        ok: false,
        error: "Not found"
      },
      404
    );
  }
};

async function handlePrintifyShops(env) {
  if (!env.PRINTIFY_API_TOKEN) {
    return jsonResponse(
      {
        ok: false,
        error: "PRINTIFY_API_TOKEN is not configured"
      },
      500
    );
  }

  try {
    const response = await fetch("https://api.printify.com/v1/shops.json", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.PRINTIFY_API_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return jsonResponse(
        {
          ok: false,
          error: "Printify API request failed",
          status: response.status,
          details: data
        },
        response.status
      );
    }

    return jsonResponse(
      {
        ok: true,
        shops: data
      },
      200
    );
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: "Unable to contact Printify",
        message: error.message
      },
      500
    );
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });
}
