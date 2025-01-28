const axios = require('axios');

// Initialize Pi SDK client
const piClient = axios.create({
  baseURL: 'https://api.minepi.com/v2',
  timeout: 20000,
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Key ${process.env.VITE_PI_API_KEY}`
  }
});

// Helper to create standardized response
const createResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  },
  body: JSON.stringify(body)
});

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return createResponse(200, {});
  }

  // Get the path without the function prefix
  const path = event.path.replace(/\/.netlify\/functions\/[^/]+/, '');
  console.log('Processing request for path:', path);
  
  try {
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);

      // Create A2U payment
      if (path === '/a2u-payments/create') {
        console.log('Creating payment:', body);
        const response = await piClient.post('/payments', {
          amount: body.amount,
          memo: body.memo,
          metadata: body.metadata,
          uid: body.uid
        });
        console.log('Payment created:', response.data);
        return createResponse(200, { payment_id: response.data.identifier });
      }

      // Submit payment
      if (path.match(/^\/a2u-payments\/[^/]+\/submit$/)) {
        const paymentId = path.split('/')[2];
        console.log('Submitting payment:', paymentId);
        const response = await piClient.post(`/payments/${paymentId}/submit`);
        console.log('Payment submitted:', response.data);
        return createResponse(200, { txid: response.data.txid });
      }

      // Complete payment
      if (path.match(/^\/a2u-payments\/[^/]+\/complete$/)) {
        const paymentId = path.split('/')[2];
        console.log('Completing payment:', paymentId, body);
        const response = await piClient.post(`/payments/${paymentId}/complete`, {
          txid: body.txid
        });
        console.log('Payment completed:', response.data);
        return createResponse(200, response.data);
      }
    }

    // Get payment status
    if (event.httpMethod === 'GET' && path.match(/^\/a2u-payments\/[^/]+$/)) {
      const paymentId = path.split('/')[2];
      console.log('Getting payment status:', paymentId);
      const response = await piClient.get(`/payments/${paymentId}`);
      console.log('Payment status:', response.data);
      return createResponse(200, response.data);
    }

    console.log('Path not matched:', path);
    return createResponse(404, { error: 'Not found' });
  } catch (error) {
    console.error('Payment API error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    return createResponse(error.response?.status || 500, {
      error: error.response?.data?.message || error.message
    });
  }
};