import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

// Initialize Firebase App for server-side order updates
const firebaseServerApp = initializeApp(firebaseConfig, 'server-app');
const db = getFirestore(firebaseServerApp, firebaseConfig.firestoreDatabaseId);

// Environment setup for Mercado Pago Credentials
const MERCADOPAGO_ACCESS_TOKEN =
  process.env.MERCADOPAGO_ACCESS_TOKEN ||
  'APP_USR-4612394528193802-072320-97e3710081e80df08135f600e23b1d04-493924237';

const MERCADOPAGO_WEBHOOK_SECRET =
  process.env.MERCADOPAGO_WEBHOOK_SECRET ||
  'f155fb42eb7fd544095dd9e43c10c56f1a39612f53160566798f6535ee555b72';

const mpClient = new MercadoPagoConfig({
  accessToken: MERCADOPAGO_ACCESS_TOKEN,
});
const mpPayment = new Payment(mpClient);
const mpPreference = new Preference(mpClient);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Maestria Grill Mercado Pago API' });
  });

  // GET Mercado Pago Config Info
  app.get('/api/mercadopago/config', (req, res) => {
    const publicKey =
      process.env.VITE_MERCADOPAGO_PUBLIC_KEY ||
      'APP_USR-45e3bea4-d7ee-4847-af4b-251fba799c6f';
    res.json({
      publicKey,
      isProduction: !publicKey.startsWith('TEST-'),
    });
  });

  // POST /api/mercadopago/process-payment (Checkout Bricks Backend Endpoint)
  app.post('/api/mercadopago/process-payment', async (req, res) => {
    try {
      const { formData, orderData } = req.body;

      if (!formData || !orderData) {
        return res.status(400).json({
          error: 'Dados do pagamento e do pedido são obrigatórios.',
        });
      }

      const rawAppUrl = process.env.APP_URL;
      const isPlaceholderAppUrl = !rawAppUrl || rawAppUrl === 'MY_APP_URL';
      const host = req.headers['x-forwarded-host'] || req.get('host') || 'sheikcoin.site';
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const appBaseUrl = (!isPlaceholderAppUrl ? rawAppUrl : `${protocol}://${host}`).replace(/\/$/, '');
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

      const amount = Number(formData.transaction_amount || orderData.total);
      const email =
        formData.payer?.email ||
        orderData.customerEmail ||
        'cliente@maestriagrill.com';

      const firstName =
        formData.payer?.first_name ||
        (orderData.customerName ? orderData.customerName.split(' ')[0] : 'Cliente');
      const lastName =
        formData.payer?.last_name ||
        (orderData.customerName ? orderData.customerName.split(' ').slice(1).join(' ') : 'Maestria') ||
        'Grill';

      const paymentBody: any = {
        transaction_amount: amount,
        token: formData.token,
        description: `Pedido #${orderData.id} - Maestria Grill`,
        payment_method_id: formData.payment_method_id,
        payer: {
          email,
          first_name: firstName,
          last_name: lastName,
          identification: formData.payer?.identification,
        },
        installments: Number(formData.installments || 1),
        external_reference: String(orderData.id),
      };

      if (!isLocalhost && !appBaseUrl.includes('localhost')) {
        paymentBody.notification_url = `${appBaseUrl}/api/mercadopago/webhook`;
      }

      if (formData.issuer_id) {
        paymentBody.issuer_id = String(formData.issuer_id);
      }

      console.log(`[Mercado Pago API] Criando pagamento para Pedido #${orderData.id}...`);
      const paymentResponse = await mpPayment.create({ body: paymentBody });

      console.log(
        `[Mercado Pago API] Resposta Pagamento #${paymentResponse.id}: Status ${paymentResponse.status}`
      );

      // If approved immediately (e.g. Credit/Debit Card or Mercado Pago Balance)
      if (paymentResponse.status === 'approved') {
        try {
          const orderRef = doc(db, 'orders', String(orderData.id));
          await updateDoc(orderRef, {
            paymentStatus: 'paid',
            statusPagamento: 'pago',
            status: 'pending', // Move to pending so restaurant can accept or refuse
            paidAt: new Date().toISOString(),
            mercadopagoPaymentId: String(paymentResponse.id),
            mercadopagoStatus: paymentResponse.status,
            mercadopagoPaymentMethod: paymentResponse.payment_method_id,
          });
          console.log(`[Firestore] Pedido #${orderData.id} pago! Status alterado para 'pending' (Aguardando aceite do restaurante).`);
        } catch (dbErr) {
          console.error(`[Firestore Error] Erro ao atualizar pedido #${orderData.id}:`, dbErr);
        }
      } else {
        // Save Mercado Pago payment ID to order in Firestore for webhook tracking
        try {
          const orderRef = doc(db, 'orders', String(orderData.id));
          await updateDoc(orderRef, {
            mercadopagoPaymentId: String(paymentResponse.id),
            mercadopagoStatus: paymentResponse.status,
            mercadopagoPaymentMethod: paymentResponse.payment_method_id,
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
        payment: paymentResponse,
      });
    } catch (error: any) {
      console.error('[Mercado Pago API Error] Falha no processamento:', error?.cause || error?.message || error);
      return res.status(500).json({
        error: 'Erro ao processar pagamento com o Mercado Pago',
        details: error?.cause?.[0]?.description || error?.message || String(error),
      });
    }
  });

  // POST /api/mercadopago/create-preference (For Preference-based or Wallet Bricks)
  app.post('/api/mercadopago/create-preference', async (req, res) => {
    try {
      const { orderData } = req.body;
      if (!orderData) {
        return res.status(400).json({ error: 'Dados do pedido são obrigatórios.' });
      }

      const rawAppUrl = process.env.APP_URL;
      const isPlaceholderAppUrl = !rawAppUrl || rawAppUrl === 'MY_APP_URL';
      const host = req.headers['x-forwarded-host'] || req.get('host') || 'sheikcoin.site';
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const appBaseUrl = (!isPlaceholderAppUrl ? rawAppUrl : `${protocol}://${host}`).replace(/\/$/, '');
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

      let items = (orderData.items || [])
        .map((item: any) => ({
          id: String(item.productId || item.id || 'item'),
          title: String(item.productName || item.title || item.name || 'Item do Pedido').trim() || 'Item do Pedido',
          unit_price: Number(item.price || item.unit_price || 0),
          quantity: Number(item.quantity || 1),
          currency_id: 'BRL',
        }))
        .filter((i: any) => i.unit_price > 0 && i.quantity > 0);

      if (items.length === 0) {
        items = [{
          id: String(orderData.id || 'pedido'),
          title: `Pedido #${orderData.id || ''} - Maestria Grill`,
          unit_price: Number(orderData.total || orderData.valorTotal || 1),
          quantity: 1,
          currency_id: 'BRL',
        }];
      } else if (orderData.deliveryFee && Number(orderData.deliveryFee) > 0) {
        items.push({
          id: 'delivery_fee',
          title: 'Taxa de Entrega',
          unit_price: Number(orderData.deliveryFee),
          quantity: 1,
          currency_id: 'BRL',
        });
      }

      const customerEmail = String(orderData.customerEmail || 'cliente@maestriagrill.com').trim();
      const validEmail = customerEmail.includes('@') && customerEmail.includes('.')
        ? customerEmail
        : 'cliente@maestriagrill.com';

      const bodyData: any = {
        items,
        payer: {
          name: String(orderData.customerName || 'Cliente').trim() || 'Cliente',
          email: validEmail,
        },
        external_reference: String(orderData.id),
        back_urls: {
          success: `${appBaseUrl}/?orderId=${orderData.id}&payment=success`,
          failure: `${appBaseUrl}/?orderId=${orderData.id}&payment=failure`,
          pending: `${appBaseUrl}/?orderId=${orderData.id}&payment=pending`,
        },
        auto_return: 'approved',
      };

      if (!isLocalhost && !appBaseUrl.includes('localhost')) {
        bodyData.notification_url = `${appBaseUrl}/api/mercadopago/webhook`;
      }

      console.log(`[Mercado Pago Preference] Criando preferência para Pedido #${orderData.id}...`);
      const prefResponse = await mpPreference.create({ body: bodyData });

      return res.json({
        id: prefResponse.id,
        init_point: prefResponse.init_point,
        sandbox_init_point: prefResponse.sandbox_init_point,
      });
    } catch (error: any) {
      console.error('[Mercado Pago Preference Error]:', error?.cause || error?.message || error);
      return res.status(500).json({
        error: 'Erro ao criar preferência de pagamento',
        details: error?.cause?.[0]?.description || error?.message || String(error),
      });
    }
  });

  // POST /api/mercadopago/webhook (Automated Webhook Notification Handler)
  app.post('/api/mercadopago/webhook', async (req, res) => {
    try {
      console.log('[Mercado Pago Webhook Received]:', JSON.stringify(req.query), JSON.stringify(req.body));

      const topic = req.query.topic || req.query.type || req.body?.type || req.body?.topic;
      if (topic && topic !== 'payment') {
        console.log(`[Mercado Pago Webhook] Ignorando notificação de tópico '${topic}'.`);
        return res.status(200).send(`Tópico '${topic}' recebido e ignorado.`);
      }

      const paymentId =
        req.query.id ||
        req.query['data.id'] ||
        req.body?.data?.id ||
        (req.body?.type === 'payment' ? req.body?.data?.id : null) ||
        req.body?.id;

      if (!paymentId) {
        return res.status(200).send('Webhook recebido sem ID de pagamento.');
      }

      console.log(`[Mercado Pago Webhook] Consultando status do Pagamento #${paymentId}...`);
      let paymentInfo: any = null;
      try {
        paymentInfo = await mpPayment.get({ id: String(paymentId) });
      } catch (getErr: any) {
        if (
          getErr?.status === 404 ||
          getErr?.error === 'not_found' ||
          getErr?.message?.includes('not_found')
        ) {
          console.warn(`[Mercado Pago Webhook] Pagamento #${paymentId} não encontrado no MP (pode ser evento de teste ou ordem).`);
          return res.status(200).send('Pagamento não encontrado no MP.');
        }
        throw getErr;
      }

      if (paymentInfo && paymentInfo.external_reference) {
        const orderId = paymentInfo.external_reference;
        const status = paymentInfo.status;
        console.log(`[Mercado Pago Webhook] Pedido #${orderId} -> Status: ${status}`);

        const orderRef = doc(db, 'orders', String(orderId));
        const orderSnap = await getDoc(orderRef);

        if (orderSnap.exists()) {
          const currentOrder = orderSnap.data();

          if (status === 'approved') {
            await updateDoc(orderRef, {
              paymentStatus: 'paid',
              statusPagamento: 'pago',
              // Switch status to 'pending' when paid so restaurant can accept or refuse
              status: currentOrder.status === 'awaiting_payment' ? 'pending' : currentOrder.status,
              paidAt: new Date().toISOString(),
              mercadopagoPaymentId: String(paymentId),
              mercadopagoStatus: status,
              mercadopagoPaymentMethod: paymentInfo.payment_method_id,
            });
            console.log(`[Webhook Success] Pedido #${orderId} atualizado para 'PAGO' e enviado para o restaurante aceitar!`);
          } else {
            await updateDoc(orderRef, {
              mercadopagoPaymentId: String(paymentId),
              mercadopagoStatus: status,
              mercadopagoPaymentMethod: paymentInfo.payment_method_id,
            });
          }
        } else {
          console.warn(`[Webhook Warning] Pedido #${orderId} não encontrado no Firestore.`);
        }
      }

      return res.status(200).send('Webhook processado com sucesso.');
    } catch (error: any) {
      console.error('[Mercado Pago Webhook Error]:', error);
      // Return 200 to acknowledge receipt and avoid Mercado Pago retry storms
      return res.status(200).send('Erro interno ao processar webhook.');
    }
  });

  // GET /api/mercadopago/payment-status/:id (Status Polling endpoint)
  app.get('/api/mercadopago/payment-status/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (!id || id === 'null' || id === 'undefined') {
        return res.status(400).json({ error: 'ID do pagamento é obrigatório' });
      }

      let paymentInfo: any = null;
      try {
        paymentInfo = await mpPayment.get({ id });
      } catch (getErr: any) {
        if (
          getErr?.status === 404 ||
          getErr?.error === 'not_found' ||
          getErr?.message?.includes('not_found')
        ) {
          return res.status(404).json({ status: 'not_found', error: 'Pagamento não encontrado no Mercado Pago' });
        }
        throw getErr;
      }

      if (paymentInfo.status === 'approved' && paymentInfo.external_reference) {
        const orderRef = doc(db, 'orders', String(paymentInfo.external_reference));
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
          const currentOrder = orderSnap.data();
          if (currentOrder.paymentStatus !== 'paid') {
            await updateDoc(orderRef, {
              paymentStatus: 'paid',
              statusPagamento: 'pago',
              status: currentOrder.status === 'awaiting_payment' ? 'pending' : currentOrder.status,
              paidAt: new Date().toISOString(),
              mercadopagoStatus: 'approved',
            });
          }
        }
      }

      return res.json({
        id: paymentInfo.id,
        status: paymentInfo.status,
        status_detail: paymentInfo.status_detail,
        payment_method_id: paymentInfo.payment_method_id,
        external_reference: paymentInfo.external_reference,
      });
    } catch (error: any) {
      console.error('[Mercado Pago Status Error]:', error);
      return res.status(500).json({ error: 'Erro ao verificar status do pagamento' });
    }
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Maestria Grill rodando na porta ${PORT}`);
  });
}

startServer();
