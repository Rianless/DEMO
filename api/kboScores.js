export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

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
    // 네이버 스포츠 KBO 일정 API
    const url = `https://sports.news.naver.com/kbaseball/schedule/index.nhn?year=${today.getFullYear()}&month=${pad(today.getMonth()+1)}`;

    // 직접 경기 결과 API
    const apiUrl = `https://api-gw.sports.naver.com/schedule/games?fields=basic,schedule,baseball&upperCategoryId=kbaseball&categoryIds=kbo&fromDate=${dateStr}&toDate=${dateStr}&size=100`;

    const r = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://m.sports.naver.com/kbaseball/schedule/index',
        'Origin': 'https://m.sports.naver.com',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'x-lang': 'ko',
      }
    });

    const text = await r.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch(e) {
      return res.status(200).json({ games: [], date: dateStr, error: 'JSON 파싱 오류', raw: text.substring(0, 200) });
    }

    const rawGames = data?.result?.games || data?.games || [];

    const games = rawGames.map(g => {
      const base = g.schedule || g;
      const baseball = g.baseball || {};
      const awayTeam = mapTeam(base.awayTeamName || base.awayTeam || base.homeTeamCode);
      const homeTeam = mapTeam(base.homeTeamName || base.homeTeam || base.awayTeamCode);

      const statusCode = String(base.statusCode || base.gameStatusCode || base.status || '');
      let status = 'SCHEDULED';
      if (['1', 'LIVE', 'playing'].includes(statusCode)) status = 'LIVE';
      else if (['2', 'RESULT', 'result', 'done', 'cancel'].includes(statusCode)) status = 'FINAL';

      const awayInnings = baseball.awayScoreList || baseball.awayScore || [];
      const homeInnings = baseball.homeScoreList || baseball.homeScore || [];

      return {
        date: dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
        time: (base.gameTime || base.time || '').substring(0, 5),
        away: awayTeam,
        home: homeTeam,
        stad: base.stadiumName || base.stadium || '',
        status,
        awayScore: base.awayScore ?? null,
        homeScore: base.homeScore ?? null,
        awayInnings: Array.isArray(awayInnings) && awayInnings.length ? awayInnings.map(Number) : Array(9).fill(-1),
        homeInnings: Array.isArray(homeInnings) && homeInnings.length ? homeInnings.map(Number) : Array(9).fill(-1),
        inning: baseball.currentInning || null,
        gameId: base.gameId || base.id || '',
      };
    });

    res.status(200).json({ games, date: dateStr, total: games.length });

  } catch (e) {
    res.status(200).json({ games: [], date: dateStr, error: e.message });
  }
}
