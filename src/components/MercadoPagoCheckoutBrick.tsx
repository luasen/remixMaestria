import React, { useState, useEffect } from 'react';
import { initMercadoPago, Payment, StatusScreen } from '@mercadopago/sdk-react';
import { Loader2, ShieldCheck, Lock, AlertCircle } from 'lucide-react';

interface MercadoPagoCheckoutBrickProps {
  amount: number;
  orderId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  items: Array<{ productId: string; productName: string; quantity: number; price: number }>;
  deliveryFee: number;
  onSuccess: (paymentData: any) => void;
  onError: (errorMessage: string) => void;
}

const PUBLIC_KEY =
  (import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY as string) ||
  'APP_USR-45e3bea4-d7ee-4847-af4b-251fba799c6f';

// Initialize SDK with Public Key
try {
  initMercadoPago(PUBLIC_KEY, { locale: 'pt-BR' });
} catch (e) {
  console.warn('Mercado Pago SDK initialization:', e);
}

export default function MercadoPagoCheckoutBrick({
  amount,
  orderId,
  customerName,
  customerEmail = 'cliente@maestriagrill.com',
  customerPhone = '',
  items,
  deliveryFee,
  onSuccess,
  onError,
}: MercadoPagoCheckoutBrickProps) {
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [loadingPref, setLoadingPref] = useState(true);
  const [prefError, setPrefError] = useState<string | null>(null);

  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [brickReady, setBrickReady] = useState(false);

  // Fetch preference ID from backend using order details
  useEffect(() => {
    let isMounted = true;
    async function createPreference() {
      try {
        setLoadingPref(true);
        setPrefError(null);
        const res = await fetch('/api/mercadopago/create-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderData: {
              id: orderId,
              customerName,
              customerEmail,
              customerPhone,
              total: amount,
              deliveryFee,
              items,
            },
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.id) {
          throw new Error(data.error || 'Falha ao gerar a preferência de pagamento do Mercado Pago.');
        }

        if (isMounted) {
          setPreferenceId(data.id);
        }
      } catch (err: any) {
        console.error('[Mercado Pago Preference Error]:', err);
        if (isMounted) {
          setPrefError(err.message || 'Erro ao carregar preferência.');
          onError(err.message || 'Erro ao carregar preferência do Mercado Pago.');
        }
      } finally {
        if (isMounted) {
          setLoadingPref(false);
        }
      }
    }

    createPreference();
    return () => {
      isMounted = false;
    };
  }, [orderId, amount, customerName, customerEmail, customerPhone, deliveryFee, items, onError]);

  // Handle payment processing via official Brick callback
  const handleSubmit = async (param: any) => {
    const { formData } = param;
    return new Promise<void>((resolve, reject) => {
      fetch('/api/mercadopago/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData,
          orderData: {
            id: orderId,
            customerName,
            customerEmail,
            customerPhone,
            total: amount,
            deliveryFee,
            items,
          },
        }),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.success && result.id) {
            const newPaymentId = String(result.id);
            setPaymentId(newPaymentId);

            if (result.status === 'approved') {
              onSuccess(result);
            }
            resolve();
          } else {
            const errorMsg = result.error || result.details || 'Falha ao processar pagamento.';
            onError(errorMsg);
            reject(new Error(errorMsg));
          }
        })
        .catch((err) => {
          console.error('[Process Payment Exception]:', err);
          const errMsg = 'Erro na comunicação com o servidor de pagamentos.';
          onError(errMsg);
          reject(new Error(errMsg));
        });
    });
  };

  // If payment was created, render the official Mercado Pago StatusScreen Brick
  if (paymentId) {
    return (
      <div className="w-full min-h-[300px]">
        <StatusScreen
          initialization={{ paymentId }}
          onReady={() => console.log('Status Screen Brick do Mercado Pago pronto.')}
          onError={(error) => console.error('Status Screen Brick error:', error)}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Maestria Grill Outer Layout Frame */}
      <div className="flex items-center justify-between bg-sky-50 border border-sky-200/80 p-3.5 rounded-2xl">
        <div className="flex items-center gap-2.5 text-sky-900">
          <ShieldCheck className="h-5 w-5 text-sky-600 shrink-0" />
          <div>
            <span className="block text-xs font-extrabold">Mercado Pago Checkout Bricks</span>
            <span className="block text-[10px] text-sky-600 font-medium">
              Ambiente seguro de pagamento oficial Mercado Pago
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-white px-2 py-1 rounded-lg border border-gray-100 shadow-2xs">
          <Lock className="h-3 w-3" /> SSL 256-bit
        </div>
      </div>

      {prefError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{prefError}</span>
        </div>
      )}

      {/* Official Mercado Pago Payment Brick Container */}
      <div className="relative min-h-[350px] rounded-3xl border border-gray-200/80 bg-white p-2 shadow-xs overflow-hidden">
        {loadingPref ? (
          <div className="flex flex-col items-center justify-center min-h-[320px] gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            <p className="text-xs font-bold text-gray-600">Gerando checkout seguro com o Mercado Pago...</p>
          </div>
        ) : preferenceId ? (
          <>
            {!brickReady && (
              <div className="absolute inset-0 bg-white flex flex-col items-center justify-center gap-3 z-10">
                <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
                <p className="text-xs font-bold text-gray-600">Carregando Checkout Bricks do Mercado Pago...</p>
              </div>
            )}
            <Payment
              initialization={{
                amount,
                preferenceId,
                payer: {
                  email: customerEmail,
                },
              }}
              customization={{
                paymentMethods: {
                  ticket: 'all',
                  bankTransfer: 'all',
                  creditCard: 'all',
                  debitCard: 'all',
                  mercadoPago: 'all',
                },
                visual: {
                  hideFormTitle: false,
                  style: {
                    theme: 'default',
                    customVariables: {
                      formBackgroundColor: '#ffffff',
                      baseColor: '#ea580c',
                    },
                  },
                },
              }}
              onSubmit={handleSubmit}
              onReady={() => setBrickReady(true)}
              onError={(error) => {
                console.error('[Mercado Pago Payment Brick Error]:', error);
                setBrickReady(true);
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
