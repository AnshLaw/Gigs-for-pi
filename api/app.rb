require 'sinatra'
require 'sinatra/cors'
require 'pinetwork'
require 'dotenv'
require 'json'

Dotenv.load

# Configure CORS
set :allow_origin, "http://localhost:5173"
set :allow_methods, "GET,HEAD,POST"
set :allow_headers, "content-type,if-modified-since"
set :expose_headers, "location,link"

# Initialize Pi SDK
before do
  @pi = PiNetwork.new(
    api_key: ENV['PI_API_KEY'],
    wallet_private_seed: ENV['PI_WALLET_PRIVATE_SEED']
  )
  content_type :json
end

# Create A2U payment
post '/a2u-payments/create' do
  data = JSON.parse(request.body.read)
  
  payment_data = {
    amount: data['amount'],
    memo: data['memo'],
    metadata: data['metadata'],
    uid: data['uid']
  }

  begin
    payment_id = @pi.create_payment(payment_data)
    { payment_id: payment_id }.to_json
  rescue => e
    status 400
    { error: e.message }.to_json
  end
end

# Submit payment to blockchain
post '/a2u-payments/:id/submit' do |id|
  begin
    txid = @pi.submit_payment(id)
    { txid: txid }.to_json
  rescue => e
    status 400
    { error: e.message }.to_json
  end
end

# Complete payment
post '/a2u-payments/:id/complete' do |id|
  data = JSON.parse(request.body.read)
  
  begin
    payment = @pi.complete_payment(id, data['txid'])
    payment.to_json
  rescue => e
    status 400
    { error: e.message }.to_json
  end
end

# Get payment status
get '/a2u-payments/:id' do |id|
  begin
    payment = @pi.get_payment(id)
    payment.to_json
  rescue => e
    status 400
    { error: e.message }.to_json
  end
end