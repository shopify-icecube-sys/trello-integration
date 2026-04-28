import { authenticate } from "../shopify.server";
import { syncToTrello } from "../utils/syncTrelo.server";
import prisma from "../db.server";

export const action = async ({ request }: { request: Request }) => {
  const { payload } = await authenticate.webhook(request);

  const orderId = payload.admin_graphql_api_id;
  if (!orderId) return new Response("No ID");

  // 💰 PAYMENT STATUS CHECK: Only sync if order is PAID
  const financialStatus = payload.financial_status;
  if (financialStatus !== "paid") {
    console.log(`💰 ORDER UPDATE: ${payload.name} IS ${financialStatus.toUpperCase()}. SKIPPING TRELLO SYNC.`);
    return new Response("Not paid, skipping sync");
  }


  const shopDomain = request.headers.get("X-Shopify-Shop-Domain");
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

  await syncToTrello(admin, orderId);

  return new Response("OK");
};