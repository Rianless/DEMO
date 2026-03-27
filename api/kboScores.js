export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${today.getFullYear()}${pad(today.getMonth()+1)}${pad(today.getDate())}`;

  try {
    const url = `https://api-gw.sports.naver.com/schedule/games?fields=basic%2Cschedule%2Cbaseball%2CmanualRelayUrl&upperCategoryId=kbaseball&categoryIds=kbo&fromDate=${dateStr}&toDate=${dateStr}&size=100`;

    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://sports.naver.com/',
        'Accept': 'application/json',
      }
    });

    if (!r.ok) {
      return res.status(200).json({ games: [], date: dateStr, error: 'API 오류' });
    }

    const data = await r.json();
    const rawGames = data?.result?.games || [];

    const TEAM_MAP = {
      'KIA': 'KIA', 'KT': 'KT', 'LG': 'LG', 'SSG': 'SSG', 'NC': 'NC',
      '두산': '두산', '롯데': '롯데', '삼성': '삼성', '한화': '한화', '키움': '키움',
      'Tigers': 'KIA', 'Wiz': 'KT', 'Twins': 'LG', 'Landers': 'SSG', 'Dinos': 'NC',
      'Bears': '두산', 'Giants': '롯데', 'Lions': '삼성', 'Eagles': '한화', 'Heroes': '키움',
    };

    const mapTeam = name => {
      if (!name) return name;
      for (const [k, v] of Object.entries(TEAM_MAP)) {
        if (name.includes(k)) return v;
      }
      return name;
    };

    const games = rawGames.map(g => {
      const base = g.schedule || g;
      const baseball = g.baseball || {};
      const awayTeam = mapTeam(base.awayTeamName || base.awayTeam);
      const homeTeam = mapTeam(base.homeTeamName || base.homeTeam);

      // 이닝 스코어
      const awayInnings = baseball.awayScoreList || [];
      const homeInnings = baseball.homeScoreList || [];

      // 상태
      const statusCode = base.statusCode || base.gameStatusCode || '';
      let status = 'SCHEDULED';
      if (statusCode === '1' || statusCode === 'LIVE') status = 'LIVE';
      else if (statusCode === '2' || statusCode === 'RESULT') status = 'FINAL';

      return {
        date: (base.gameDate || dateStr).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
        time: base.gameTime ? base.gameTime.substring(0,5) : '',
        away: awayTeam,
        home: homeTeam,
        stad: base.stadiumName || base.stadium || '',
        status,
        awayScore: base.awayScore ?? null,
        homeScore: base.homeScore ?? null,
        awayInnings: awayInnings.length ? awayInnings.map(Number) : Array(9).fill(-1),
        homeInnings: homeInnings.length ? homeInnings.map(Number) : Array(9).fill(-1),
        inning: baseball.currentInning || null,
        gameId: base.gameId || base.id || '',
      };
    });

    res.status(200).json({ games, date: dateStr });

  } catch (e) {
    res.status(200).json({ games: [], date: dateStr, error: e.message });
  }
}
