// Vercel / Serverless API Proxy for GitHub Contributions
// Securely fetches 365-day contribution calendar via GraphQL using GITHUB_PAT.
// The GitHub token remains 100% hidden on the server.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.GITHUB_PAT;
  const username = req.query.username || 'JVP008';

  if (!token) {
    // Fallback: Use free public API endpoint if environment variable isn't set yet
    try {
      const fallbackRes = await fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`);
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        return res.status(200).json(fallbackData);
      }
    } catch (e) {}

    return res.status(400).json({
      error: 'Missing GITHUB_PAT in environment variables.'
    });
  }

  const query = `
    query($username: String!) {
      user(login: $username) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                color
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Portfolio-App'
      },
      body: JSON.stringify({ query, variables: { username } })
    });

    const json = await response.json();
    if (!response.ok || json.errors) {
      throw new Error(json.errors ? json.errors[0].message : `GitHub API HTTP ${response.status}`);
    }

    const calendar = json.data?.user?.contributionsCollection?.contributionCalendar;
    if (!calendar) {
      throw new Error('User not found or no contribution data');
    }

    // Format output cleanly into flat contributions array
    const contributions = [];
    calendar.weeks.forEach(week => {
      week.contributionDays.forEach(day => {
        contributions.push({
          date: day.date,
          count: day.contributionCount,
          color: day.color
        });
      });
    });

    return res.status(200).json({
      total: { [new Date().getFullYear()]: calendar.totalContributions },
      contributions
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to fetch GitHub data',
      message: err.message
    });
  }
}
