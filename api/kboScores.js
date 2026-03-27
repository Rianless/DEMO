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
  };
  const mapTeam = name => {
    if (!name) return name;
    for (const [k, v] of Object.entries(TEAM_MAP)) {
      if (name.includes(k)) return v;
    }
    return name;
  };

  try {
    // KBO 공식 API - 올바른 파라미터
    const url = `https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList?leId=1&srId=0,9&date=${dateStr}`;

    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'application/json, text/javascript, */*',
        'Referer': 'https://www.koreabaseball.com/Schedule/Schedule.aspx',
        'Content-Type': 'application/json; charset=utf-8',
      }
    });

    const text = await r.text();

    if (!r.ok) {
      return res.status(200).json({ games: [], date: dateStr, error: `HTTP ${r.status}`, raw: text.substring(0, 300) });
    }

    let data;
    try { data = JSON.parse(text); }
    catch(e) {
      return res.status(200).json({ games: [], date: dateStr, error: 'JSON 파싱 실패', raw: text.substring(0, 300) });
    }

    // d 필드 안에 배열
    const list = data?.d || [];

    const games = list.map(g => {
      const sc = String(g.GameStatus || g.StatusCode || '');
      let status = 'SCHEDULED';
      if (sc === 'P' || sc === '1') status = 'LIVE';
      else if (sc === 'F' || sc === '2') status = 'FINAL';

      // 이닝별 스코어 파싱
      const parseInnings = str => {
        if (!str) return Array(9).fill(-1);
        return str.split('|').map(n => n === '' ? -1 : Number(n));
      };

      return {
        date: `${yyyy}-${mm}-${dd}`,
        time: (g.StartTime || g.GameTime || '').substring(0, 5),
        away: mapTeam(g.AwayTeamName || ''),
        home: mapTeam(g.HomeTeamName || ''),
        stad: g.StadiumName || '',
        status,
        awayScore: g.AwayScore != null ? Number(g.AwayScore) : null,
        homeScore: g.HomeScore != null ? Number(g.HomeScore) : null,
        awayInnings: parseInnings(g.AwayScoreStr),
        homeInnings: parseInnings(g.HomeScoreStr),
        inning: g.CurrentInning || null,
        gameId: g.GameId || '',
      };
    });

    res.status(200).json({ games, date: dateStr, total: games.length });

  } catch(e) {
    res.status(200).json({ games: [], date: dateStr, error: e.message });
  }
}
