import { DeliveryMethod } from "@shopify/shopify-api";

export const webhooks = {
  ORDERS_CREATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks/orders/create",
  },
  ORDERS_UPDATED: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks/orders/update",
  },
  DRAFT_ORDERS_CREATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks/draft-orders/create",
  },
  DRAFT_ORDERS_UPDATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks/draft-orders/update",
  },
};