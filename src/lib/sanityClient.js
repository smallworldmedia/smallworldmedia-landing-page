/**
 * sanityClient.js — Lightweight Sanity client for build-time GROQ queries.
 *
 * Uses the @sanity/client bundled with @sanity/astro.
 * Configured for the SWM production dataset.
 *
 * Usage:
 *   import { sanityFetch } from './sanityClient.js';
 *   const data = await sanityFetch(MEDIA_GRID_QUERY);
 */
import { createClient } from '@sanity/client';

const client = createClient({
  projectId: 'b60h4u7o',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
  // Token is only needed for draft/authenticated queries.
  // Public published data doesn't require it.
  token: import.meta.env.SANITY_WRITE_TOKEN || undefined,
});

/**
 * Fetch data from Sanity via GROQ.
 * @param {string} query - GROQ query string
 * @param {Object} [params] - Optional query parameters
 * @returns {Promise<any>} - Query result
 */
export async function sanityFetch(query, params = {}) {
  return client.fetch(query, params);
}

export default client;
