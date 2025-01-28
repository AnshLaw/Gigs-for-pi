import axios from "axios";

const platformAPIClient = axios.create({
  baseURL: 'https://api.minepi.com/v2',
  timeout: 20000,
  headers: { 'Authorization': `Key ${import.meta.env.VITE_PI_API_KEY}` }
});

export default platformAPIClient;