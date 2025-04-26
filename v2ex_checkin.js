const $ = new API("v2ex-checkin", true);
const KEY = "v2ex_daily_info";
const SUCCESS_TEXT = "每日登录奖励已领取";

function getStorage() {
  return JSON.parse($persistentStore.read(KEY) || {};
}

function setStorage(data) {
  $persistentStore.write(JSON.stringify(data), KEY);
}

function isSameDay(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
         date.getMonth() === now.getMonth() &&
         date.getDate() === now.getDate();
}

function handleCheckIn(text) {
  const daysMatch = text.match(/已连续登录 (\d+) 天/);
  const dailyInfo = {
    lastCheckInTime: Date.now(),
    checkInDays: daysMatch ? parseInt(daysMatch[1]) : 0
  };
  setStorage(dailyInfo);
  $.notify("✅ V2EX 自动签到", "", "签到成功");
}

async function checkIn() {
  // 检查时间是否在 8 点后
  if (new Date().getHours() < 8) return;

  const storage = getStorage();
  if (storage.lastCheckInTime && isSameDay(storage.lastCheckInTime)) return;

  const url = "https://www.v2ex.com/mission/daily";
  const res = await $.http.get({ url });
  
  if (res.status !== 200) {
    $.notify("❌ V2EX 自动签到", "", "请求失败");
    return;
  }

  const redeemLink = res.body.match(/\/mission\/daily\/redeem\?once=\d+/);
  
  if (redeemLink) {
    const redeemRes = await $.http.get({
      url: `https://www.v2ex.com${redeemLink[0]}`
    });
    
    if (redeemRes.body.includes(SUCCESS_TEXT)) {
      handleCheckIn(redeemRes.body);
    }
  } else if (res.body.includes(SUCCESS_TEXT)) {
    handleCheckIn(res.body);
  } else {
    $.notify("❌ V2EX 自动签到", "", "签到失败");
  }
}

if (typeof $request !== "undefined") {
  // 处理 MITM 响应
  checkIn();
  $done({});
} else {
  // 直接执行
  checkIn();
  $done();
}
