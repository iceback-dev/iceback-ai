// api/status.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Missing jobId' });
  }

  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  if (!REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: 'Missing Replicate API token' });
  }

  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${jobId}`, {
      headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Status fetch failed');

    // Map Replicate status to our frontend states
    let status = 'queued';
    if (data.status === 'starting' || data.status === 'processing') status = 'processing';
    else if (data.status === 'succeeded') status = 'completed';
    else if (data.status === 'failed') status = 'failed';
    else if (data.status === 'canceled') status = 'cancelled';

    const result = {
      jobId: data.id,
      status: status,
      videoUrl: data.output || null,
      error: data.error || null,
    };
    res.status(200).json(result);
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
