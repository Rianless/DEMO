export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const yyyy = today.getFullYear();
  const mm = pad(today.getMonth() + 1);
  const dd = pad(today.getDate());
  const dateStr = `${yyyy}${mm}${dd}`;

  const TEAM_MAP = {
    'KIA타이거즈':'KIA','KT위즈':'KT','LG트윈스':'LG','SSG랜더스':'SSG','NC다이노스':'NC',
    '두산베어스':'두산','롯데자이언츠':'롯데','삼성라이온즈':'삼성','한화이글스':'한화','키움히어로즈':'키움',
    'KIA':'KIA','KT':'KT','LG':'LG','SSG':'SSG','NC':'NC',
    '두산':'두산','롯데':'롯데','삼성':'삼성','한화':'한화','키움':'키움',
  };
  const mapTeam = name => {
    if (!name) return name;
    const clean = name.replace(/\s/g,'');
    for (const [k,v] of Object.entries(TEAM_MAP)) {
      if (clean.includes(k.replace(/\s/g,''))) return v;
    }
    return name;
  };

  try {
    // 네이버 스포츠 KBO 스코어 API (모바일 앱용 엔드포인트)
    const url = `https://api-gw.sports.naver.com/schedule/games?fields=basic%2Cschedule%2Cbaseball%2CmanualRelayUrl&upperCategoryId=kbaseball&categoryIds=kbo&fromDate=${dateStr}&toDate=${dateStr}&size=100`;

    const headers = {
      'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 13; SM-S918N Build/TP1A.220624.014)',
      'Accept': 'application/json',
      'Accept-Language': 'ko-KR',
      'Host': 'api-gw.sports.naver.com',
      'Connection': 'keep-alive',
    };

    const r = await fetch(url, { headers });
    const text = await r.text();

    if (!r.ok) {
      return res.status(200).json({
        games: [], date: dateStr,
        error: `HTTP ${r.status}`, raw: text.substring(0, 200)
      });
    }

    const data = JSON.parse(text);
    const rawGames = data?.result?.games || [];

    const games = rawGames.map(g => {
      const base = g.schedule || g;
      const baseball = g.baseball || {};
      const sc = String(base.statusCode || base.gameStatusCode || '');
      let status = 'SCHEDULED';
      if (['1','LIVE'].includes(sc)) status = 'LIVE';
      else if (['2','RESULT'].includes(sc)) status = 'FINAL';
      const ai = baseball.awayScoreList || [];
      const hi = baseball.homeScoreList || [];
      return {
        date: `${yyyy}-${mm}-${dd}`,
        time: (base.gameTime || '').substring(0, 5),
        away: mapTeam(base.awayTeamName || ''),
        home: mapTeam(base.homeTeamName || ''),
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
