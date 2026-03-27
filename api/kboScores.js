export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${today.getFullYear()}${pad(today.getMonth()+1)}${pad(today.getDate())}`;

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

  try {
    // fields 쉼표를 %2C로 인코딩
    const apiUrl = `https://api-gw.sports.naver.com/schedule/games?fields=basic%2Cschedule%2Cbaseball&upperCategoryId=kbaseball&categoryIds=kbo&fromDate=${dateStr}&toDate=${dateStr}&size=100`;

    const r = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://m.sports.naver.com/kbaseball/schedule/index',
        'Origin': 'https://m.sports.naver.com',
        'Accept': 'application/json',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      }
    });

    const text = await r.text();

    if (!r.ok) {
      return res.status(200).json({ games: [], date: dateStr, error: `HTTP ${r.status}`, raw: text.substring(0, 200) });
    }

    let data;
    try { data = JSON.parse(text); }
    catch(e) {
      return res.status(200).json({ games: [], date: dateStr, error: 'JSON 파싱 실패', raw: text.substring(0, 200) });
    }

    const rawGames = data?.result?.games || [];

    const games = rawGames.map(g => {
      const base = g.schedule || g;
      const baseball = g.baseball || {};
      const sc = String(base.statusCode || base.gameStatusCode || '');
      let status = 'SCHEDULED';
      if (['1', 'LIVE'].includes(sc)) status = 'LIVE';
      else if (['2', 'RESULT'].includes(sc)) status = 'FINAL';
      const ai = baseball.awayScoreList || [];
      const hi = baseball.homeScoreList || [];
      return {
        date: dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
        time: (base.gameTime || '').substring(0, 5),
        away: mapTeam(base.awayTeamName || base.awayTeam),
        home: mapTeam(base.homeTeamName || base.homeTeam),
        stad: base.stadiumName || '',
        status,
        awayScore: base.awayScore ?? null,
        homeScore: base.homeScore ?? null,
        awayInnings: ai.length ? ai.map(Number) : Array(9).fill(-1),
        homeInnings: hi.length ? hi.map(Number) : Array(9).fill(-1),
        inning: baseball.currentInning || null,
        gameId: base.gameId || '',
      };
    });

    res.status(200).json({ games, date: dateStr, total: games.length });

  } catch(e) {
    res.status(200).json({ games: [], date: dateStr, error: e.message });
  }
}
