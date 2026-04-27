import prisma from "../db.server";
import { getOrderMetafield } from "./shopify.server";
import { getPreviousDayFormatted, getTodayFormatted, getNextDayFormatted } from "./date.server";
import { getOrCreateList, createCard, updateCard, getBoardCustomFields, updateCustomField } from "./trello.server";

// Cache for Custom Field IDs
let customFieldCache: Record<string, string> | null = null;

async function getTrelloFieldIds() {
  if (customFieldCache) return customFieldCache;
  try {
    const fields = await getBoardCustomFields();
    const map: Record<string, string> = {};
    fields.forEach((f: any) => {
      const fieldName = f.name.toLowerCase();
      if (fieldName.includes("weight")) map.weight = f.id;
      if (fieldName.includes("postcode")) map.postcode = f.id;
      if (fieldName.includes("delivery date")) map.deliveryDate = f.id;
    });
    customFieldCache = map;
    return map;
  } catch (e) {
    console.error("❌ Failed to fetch Trello field IDs:", e);
    return {};
  }
}

export async function syncToTrello(admin: any, orderId: string, providedDraftOrderId: string | null = null, customerNameFromPayload: string | null = null) {
  console.log("⚡ SYNC START:", orderId);

  // 🚨 Prevent duplicate processing
  const lockKey = `LOCK_${orderId}`;
  if ((global as any)[lockKey]) {
    console.log("🛑 DUPLICATE BLOCK:", orderId);
    return;
  }
  (global as any)[lockKey] = true;

  try {
    let { name, customerName, deliveryDate, weight, postcode } = await getOrderMetafield(admin, orderId);

    if (!name) {
      console.error("❌ Could find Name for:", orderId);
      return;
    }

    // Use name from payload if GraphQL failed due to permissions
    const finalCustomerName = customerNameFromPayload || customerName;

    // FALLBACK: If delivery date is missing on Order, check the Draft Order
    if (!deliveryDate && providedDraftOrderId) {
      console.log("🔍 Date missing on Order, checking Draft Order:", providedDraftOrderId);
      const draftData = await getOrderMetafield(admin, providedDraftOrderId);
      deliveryDate = draftData.deliveryDate;
      if (!weight) weight = draftData.weight;
      if (!postcode) postcode = draftData.postcode;
    }

    // ✨ CUSTOM CARD TITLE: "Billy Fisher #1034"
    const cardTitle = finalCustomerName ? `${finalCustomerName} ${name}` : name;
    
    // 🚀 SAME DAY LOGIC
    const todayStr = new Date().toISOString().split('T')[0];
    const isSameDay = deliveryDate === todayStr;
    let finalDeliveryDateField = deliveryDate;

    console.log(`📦 Order: ${cardTitle}, Delivery Date: ${deliveryDate}, Weight: ${weight}, Postcode: ${postcode}`);

    if (!deliveryDate) {
      console.warn("⚠️ NO DATE FOUND. PLEASE LINK METAFIELD DEFINITIONS IN SHOPIFY ADMIN.");
    }

    let listId = null;
    let listName = "Hold";

    if (deliveryDate) {
      if (isSameDay) {
        console.log("🚀 SAME DAY CASE: Staying in TODAY list, setting field to TOMORROW");
        listName = getTodayFormatted();
        finalDeliveryDateField = getNextDayFormatted(deliveryDate);
      } else {
        listName = getPreviousDayFormatted(deliveryDate);
      }
      listId = await getOrCreateList(listName);
    } else {
      console.log("⏸️ No date, putting card in 'Hold' list.");
      listId = await getOrCreateList("Hold");
    }

    // 📝 CUSTOM DESCRIPTION
    const orderNumberOnly = name.replace("#", "");
    const cardDesc = `${orderNumberOnly} - Delivery Due Date: ${deliveryDate || "N/A"} -`;


    // 🔍 Find existing card
    const existing = await prisma.trelloSync.findFirst({
      where: {
        OR: [
          { orderId: orderId },
          { orderId: providedDraftOrderId || "none" },
          { orderName: name }
        ]
      }
    });

    let targetCardId = null;

    if (existing?.cardId) {
      const cardLock = `LOCK_CARD_${existing.cardId}`;
      if ((global as any)[cardLock]) {
        console.log("🛑 CARD LOCK ACTIVE, SKIPPING:", existing.cardId);
        return;
      }
      (global as any)[cardLock] = true;

      try {
        console.log(`🔄 UPDATING EXISTING CARD [${cardTitle}]`);
        await updateCard(existing.cardId, {
          name: cardTitle,
          idList: listId || undefined,
          desc: cardDesc
        });

        await prisma.trelloSync.update({
          where: { id: existing.id },
          data: { 
            orderId, 
            orderName: name,
            lastUpdatedAt: new Date(),
            status: "updated" 
          },
        });
        targetCardId = existing.cardId;
        console.log("✅ CARD MOVED & DB UPDATED");
      } finally {
        delete (global as any)[cardLock];
      }
    } else {
      console.log(`🆕 CREATING NEW CARD [${cardTitle}]`);
      const card = await createCard(listId, cardTitle, cardDesc);
      
      await prisma.trelloSync.create({
        data: {
          orderId,
          orderName: name,
          cardId: card.id,
          status: "done",
        },
      });
      targetCardId = card.id;
      console.log("✅ NEW CARD CREATED");
    }

    // 🛠️ SYNC CUSTOM FIELDS
    if (targetCardId) {
      const fieldIds = await getTrelloFieldIds();
      
      // ⚖️ Weight
      if (fieldIds.weight && weight) {
        const weightInKg = weight / 1000;
        console.log(`⚖️ Syncing Weight: ${weightInKg} kg`);
        await updateCustomField(targetCardId, fieldIds.weight, weightInKg, 'number');
      }
      
      // 📍 Postcode
      if (fieldIds.postcode && postcode) {
        console.log("📍 Syncing Postcode:", postcode);
        await updateCustomField(targetCardId, fieldIds.postcode, postcode, 'text');
      }

      // 📅 Delivery Date Custom Field
      if (fieldIds.deliveryDate && finalDeliveryDateField) {
        console.log("📅 Syncing Delivery Date Field:", finalDeliveryDateField);
        await updateCustomField(targetCardId, fieldIds.deliveryDate, finalDeliveryDateField, 'text');
      }

    }

  } catch (err) {
    console.error("❌ SYNC ERROR:", err);
  } finally {
    delete (global as any)[lockKey];
  }
}