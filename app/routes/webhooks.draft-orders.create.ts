import { authenticate } from "../shopify.server";
import { syncToTrello } from "../utils/syncTrelo.server";
import prisma from "../db.server";

export const action = async ({ request }: { request: Request }) => {
  const { payload } = await authenticate.webhook(request);

  const orderId = payload.admin_graphql_api_id;

  console.log("🔥 WEBHOOK RECEIVED:", orderId);

  if (!orderId) return new Response("No ID");

  const shopDomain = request.headers.get("X-Shopify-Shop-Domain");
  console.log("🔥 SHOP DOMAIN:", shopDomain);

  if (!shopDomain) return new Response("No shop domain");

  const session = await prisma.session.findFirst({
    where: { shop: shopDomain },
  });

  if (!session) return new Response("No session found");

  const admin = {
    graphql: async (query: string) => {
      const response = await fetch(
        `https://${shopDomain}/admin/api/2025-01/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": session.accessToken || "",
          },
          body: JSON.stringify({ query }),
        }
      );
      return {
        json: async () => response.json(),
      };
    },
  };

  const customerName = payload.customer 
    ? `${payload.customer.first_name || ""} ${payload.customer.last_name || ""}`.trim()
    : null;

  try {
    await syncToTrello(admin, orderId, null, customerName);

  } catch (e) {
    console.error("WEBHOOK FAIL:", e);
  }

  return new Response("OK");
};