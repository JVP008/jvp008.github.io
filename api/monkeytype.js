// Vercel / Serverless API Proxy for Monkeytype
// Securely fetches both testActivity and personalBests (15s & 60s) using MONKEYTYPE_APE_KEY.
// The API key remains 100% hidden on the server.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apeKey = process.env.MONKEYTYPE_APE_KEY || req.headers['x-ape-key'];

  if (!apeKey) {
    return res.status(400).json({
      error: 'Missing MONKEYTYPE_APE_KEY in environment variables.'
    });
  }

  try {
    const [activityRes, pbRes] = await Promise.all([
      fetch('https://api.monkeytype.com/users/currentTestActivity', {
        headers: { 'Authorization': `ApeKey ${apeKey}` }
      }),
      fetch('https://api.monkeytype.com/users/personalBests?mode=time', {
        headers: { 'Authorization': `ApeKey ${apeKey}` }
      })
    ]);

    const activityJson = await activityRes.json();
    const pbJson = await pbRes.json();

    return res.status(200).json({
      activity: activityJson.data || activityJson.testActivity || activityJson,
      personalBests: pbJson.data || pbJson
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to fetch Monkeytype data',
      message: err.message
    });
  }
}
