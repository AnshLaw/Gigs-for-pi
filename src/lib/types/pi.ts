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

export interface PiPayment {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata: Record<string, any>;
  status: string;
  created_at: string;
  transaction?: {
    txid: string;
    verified: boolean;
  };
}

export interface PiAuthResult {
  accessToken: string;
  user: {
    uid: string;
    username: string;
    payments?: PiPayment[];
  };
}

declare global {
  interface Window {
    Pi: {
      init: (config: { version: string, sandbox?: boolean, debug?: boolean }) => void;
      authenticate: (
        scopes: string[], 
        onIncompletePaymentFound: (payment: PiPayment) => void,
        onCancel?: (error: Error) => void
      ) => Promise<PiAuthResult>;
      createPayment: (data: PaymentData, callbacks: PaymentCallbacks) => void;
    };
  }
}