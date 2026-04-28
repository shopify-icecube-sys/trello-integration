import { authenticate } from "../shopify.server";
import { syncToTrello } from "../utils/syncTrelo.server";
import prisma from "../db.server";

export const action = async ({ request }: { request: Request }) => {
  const { payload, shop } = await authenticate.webhook(request);

  const orderId = payload.admin_graphql_api_id;
  const numericOrderId = payload.id;

  if (!orderId) return new Response("No ID");

  // 💰 PAYMENT STATUS CHECK: Only sync if order is PAID
  const financialStatus = payload.financial_status;
  if (financialStatus !== "paid") {
    console.log(`💰 ORDER ${payload.name} IS ${financialStatus.toUpperCase()}. SKIPPING TRELLO SYNC.`);
    return new Response("Not paid, skipping sync");
  }


  const session = await prisma.session.findFirst({
    where: { shop },
  });

  if (!session) return new Response("No session found");

  // 🕵️ REST FALLBACK: Get draft_order_id from REST API since webhook payload misses it
  let draftOrderId = null;
  
  // ⏳ Wait 2 seconds for Shopify DB to be ready and DraftOrder sync to finish
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const restRes = await fetch(

      `https://${shop}/admin/api/2025-01/orders/${numericOrderId}.json`,
      {
        headers: { "X-Shopify-Access-Token": session.accessToken || "" },
      }
    );
    const restData = await restRes.json();
    if (restData.order?.draft_order_id) {
      draftOrderId = `gid://shopify/DraftOrder/${restData.order.draft_order_id}`;
      console.log("🕵️ FOUND DRAFT ID VIA REST:", draftOrderId);
    }
  } catch (e) {
    console.error("❌ REST FETCH ERROR:", e);
  }


  const admin = {
    graphql: async (query: string) => {
      const response = await fetch(
        `https://${shop}/admin/api/2025-01/graphql.json`,
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

  await syncToTrello(admin, orderId, draftOrderId, customerName);


  return new Response("OK");
};