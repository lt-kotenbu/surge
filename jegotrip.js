// 无忧行自动签到（Surge 模块）
// 每天执行一次，无需手动打开 App

const token = "在这里填写你的 token"; // ←←← 请把这里替换为你的 token
const lang = "zh_CN";
const timestamp = Date.now().toString();

function hmac_sha1(str, key) {
  const crypto = require('crypto');
  return crypto.createHmac('sha1', key).update(str).digest('hex');
}

const sign_string = `lang=${lang}&timestamp=${timestamp}&token=${token}`;
const sign = hmac_sha1(sign_string, token);

const url = `https://app3.jegotrip.com.cn/api/service/v1/mission/sign/doSign?token=${token}&lang=${lang}&timestamp=${timestamp}&sign=${sign}`;

const headers = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
  "Content-Type": "application/json",
};

$httpClient.post({ url, headers }, (error, response, data) => {
  if (error) {
    $notification.post("无忧行签到 ❌", "网络请求失败", error);
  } else {
    try {
      const res = JSON.parse(data);
      if (res.code === 200) {
        const point = res.data?.point || "未知数量";
        $notification.post("无忧行签到 ✅", "成功", `获得无忧币：${point}`);
      } else {
        $notification.post("无忧行签到 ⚠️", "失败", res.msg || "未知错误");
      }
    } catch (e) {
      $notification.post("无忧行签到 ❌", "解析失败", e.message);
    }
  }
  $done();
});
