import { authenticate } from "../shopify.server";
import { syncToTrello } from "../utils/syncTrelo.server";
import prisma from "../db.server";

export const action = async ({ request }: { request: Request }) => {
  const { payload, shop } = await authenticate.webhook(request);

  const draftOrderId = payload.admin_graphql_api_id;
  if (!draftOrderId) return new Response("No ID");

  // 🕵️ LINK NEW ORDER ID: If draft order is completed, it provides the resulting order_id
  const linkedOrderId = payload.order_id 
    ? `gid://shopify/Order/${payload.order_id}` 
    : null;

  const session = await prisma.session.findFirst({
    where: { shop },
  });

  if (!session) return new Response("No session found");

  if (linkedOrderId) {
    console.log(`🔗 LINKING DRAFT ${draftOrderId} TO NEW ORDER ${linkedOrderId}`);
    // Update the database record before syncing
    await prisma.trelloSync.updateMany({
      where: { orderId: draftOrderId },
      data: { 
        orderId: linkedOrderId,
        status: "updated" 
      }
    });
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

  // Sync using the NEW order ID if it was just linked, otherwise use draft ID
  await syncToTrello(admin, linkedOrderId || draftOrderId, null, customerName);


  return new Response("OK");
};