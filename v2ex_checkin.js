const $ = new API('v2ex-checkin', true);
const COOKIE_KEY = 'v2ex_session';
const STORE_KEY = 'v2ex_daily';
const SUCCESS_TEXT = '每日登录奖励已领取';

function isActiveSession(cookie) {
  return cookie && cookie.length > 40 && 
         !cookie.includes('deleted') && 
         cookie.includes('A2=');
}

async function attemptCheckIn() {
  const cookie = $.read(COOKIE_KEY);
  
  // 会话有效性验证
  if (!isActiveSession(cookie)) {
    $.notify('❌ V2EX 签到失败', '未检测到有效会话', '请手动登录');
    return;
  }

  // 时间验证 (北京时间8点后)
  const cnTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"});
  if (new Date(cnTime).getHours() < 8) return;

  // 重复签到检查
  const dailyData = JSON.parse($.read(STORE_KEY) || '{}');
  if (dailyData.lastCheck && (Date.now() - dailyData.lastCheck < 86400_000)) {
    $.log('今日已签到');
    return;
  }

  try {
    // 第一步：获取签到参数
    const missionRes = await $.fetch({
      url: 'https://www.v2ex.com/mission/daily',
      headers: { Cookie: cookie }
    });
    
    // 会话有效性检查
    if (missionRes.body.includes('/signin')) {
      $.notify('⚠️ V2EX 会话已过期', '请手动登录', '点击重新登录', 'https://www.v2ex.com/signin');
      return;
    }

    // 第二步：执行签到
    const redeemPath = missionRes.body.match(/\/mission\/daily\/redeem\?once=\d+/)?.[0];
    if (redeemPath) {
      await $.fetch({
        url: `https://www.v2ex.com${redeemPath}`,
        headers: { Cookie: cookie }
      });
    }

    // 第三步：验证结果
    const verifyRes = await $.fetch({
      url: 'https://www.v2ex.com/mission/daily',
      headers: { Cookie: cookie }
    });

    if (verifyRes.body.includes(SUCCESS_TEXT)) {
      const consecutiveDays = verifyRes.body.match(/已连续登录 (\d+) 天/)?.[1] || 0;
      $.write(JSON.stringify({
        lastCheck: Date.now(),
        days: consecutiveDays
      }), STORE_KEY);
      $.notify('✅ V2EX 签到成功', `连续签到 ${consecutiveDays} 天`, '查看详情', 'https://www.v2ex.com/mission/daily');
    } else {
      throw new Error('签到结果验证失败');
    }
  } catch (e) {
    $.notify('❌ V2EX 签到异常', e.message);
  }
}

(typeof $request === 'undefined') ? attemptCheckIn() : $done();
