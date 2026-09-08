// api/health.js — unauthenticated health check.
import { BASE_URL_FOR_HEALTH } from '../lib/tools.js';
import { loadDataset, entries, metaOf } from '../lib/dataset.js';

let dealCount = null;

function dealsLoaded() {
  if (dealCount === null) {
    try {
      dealCount = entries(loadDataset('hot-deals', 'own')).length;
    } catch (err) {
      dealCount = -1;
    }
  }
  return dealCount;
}

export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: 'spicytools-mcp',
    upstream: BASE_URL_FOR_HEALTH,
    dealsInFeed: dealsLoaded(),
    dealFeedUpdated: metaOf(loadDataset('hot-deals', 'own')).last_updated || null,
  });
}
