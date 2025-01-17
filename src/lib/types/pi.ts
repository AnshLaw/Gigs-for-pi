export interface PaymentData {
    amount: number;
    memo: string;
    metadata: Record<string, any>;
  }
  
  export interface PaymentCallbacks {
    onReadyForServerApproval: (paymentId: string) => void;
    onReadyForServerCompletion: (paymentId: string, txid: string) => void;
    onCancel: (paymentId: string) => void;
    onError: (error: Error, payment?: any) => void;
  }
  
  declare global {
    interface Window {
      Pi: {
        init: (config: { version: string, sandbox?: boolean, debug?: boolean }) => void;
        authenticate: (scopes: string[], onIncompletePaymentFound: (payment: any) => void) => Promise<{
          accessToken: string;
          user: {
            uid: string;
            username: string;
            payments?: {
              address: string;
            };
          };
        }>;
        createPayment: (data: PaymentData, callbacks: PaymentCallbacks) => void;
      };
    }
  }