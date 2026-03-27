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

  const attempts = [];

  // 1차: 스포츠플래시 API
  try {
    const url = `https://sports.daum.net/sports/api/game/dayschedule.json?type=baseball&leagueCode=kbo&dateStr=${dateStr}`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://sports.daum.net/schedule/kbo',
        'Accept': 'application/json',
      }
    });
    const text = await r.text();
    attempts.push({ url, status: r.status, preview: text.substring(0, 150) });

    if (r.ok) {
      const data = JSON.parse(text);
      const list = data?.schedule || data?.games || data?.data || [];
      if (list.length > 0) {
        const games = list.map(g => {
          const sc = String(g.statusCode || g.gameStatus || g.status || '');
          let status = 'SCHEDULED';
          if (['1','PLAY','live'].includes(sc)) status = 'LIVE';
          else if (['2','END','done','result'].includes(sc)) status = 'FINAL';
          return {
            date: `${yyyy}-${mm}-${dd}`,
            time: (g.startTime || g.gameTime || '').substring(0, 5),
            away: mapTeam(g.awayTeamName || g.awayTeam || ''),
            home: mapTeam(g.homeTeamName || g.homeTeam || ''),
            stad: g.venueName || g.stadium || '',
            status,
            awayScore: g.awayScore ?? null,
            homeScore: g.homeScore ?? null,
            awayInnings: Array(9).fill(-1),
            homeInnings: Array(9).fill(-1),
            gameId: g.gameCode || g.gameId || '',
          };
        });
        return res.status(200).json({ games, date: dateStr, total: games.length, src: 'daum' });
      }
    }
  } catch(e) { attempts.push({ src: 'daum', error: e.message }); }

  // 2차: 스포츠서울 API
  try {
    const url = `https://api.sportsseoul.com/kbo/schedule?date=${yyyy}-${mm}-${dd}`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'application/json',
      }
    });
    const text = await r.text();
    attempts.push({ url, status: r.status, preview: text.substring(0, 150) });
    if (r.ok) {
      const data = JSON.parse(text);
      const list = data?.data || data?.games || [];
      if (list.length > 0) {
        const games = list.map(g => ({
          date: `${yyyy}-${mm}-${dd}`,
          time: (g.startTime || '').substring(0, 5),
          away: mapTeam(g.awayTeam || ''),
          home: mapTeam(g.homeTeam || ''),
          stad: g.stadium || '',
          status: 'SCHEDULED',
          awayScore: g.awayScore ?? null,
          homeScore: g.homeScore ?? null,
          awayInnings: Array(9).fill(-1),
          homeInnings: Array(9).fill(-1),
          gameId: g.gameId || '',
        }));
        return res.status(200).json({ games, date: dateStr, total: games.length, src: 'sportsseoul' });
      }
    }
  } catch(e) { attempts.push({ src: 'sportsseoul', error: e.message }); }

  // 3차: statiz API
  try {
    const url = `https://www.statiz.co.kr/api/schedule?date=${yyyy}-${mm}-${dd}`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'application/json',
        'Referer': 'https://www.statiz.co.kr/',
      }
    });
    const text = await r.text();
    attempts.push({ url, status: r.status, preview: text.substring(0, 150) });
  } catch(e) { attempts.push({ src: 'statiz', error: e.message }); }

  res.status(200).json({ games: [], date: dateStr, error: '모든 API 실패', debug: attempts });
}
