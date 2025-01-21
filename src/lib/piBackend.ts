import PiNetwork from 'pi-backend';

// Initialize Pi Network backend SDK
const pi = new PiNetwork(
  import.meta.env.VITE_PI_API_KEY,
  import.meta.env.VITE_PI_WALLET_PRIVATE_SEED
);

export async function createA2UPayment(amount: number, userUid: string) {
  try {
    // Create payment
    const paymentId = await pi.createPayment({
      amount,
      memo: "Task payment release",
      metadata: { type: "task_payment_release", timestamp: Date.now() },
      uid: userUid
    });

    console.log('A2U payment created:', paymentId);

    // Submit payment to blockchain
    const txid = await pi.submitPayment(paymentId);
    console.log('A2U payment submitted:', txid);

    // Complete the payment
    const completedPayment = await pi.completePayment(paymentId, txid);
    console.log('A2U payment completed:', completedPayment);

    return {
      status: "completed",
      paymentId,
      txid
    };
  } catch (err) {
    console.error('A2U payment error:', err);
    throw new Error('Failed to process payment to executor');
  }
}

export async function getPaymentStatus(paymentId: string) {
  try {
    const payment = await pi.getPayment(paymentId);
    return payment;
  } catch (err) {
    console.error('Error getting payment status:', err);
    throw new Error('Failed to get payment status');
  }
}

export async function cancelPayment(paymentId: string) {
  try {
    const payment = await pi.cancelPayment(paymentId);
    return payment;
  } catch (err) {
    console.error('Error cancelling payment:', err);
    throw new Error('Failed to cancel payment');
  }
}

export async function getIncompletePayments() {
  try {
    const payments = await pi.getIncompleteServerPayments();
    return payments;
  } catch (err) {
    console.error('Error getting incomplete payments:', err);
    throw new Error('Failed to get incomplete payments');
  }
}