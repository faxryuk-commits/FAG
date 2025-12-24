import { ApifyApi } from '@apify/client';

const apifyClient = new ApifyApi({
  token: process.env.APIFY_API_TOKEN,
});

export default apifyClient;

