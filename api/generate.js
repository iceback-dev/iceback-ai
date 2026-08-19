// api/generate.js (Pages Router) – or app/api/generate/route.js (App Router)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  if (!REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: 'Missing Replicate API token' });
  }

  const { prompt, image } = req.body; // image is base64 data URL or null

  try {
    let inputImage = image;

    // If no image provided, generate one from the prompt
    if (!inputImage) {
      // Generate image using stable-diffusion
      const imageResponse = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: 'db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf',
          input: {
            prompt: prompt,
            width: 768,
            height: 512,
            num_outputs: 1,
          },
        }),
      });
      const imageData = await imageResponse.json();
      if (!imageResponse.ok) throw new Error(imageData.detail || 'Image generation failed');
      const imageJobId = imageData.id;

      // Poll until image is ready (max 30 attempts)
      let imageUrl = null;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${imageJobId}`, {
          headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}` },
        });
        const statusData = await statusRes.json();
        if (statusData.status === 'succeeded') {
          imageUrl = statusData.output[0];
          break;
        } else if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Image generation failed');
        }
      }
      if (!imageUrl) throw new Error('Image generation timed out');
      inputImage = imageUrl;
    }

    // Now generate video from the image (stable-video-diffusion)
    const videoPayload = {
      version: '3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438',
      input: {
        image: inputImage,
      },
    };

    const videoResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(videoPayload),
    });
    const videoData = await videoResponse.json();
    if (!videoResponse.ok) throw new Error(videoData.detail || 'Video generation failed');

    // Return the job ID so the frontend can poll status
    res.status(200).json({ jobId: videoData.id });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
