export async function getOrderMetafield(admin: any, id: string) {
  const isDraft = id.includes("DraftOrder");

  const query = isDraft
    ? `
      query {
        draftOrder(id: "${id}") {
          name
          totalWeight
          shippingAddress {
            zip
          }
          customer {
            firstName
            lastName
          }
          metafield(namespace: "custom", key: "delivery_due_date") {
            value
          }
        }
      }
    `
    : `
      query {
        order(id: "${id}") {
          name
          totalWeight
          shippingAddress {
            zip
          }
          customer {
            firstName
            lastName
          }
          m1: metafield(namespace: "custom", key: "delivery_due_date") { value }
        }
      }
    `;



  console.log("🔥 GRAPHQL QUERY:", query);

  const response = await admin.graphql(query);
  const data = await response.json();

  console.log("🔥 GRAPHQL RESPONSE:", JSON.stringify(data, null, 2));

  const node = isDraft ? data.data?.draftOrder : data.data?.order;

  if (!node) {
    console.error("❌ NODE NOT FOUND:", { isDraft, data });
    return { name: null, deliveryDate: null, customerName: "" };
  }

  const customerName = node.customer 
    ? `${node.customer.firstName || ""} ${node.customer.lastName || ""}`.trim()
    : "";

  return {
    name: node.name,
    customerName,
    deliveryDate: isDraft
      ? node.metafield?.value
      : node.m1?.value,
    weight: node.totalWeight || 0,
    postcode: node.shippingAddress?.zip || "",
  };


}