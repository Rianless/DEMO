export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const yyyy = today.getFullYear();
  const mm = pad(today.getMonth() + 1);
  const dd = pad(today.getDate());

  // Unix timestamp (오늘 0시 KST = UTC-9)
  const dayStart = Math.floor(new Date(`${yyyy}-${mm}-${dd}T00:00:00+09:00`).getTime() / 1000);

  const TEAM = {
    'KIA Tigers':'KIA','KT Wiz':'KT','LG Twins':'LG','SSG Landers':'SSG','NC Dinos':'NC',
    'Doosan Bears':'두산','Lotte Giants':'롯데','Samsung Lions':'삼성','Hanwha Eagles':'한화','Kiwoom Heroes':'키움',
    'KIA':'KIA','KT':'KT','LG':'LG','SSG':'SSG','NC':'NC',
    '두산':'두산','롯데':'롯데','삼성':'삼성','한화':'한화','키움':'키움',
  };
  const mapTeam = n => {
    if(!n) return n;
    for(const [k,v] of Object.entries(TEAM)) if(n.includes(k)) return v;
    return n;
  };

  try {
    // Flashscore KBO API
    const url = `https://www.flashscore.com/x/req/m_${dayStart}`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/plain',
        'X-Fsign': 'SW9D1eZo',
        'Referer': 'https://www.flashscore.com/baseball/south-korea/kbo/',
      }
    });

    if(!r.ok) {
      // Flashscore 실패시 ESPN API 시도
      const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/baseball/kbo/scoreboard?dates=${yyyy}${mm}${dd}`;
      const r2 = await fetch(espnUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
      });
      const text2 = await r2.text();
      if(!r2.ok) {
        return res.status(200).json({ games:[], date:`${yyyy}${mm}${dd}`, error:`ESPN HTTP ${r2.status}`, raw: text2.substring(0,200) });
      }
      const data2 = JSON.parse(text2);
      const events = data2?.events || [];
      const games = events.map(e => {
        const comp = e.competitions?.[0];
        const away = comp?.competitors?.find(c=>c.homeAway==='away');
        const home = comp?.competitors?.find(c=>c.homeAway==='home');
        const sc = e.status?.type?.state || '';
        let status = 'SCHEDULED';
        if(sc==='in') status='LIVE';
        else if(sc==='post') status='FINAL';
        return {
          date:`${yyyy}-${mm}-${dd}`,
          time: e.date ? new Date(e.date).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}) : '',
          away: mapTeam(away?.team?.displayName||''),
          home: mapTeam(home?.team?.displayName||''),
          stad: comp?.venue?.fullName||'',
          status,
          awayScore: away?.score!=null ? Number(away.score) : null,
          homeScore: home?.score!=null ? Number(home.score) : null,
          awayInnings: Array(9).fill(-1),
          homeInnings: Array(9).fill(-1),
          gameId: e.id||'',
        };
      });
      return res.status(200).json({ games, date:`${yyyy}${mm}${dd}`, total:games.length, src:'espn' });
    }

    return res.status(200).json({ games:[], date:`${yyyy}${mm}${dd}`, error:'flashscore 파싱 미구현' });

  } catch(e) {
    // ESPN fallback
    try {
      const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/baseball/kbo/scoreboard?dates=${yyyy}${mm}${dd}`;
      const r2 = await fetch(espnUrl, { headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'} });
      const text2 = await r2.text();
      if(!r2.ok) return res.status(200).json({ games:[], date:`${yyyy}${mm}${dd}`, error:`ESPN ${r2.status}`, raw:text2.substring(0,200) });
      const data2 = JSON.parse(text2);
      const events = data2?.events || [];
      const games = events.map(ev => {
        const comp = ev.competitions?.[0];
        const away = comp?.competitors?.find(c=>c.homeAway==='away');
        const home = comp?.competitors?.find(c=>c.homeAway==='home');
        const sc = ev.status?.type?.state||'';
        let status='SCHEDULED';
        if(sc==='in') status='LIVE';
        else if(sc==='post') status='FINAL';
        return {
          date:`${yyyy}-${mm}-${dd}`,
          time: ev.date ? new Date(ev.date).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}) : '',
          away: mapTeam(away?.team?.displayName||''),
          home: mapTeam(home?.team?.displayName||''),
          stad: comp?.venue?.fullName||'',
          status,
          awayScore: away?.score!=null?Number(away.score):null,
          homeScore: home?.score!=null?Number(home.score):null,
          awayInnings: Array(9).fill(-1),
          homeInnings: Array(9).fill(-1),
          gameId: ev.id||'',
        };
      });
      return res.status(200).json({ games, date:`${yyyy}${mm}${dd}`, total:games.length, src:'espn' });
    } catch(e2) {
      return res.status(200).json({ games:[], date:`${yyyy}${mm}${dd}`, error:e2.message });
    }
  }
}

