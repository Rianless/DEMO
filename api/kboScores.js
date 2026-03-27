export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const yyyy = today.getFullYear();
  const mm = pad(today.getMonth() + 1);
  const dd = pad(today.getDate());
  const dateStr = `${yyyy}${mm}${dd}`;

  const TEAM_MAP = {
    'KIA': 'KIA', 'KT': 'KT', 'LG': 'LG', 'SSG': 'SSG', 'NC': 'NC',
    '두산': '두산', '롯데': '롯데', '삼성': '삼성', '한화': '한화', '키움': '키움',
    'Tigers': 'KIA', 'Wiz': 'KT', 'Twins': 'LG', 'Landers': 'SSG', 'Dinos': 'NC',
    'Bears': '두산', 'Giants': '롯데', 'Lions': '삼성', 'Eagles': '한화', 'Heroes': '키움',
    'HH': '한화', 'LT': '롯데', 'SS': '삼성', 'HB': '두산', 'KI': '키움',
    'OB': '두산', 'WO': '키움',
  };
  const mapTeam = name => {
    if (!name) return name;
    for (const [k, v] of Object.entries(TEAM_MAP)) {
      if (name === k || name.includes(k)) return v;
    }
    return name;
  };

  try {
    // KBO 공식 API (스포츠플래시 기반)
    const url = `https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList?leagueId=1&seriesId=0&gameDate=${dateStr}&teamId=0`;

    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'application/json, text/javascript, */*',
        'Referer': 'https://www.koreabaseball.com/',
      }
    });

    const text = await r.text();

    if (!r.ok) {
      return res.status(200).json({ games: [], date: dateStr, error: `KBO HTTP ${r.status}`, raw: text.substring(0, 300) });
    }

    let data;
    try { data = JSON.parse(text); }
    catch(e) {
      return res.status(200).json({ games: [], date: dateStr, error: 'JSON 파싱 실패', raw: text.substring(0, 300) });
    }

    // KBO 공식 사이트 응답 파싱
    const rawGames = data?.d || data?.result || data?.games || data || [];
    const list = Array.isArray(rawGames) ? rawGames : [];

    const games = list.map(g => {
      const sc = String(g.StatusCode || g.status || g.GameStatus || '');
      let status = 'SCHEDULED';
      if (['1', 'P', 'playing', 'LIVE'].includes(sc)) status = 'LIVE';
      else if (['2', 'F', 'done', 'RESULT', 'result'].includes(sc)) status = 'FINAL';

      return {
        date: `${yyyy}-${mm}-${dd}`,
        time: (g.GameTime || g.time || g.StartTime || '').substring(0, 5),
        away: mapTeam(g.AwayTeamName || g.awayTeam || g.Away || ''),
        home: mapTeam(g.HomeTeamName || g.homeTeam || g.Home || ''),
        stad: g.StadiumName || g.stadium || g.Venue || '',
        status,
        awayScore: g.AwayScore ?? g.awayScore ?? null,
        homeScore: g.HomeScore ?? g.homeScore ?? null,
        awayInnings: Array(9).fill(-1),
        homeInnings: Array(9).fill(-1),
        gameId: g.GameId || g.gameId || '',
      };
    });

    res.status(200).json({ games, date: dateStr, total: games.length });

  } catch(e) {
    res.status(200).json({ games: [], date: dateStr, error: e.message });
  }
}
