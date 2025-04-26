const $ = new API('v2ex-cookie', true);
const COOKIE_KEY = 'v2ex_session';
const REFRESH_INTERVAL = 3 * 86400; // 3天

function parseCookies(headers) {
  return headers['Set-Cookie'] 
    ?.map(c => c.split(';')[0])
    ?.filter(c => c.includes('A2=') || c.includes('PB3_SESSION'))
    ?.join('; ') || '';
}

// 主处理逻辑
if ($response) {
  const newCookies = parseCookies($response.headers);
  
  if (newCookies) {
    const oldCookies = $.read(COOKIE_KEY) || '';
    const shouldUpdate = !oldCookies.includes(newCookies.split('=')[1]);
    
    if (shouldUpdate) {
      $.write(newCookies, COOKIE_KEY);
      $.log(`🍪 更新会话Cookie | 新特征值: ${newCookies.slice(0,15)}...`);
    }
  }
}

// 自动续期检测
const lastUpdate = $.read('cookie_last_update') || 0;
if (Date.now() - lastUpdate > REFRESH_INTERVAL * 1000) {
  $.notify('⚠️ V2EX 会话即将过期', '请手动访问一次V2EX', '点击通知跳转', 'https://www.v2ex.com/');
}

$done();
