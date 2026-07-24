var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_mercadopago = require("mercadopago");
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "maestriagrill",
  appId: "1:390319087399:web:ab7e64855fe8c922669302",
  apiKey: "AIzaSyA-jag4s92VCAtmyZHbVZwHV6jPc5V9qNw",
  authDomain: "maestriagrill.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-remixcardpiopedi-c19002e5-a774-4fa4-b5c1-2ec6813226c9",
  storageBucket: "maestriagrill.firebasestorage.app",
  messagingSenderId: "390319087399",
  measurementId: "",
  oAuthClientId: "390319087399-1vpvn541fveirudlfsr4vac66kuml7nm.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// server.ts
var firebaseServerApp = (0, import_app.initializeApp)(firebase_applet_config_default, "server-app");
var db = (0, import_firestore.getFirestore)(firebaseServerApp, firebase_applet_config_default.firestoreDatabaseId);
var MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || "APP_USR-4612394528193802-072320-97e3710081e80df08135f600e23b1d04-493924237";
var mpClient = new import_mercadopago.MercadoPagoConfig({
  accessToken: MERCADOPAGO_ACCESS_TOKEN
});
var mpPayment = new import_mercadopago.Payment(mpClient);
var mpPreference = new import_mercadopago.Preference(mpClient);
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.use(import_express.default.urlencoded({ extended: true }));
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Maestria Grill Mercado Pago API" });
  });
  app.get("/api/mercadopago/config", (req, res) => {
    const publicKey = process.env.VITE_MERCADOPAGO_PUBLIC_KEY || "APP_USR-45e3bea4-d7ee-4847-af4b-251fba799c6f";
    res.json({
      publicKey,
      isProduction: !publicKey.startsWith("TEST-")
    });
  });
  app.post("/api/mercadopago/process-payment", async (req, res) => {
    try {
      const { formData, orderData } = req.body;
      if (!formData || !orderData) {
        return res.status(400).json({
          error: "Dados do pagamento e do pedido s\xE3o obrigat\xF3rios."
        });
      }
      const host = req.get("host") || "localhost:3000";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const appBaseUrl = process.env.APP_URL || `${protocol}://${host}`;
      const notificationUrl = `${appBaseUrl}/api/mercadopago/webhook`;
      const amount = Number(formData.transaction_amount || orderData.total);
      const email = formData.payer?.email || orderData.customerEmail || "cliente@maestriagrill.com";
      const firstName = formData.payer?.first_name || (orderData.customerName ? orderData.customerName.split(" ")[0] : "Cliente");
      const lastName = formData.payer?.last_name || (orderData.customerName ? orderData.customerName.split(" ").slice(1).join(" ") : "Maestria") || "Grill";
      const paymentBody = {
        transaction_amount: amount,
        token: formData.token,
        description: `Pedido #${orderData.id} - Maestria Grill`,
        payment_method_id: formData.payment_method_id,
        payer: {
          email,
          first_name: firstName,
          last_name: lastName,
          identification: formData.payer?.identification
        },
        installments: Number(formData.installments || 1),
        external_reference: String(orderData.id),
        notification_url: notificationUrl
      };
      if (formData.issuer_id) {
        paymentBody.issuer_id = String(formData.issuer_id);
      }
      console.log(`[Mercado Pago API] Criando pagamento para Pedido #${orderData.id}...`);
      const paymentResponse = await mpPayment.create({ body: paymentBody });
      console.log(
        `[Mercado Pago API] Resposta Pagamento #${paymentResponse.id}: Status ${paymentResponse.status}`
      );
      if (paymentResponse.status === "approved") {
        try {
          const orderRef = (0, import_firestore.doc)(db, "orders", String(orderData.id));
          await (0, import_firestore.updateDoc)(orderRef, {
            paymentStatus: "paid",
            statusPagamento: "pago",
            status: "pending",
            // Move to pending so restaurant can accept or refuse
            paidAt: (/* @__PURE__ */ new Date()).toISOString(),
            mercadopagoPaymentId: String(paymentResponse.id),
            mercadopagoStatus: paymentResponse.status,
            mercadopagoPaymentMethod: paymentResponse.payment_method_id
          });
          console.log(`[Firestore] Pedido #${orderData.id} pago! Status alterado para 'pending' (Aguardando aceite do restaurante).`);
        } catch (dbErr) {
          console.error(`[Firestore Error] Erro ao atualizar pedido #${orderData.id}:`, dbErr);
        }
      } else {
        try {
          const orderRef = (0, import_firestore.doc)(db, "orders", String(orderData.id));
          await (0, import_firestore.updateDoc)(orderRef, {
            mercadopagoPaymentId: String(paymentResponse.id),
            mercadopagoStatus: paymentResponse.status,
            mercadopagoPaymentMethod: paymentResponse.payment_method_id
          });
        } catch (dbErr) {
          console.error(`[Firestore Error] Erro ao vincular paymentId no pedido:`, dbErr);
        }
      }
      return res.json({
        success: true,
        status: paymentResponse.status,
        status_detail: paymentResponse.status_detail,
        id: paymentResponse.id,
        payment: paymentResponse
      });
    } catch (error) {
      console.error("[Mercado Pago API Error] Falha no processamento:", error);
      return res.status(500).json({
        error: "Erro ao processar pagamento com o Mercado Pago",
        details: error.message || error
      });
    }
  });
  app.post("/api/mercadopago/create-preference", async (req, res) => {
    try {
      const { orderData } = req.body;
      if (!orderData) {
        return res.status(400).json({ error: "Dados do pedido s\xE3o obrigat\xF3rios." });
      }
      const host = req.get("host") || "localhost:3000";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const appBaseUrl = process.env.APP_URL || `${protocol}://${host}`;
      const items = (orderData.items || []).map((item) => ({
        id: String(item.productId || "item"),
        title: item.productName || "Item do Pedido",
        unit_price: Number(item.price),
        quantity: Number(item.quantity),
        currency_id: "BRL"
      }));
      if (orderData.deliveryFee && orderData.deliveryFee > 0) {
        items.push({
          id: "delivery_fee",
          title: "Taxa de Entrega",
          unit_price: Number(orderData.deliveryFee),
          quantity: 1,
          currency_id: "BRL"
        });
      }
      const prefResponse = await mpPreference.create({
        body: {
          items,
          payer: {
            name: orderData.customerName || "Cliente",
            email: orderData.customerEmail || "cliente@maestriagrill.com"
          },
          external_reference: String(orderData.id),
          notification_url: `${appBaseUrl}/api/mercadopago/webhook`,
          back_urls: {
            success: `${appBaseUrl}/?orderId=${orderData.id}&payment=success`,
            failure: `${appBaseUrl}/?orderId=${orderData.id}&payment=failure`,
            pending: `${appBaseUrl}/?orderId=${orderData.id}&payment=pending`
          },
          auto_return: "approved"
        }
      });
      res.json({
        id: prefResponse.id,
        init_point: prefResponse.init_point,
        sandbox_init_point: prefResponse.sandbox_init_point
      });
    } catch (error) {
      console.error("[Mercado Pago Preference Error]:", error);
      res.status(500).json({
        error: "Erro ao criar prefer\xEAncia de pagamento",
        details: error.message || error
      });
    }
  });
  app.post("/api/mercadopago/webhook", async (req, res) => {
    try {
      console.log("[Mercado Pago Webhook Received]:", JSON.stringify(req.query), JSON.stringify(req.body));
      const topic = req.query.topic || req.query.type || req.body?.type || req.body?.topic;
      if (topic && topic !== "payment") {
        console.log(`[Mercado Pago Webhook] Ignorando notifica\xE7\xE3o de t\xF3pico '${topic}'.`);
        return res.status(200).send(`T\xF3pico '${topic}' recebido e ignorado.`);
      }
      const paymentId = req.query.id || req.query["data.id"] || req.body?.data?.id || (req.body?.type === "payment" ? req.body?.data?.id : null) || req.body?.id;
      if (!paymentId) {
        return res.status(200).send("Webhook recebido sem ID de pagamento.");
      }
      console.log(`[Mercado Pago Webhook] Consultando status do Pagamento #${paymentId}...`);
      let paymentInfo = null;
      try {
        paymentInfo = await mpPayment.get({ id: String(paymentId) });
      } catch (getErr) {
        if (getErr?.status === 404 || getErr?.error === "not_found" || getErr?.message?.includes("not_found")) {
          console.warn(`[Mercado Pago Webhook] Pagamento #${paymentId} n\xE3o encontrado no MP (pode ser evento de teste ou ordem).`);
          return res.status(200).send("Pagamento n\xE3o encontrado no MP.");
        }
        throw getErr;
      }
      if (paymentInfo && paymentInfo.external_reference) {
        const orderId = paymentInfo.external_reference;
        const status = paymentInfo.status;
        console.log(`[Mercado Pago Webhook] Pedido #${orderId} -> Status: ${status}`);
        const orderRef = (0, import_firestore.doc)(db, "orders", String(orderId));
        const orderSnap = await (0, import_firestore.getDoc)(orderRef);
        if (orderSnap.exists()) {
          const currentOrder = orderSnap.data();
          if (status === "approved") {
            await (0, import_firestore.updateDoc)(orderRef, {
              paymentStatus: "paid",
              statusPagamento: "pago",
              // Switch status to 'pending' when paid so restaurant can accept or refuse
              status: currentOrder.status === "awaiting_payment" ? "pending" : currentOrder.status,
              paidAt: (/* @__PURE__ */ new Date()).toISOString(),
              mercadopagoPaymentId: String(paymentId),
              mercadopagoStatus: status,
              mercadopagoPaymentMethod: paymentInfo.payment_method_id
            });
            console.log(`[Webhook Success] Pedido #${orderId} atualizado para 'PAGO' e enviado para o restaurante aceitar!`);
          } else {
            await (0, import_firestore.updateDoc)(orderRef, {
              mercadopagoPaymentId: String(paymentId),
              mercadopagoStatus: status,
              mercadopagoPaymentMethod: paymentInfo.payment_method_id
            });
          }
        } else {
          console.warn(`[Webhook Warning] Pedido #${orderId} n\xE3o encontrado no Firestore.`);
        }
      }
      return res.status(200).send("Webhook processado com sucesso.");
    } catch (error) {
      console.error("[Mercado Pago Webhook Error]:", error);
      return res.status(200).send("Erro interno ao processar webhook.");
    }
  });
  app.get("/api/mercadopago/payment-status/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!id || id === "null" || id === "undefined") {
        return res.status(400).json({ error: "ID do pagamento \xE9 obrigat\xF3rio" });
      }
      let paymentInfo = null;
      try {
        paymentInfo = await mpPayment.get({ id });
      } catch (getErr) {
        if (getErr?.status === 404 || getErr?.error === "not_found" || getErr?.message?.includes("not_found")) {
          return res.status(404).json({ status: "not_found", error: "Pagamento n\xE3o encontrado no Mercado Pago" });
        }
        throw getErr;
      }
      if (paymentInfo.status === "approved" && paymentInfo.external_reference) {
        const orderRef = (0, import_firestore.doc)(db, "orders", String(paymentInfo.external_reference));
        const orderSnap = await (0, import_firestore.getDoc)(orderRef);
        if (orderSnap.exists()) {
          const currentOrder = orderSnap.data();
          if (currentOrder.paymentStatus !== "paid") {
            await (0, import_firestore.updateDoc)(orderRef, {
              paymentStatus: "paid",
              statusPagamento: "pago",
              status: currentOrder.status === "awaiting_payment" ? "pending" : currentOrder.status,
              paidAt: (/* @__PURE__ */ new Date()).toISOString(),
              mercadopagoStatus: "approved"
            });
          }
        }
      }
      return res.json({
        id: paymentInfo.id,
        status: paymentInfo.status,
        status_detail: paymentInfo.status_detail,
        payment_method_id: paymentInfo.payment_method_id,
        external_reference: paymentInfo.external_reference
      });
    } catch (error) {
      console.error("[Mercado Pago Status Error]:", error);
      return res.status(500).json({ error: "Erro ao verificar status do pagamento" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Maestria Grill rodando na porta ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
