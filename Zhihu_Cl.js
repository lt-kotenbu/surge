
/*
引用地址 https://raw.githubusercontent.com/RuCu6/QuanX/main/Scripts/zhihu.js
增强版：集成自定义广告接口白名单/黑名单
生成时间：2025-11-08 21:02:25
*/

// 若响应体为空，直接放行
if (!$response?.body) $done({});

const url = $request.url;
let obj;
try { obj = JSON.parse($response.body); } catch { $done({}); }

// 未来时间常量（2090-12-31），避免误触发灰度/黑白模式、活动等
const FUTURE_TS_S = { start: 3818332800, end: 3818419199 };
const FUTURE_TS = { start: String(FUTURE_TS_S.start), end: String(FUTURE_TS_S.end) };

// —— 新增：广告/广告位接口匹配表 ——
// 说明：这些路径片段来自你抓取的候选列表，我们仅做了轻微规范化（最多保留前三段路径），避免过度匹配。
const AD_ENDPOINT_PATTERNS = ["/74hei20/nkypyt5/11chtfx8", "/74hei20/nkypyt5/e0zipeb8_main_0_1280x720.jpg", "/ad-style-service/request", "/ad-track/dream_third", "/ad-track/dream_third?ed=BDZPdwp1dHFoRDwDQz8lVAIhBGxaMT59D1UiC1R2OEMEeAhsUSc8IXNmayJ1aXgGWWgJC30Bd3QNE2tKcxYKckZwenh6cWp0fmRnX3R2IVEIeB8uVi5nFCZABhVQNCl0DjZSCEoiNCRoSiITDGBqUwIhBC8IOTMwK0dqQVg9KVk0KF1_BWU-OidBb0FCJ3EBWXUPbFEnPCERSDZSDHY_WFZ3D3gKZT40cxd0A1g0cQFbcQ9sSCpncnsUYlYBYXwAW3UJegtlLylzEmFTCGd4A193HyVLfmtmIFFvVhczJFxWdR85UX5qcXwXNFMBNWEHCnIPZwwmbXljHGADA30pBVN1WnoMcWpxfkd0BUFtdQVbcB8rTH4sKStSdBVYbXkAUyENegEgdyYtR2dKBWN8CEZ9DX4MbjglLBU0UFNkfwgPIB8jVSYzfWhKMw5VbWpdD3hQGlAsNCV_HX5UEr-T6MIbGpY%3D&tuc=3&position_id=2&ets=1762625124761&rt=native", "/ad-track/dream_third?ed=CTddd3kzKiwrAyYUXm19Fgk1BH4NdXwhOhgkDlQnakICeF95DnNvcH4Xf14HZ3kdXyNaLhV7byUqCGpXVTQpAF4hW3sLcHwzJhhgUQNiakMCeFh8XSJqd3dDfwYBY3sdXyBachV6aiEoCGtfB2ItCFl3Dn5bdnwvL0w2Whc0Il1WLkwrUTAyLztJOwZfPSleDGNQLl4iBS0qEG9BUjkoDVpyAHsKcGxydx1iXhc9LVNWY10-BXF8JCdBb1YBZH0WGywEeQhxaXd2F2dUAmR1CF9jXTBRJ2d1fR1rVwFgfwlcY1Y5BXJ8Lz5Rb1cXPz9GVncPZAllMy0rTG9BUjggDVtjUC5eImcDd2AWXgVmfh1bBHwIFXcZdncIECF3EmEFKHd7eAh3agF7HRdBQidxAVl1D2xVJ2cpHk09CVRhdBxYY0wjBXRpdHcSZlQFYmpeH3gMbFktPjIhTDYOVW1qWQYgUBVVJ299_dfvES1KOT0%3D&tuc=2&et=initiative&ets=1762625140217&rt=native", "/ad-track/dream_third?ed=CitdOFcqPikqGHQOVTYtDSh8fA4Bd2xyYxUTInN9eHNdfBQIfgUYbXtmYCUDYHgAKnABDx43KS9zFHQEWTxxAE0kTXdOKj83aEozDlVtal0KJgRsTSpnd30Ra1AFY3gCTSxdLFkcNyR7GHQJRW19FggsXXcJdmN1fRFnUAJhdQhNKkk-BXN8Lz0YY0FCOHECXXcLbFwtN30lUDMOQjgjRQcsWCRVJjQnaEEmWgN2JV0OLARsVSdnKR5NPQlUYXQcWGNbOFx-GzA-STdBQjlxBVImDntedWptfRI0AhxkfgdfaFt-XHF3c3wWZ1ZQYH8EX3cPbFcwLH18E3xWFyM7DVp3CXweJzMkcxRiUwB2LkBWdg58HicgKSoYZ1QJaXwAW3YNcx4zM318HGtfB2Z5BVJzDnIAc3wpI0A7OFw0eQ1NN1B3CydjJHxBYVYcZXQJU2gNLAsidyF-HTNKBWAtCFsjWCwIcGIlXzwiyZdmKkQ%3D&tuc=2&ets=1762625155759&rt=native", "/ad-track/dream_third?ed=CjEEPFEmLWYhViRaA2ZiAU0kVy5KLDMkJ0FvQUUjIw1aY1ojXH5reHoSZVIEZXsGWHcOfw92fC0qGDs3WT8iVVp9FXkeJzQtc0Y6ElA-P1gKK1MjWS0_N2hKIVoAdiVdDixmJ1x2Z2YtTT5aAXYuQFZxCXoeMTN9LBRhBABmf1VGJ10pXW5uI3xDf15TYC8dDXNcL1x3ayV3QzZUFzkoVgoaVC4NfnwiPEFvJkEgIFVNK013CWU-KSoYY1cDZ2pfCixddx4nICkqGCgPWDg5b1p1DCxULC0fJ0ohQUI4cQJddwtsXDdncmhIMwQMdjlZVnIKfgF0bnN6F3QURm19AltzHyVIN2dwaFY7WgViKAJbIw9_FXVjdSoIZgYBZWFRXiZfZwhybyMqHGRfCDEvVE01UHcKdGhxdhFlVwBgfQBbdR8jXCU7fQ0cFyMIZHoCRnV4D3pubgN4HH8ldxYOHV4GCwgKc25wDxBqIhc5IVUCeOK1R_doZcwe&tuc=1&ets=1762625139384&rt=native", "/ad-track/dream_third?ed=CjEEPFEmLWYvSzYVXjkoWQ94HyNcJTt9DRwXIwhkegJGdXgPem5uA3gcfyV3Fg4dXgYLCApzbnAPEGoiFzkhVQJ4Hz9Rfm1zehxlUwJkfhYENgR7HiAyLHMVdBdYbXkBXXQNeA1lNTM4GGBRH2FqQwN4C3wKcXwvPlFvVxciJQ0IfFhzWiBqI2NEMFYHfXgCU3MUKA0nO216F2VTATJ0UlpxCCweMC19fxdiURc0JVRWdwhsSypndiwVNwYBMXsdDXUKehV3b3ksCGpeUzZhVVt2WnJeem4mLxI2QVg0KlE0KF1_BWU-LiMYBg5QPgtfBSIfJEx-b2Y6Vj1aAHYuQFZ1HyVZKj59aEg2WlgAJF8FIAhyFHB8IjxBbyZBICBVTSFNdwplNyEtGHQOXDUlbwYhDHceJyApKhgmDlA-K18FIhR4CW4zLz0DMQ5VbX8AU3cJfA16b3h_HWFRAGB5BlLn8WVg-yeIuw%3D%3D&tuc=1&ets=1762625119879&rt=native", "/ad-track/dream_third?ed=GDIEewpzbGYsVzZacCA8XA5jWCRcMTUpKkw2WhcjJA1Zcwt4HiwpfX8DMQ9dbXwWCTUEfA53fCE6GCQOVCdqXxgzBHgObWtmOlY9WgB2L1kPeAh9DnpqdH0XYVQHaWpAAngLcwFxYnB9F2JUB2N5Bk0oXXdREzIvIEBjXx1jalQfeAtsUSc8IRFINlIMdiNAH3gJbEsqZ3csQGEBV2Z1HVonDS4Vd2khdghrVFRjYQEPcQ0uCCBodn8RZUFVPiENADBYI0srNTUiTDMJXDUiV00oWCkFZT46J0FvUgJodQBbdQp-DWU0NHMUdA5cNSVvBiEMdx42M315FmZeBmR_BFljXSNcfmtwehR0Dlw1JQ1NLF0sWX4ZeQtha1MHYmEAKgB7ZwwAbHljZxQhc315c1kHC3oMcxt1dmB0CFA5KA1NN1B3CSZudioUawIcaX0GCWgNeQEmd3l4FWRKUDQoBwonWnIOcW11lckNLBCOg4s%3D&tuc=2&et=passive&ets=1762625134585&rt=native", "/ad-track/zplus_log", "/ad-track/zplus_log?ui=218.1.147.153&cc=310000&hp=0&dts=1762625121&zri=-5374853500506297171&cmi=473717e621c118d1fd30f1955bd9118f&tev=0&zpt=&ri=feed-root:currency:00395fba-ddfe-4a19-9dad-3b65f1497be9&cl=360700&zk=&ar=0.01999610662460327&ed=CCRXd14iNjMrAyQdWG18FhgqBHgeKjl9fwMnBAx2P0AJeAlsWTkzfXcca14XNS9ACDEEeh4wKjUnQSFaFzMlDVp8D3gJe255fBZhVAdhfQhefAhsWywufX4DMQhCbXgATSpaPEp-am5-FWJTB2h6B1p2C3sAdWJ4dxNnQVA5cQNdcQx-D3p8Iy9Mb1UHZXwBUncfKVQwZ3F-FWJRAWB8AF91CX4McWlwexZ0F0M5cQBNJ0l3DHN8ITxOb1YXJSVeVnQJeghyanB4EHQGUyBxBFtjVilIOz0vL0lvVxcmLkRWdR8jUTdncGhGIVoXMzhJVjVQJB4gLn1_EGtWBmh-FgQmSTJIfmpmLUEmEwxgalEdLAR9CHFid3YDIQ5cbWEDXHUIcwl1bHB6HGRVBmN-A1t1HzBILy8zPlFvVxcgPllZeAlsSjMoKXMUY18CYX8WCCFNIwVyY3Z8FGpTCGJ_A1hzCHsAdmNxaFY7WlNnKQMJJFwuFXVrJi8IZlRQYWEIU3ZdZw97O3N-EWoGAjJ0Vk0mUSgFc3wlLVUxFAxgalkMNgR6HiI8IS0Yd1BzdX4CDiZJKR1xaGV9ZGNCAxNpAlkyXCNfKy4lKno0BlIkI0JOdwtvCwJrZXxmd1UDMyNDHxpfK1s3NTJrF2BCAhF9FVkGHHgKLy4yaxdgQgIRfBVZBhx4Ci8uMhFJPQBYJGkCWWAKCwhmaANrF2AIUiAvbwkjHHgKZmkBfwBgJBRiflIEKk1vCnF_cw8Ud1B1diBFAngOeQx6bXR9EWBBVTM6QlZ1F3oIc2pwfhRiUQBkfgFacgp7D3VpcX0QdAVePzhZD3gJbFsxM319EGtQAWB7FgQmSTJLfmpmLUEmFAxgLXlAaJyApyU=&iti=__IS_THREE_IMAGE__&mcdtt=0&cmv=zplus-creative-v4&cla=3&zpluspt=0&mcdti=1962184923336118591&cv=10.74.0&isy=__IMAGE_STYLE__&pt=1&mix=__MIX__INFO__&at=CjEEI1UzKCU9VjsIXwyIzIulhGWC&debug=1&et=&ev=&tuc=0&ets=1762625121947&rt=native", "/ad-track/zplus_log?ui=218.1.147.153&cc=310000&hp=0&dts=1762625121&zri=-5374853500506297171&cmi=473717e621c118d1fd30f1955bd9118f&tev=0&zpt=&ri=feed-root:currency:00395fba-ddfe-4a19-9dad-3b65f1497be9&cl=360700&zk=&ar=0.01999610662460327&ed=CCRXd14iNjMrAyQdWG18FhgqBHgeKjl9fwMnBAx2P0AJeAlsWTkzfXcca14XNS9ACDEEeh4wKjUnQSFaFzMlDVp8D3gJe255fBZhVAdhfQhefAhsWywufX4DMQhCbXgATSpaPEp-am5-FWJTB2h6B1p2C3sAdWJ4dxNnQVA5cQNdcQx-D3p8Iy9Mb1UHZXwBUncfKVQwZ3F-FWJRAWB8AF91CX4McWlwexZ0F0M5cQBNJ0l3DHN8ITxOb1YXJSVeVnQJeghyanB4EHQGUyBxBFtjVilIOz0vL0lvVxcmLkRWdR8jUTdncGhGIVoXMzhJVjVQJB4gLn1_EGtWBmh-FgQmSTJIfmpmLUEmEwxgalEdLAR9CHFid3YDIQ5cbWEDXHUIcwl1bHB6HGRVBmN-A1t1HzBILy8zPlFvVxcgPllZeAlsSjMoKXMUY18CYX8WCCFNIwVyY3Z8FGpTCGJ_A1hzCHsAdmNxaFY7WlNnKQMJJFwuFXVrJi8IZlRQYWEIU3ZdZw97O3N-EWoGAjJ0Vk0mUSgFc3wlLVUxFAxgalkMNgR6HiI8IS0Yd1BzdX4CDiZJKR1xaGV9ZGNCAxNpAlkyXCNfKy4lKno0BlIkI0JOdwtvCwJrZXxmd1UDMyNDHxpfK1s3NTJrF2BCAhF9FVkGHHgKLy4yaxdgQgIRfBVZBhx4Ci8uMhFJPQBYJGkCWWAKCwhmaANrF2AIUiAvbwkjHHgKZmkBfwBgJBRiflIEKk1vCnF_cw8Ud1B1diBFAngOeQx6bXR9EWBBVTM6QlZ1F3oIc2pwfhRiUQBkfgFacgp7D3VpcX0QdAVePzhZD3gJbFsxM319EGtQAWB7FgQmSTJLfmpmLUEmFAxgLXlAaJyApyU=&iti=__IS_THREE_IMAGE__&mcdtt=0&cmv=zplus-creative-v4&cla=3&zpluspt=0&mcdti=1962184923336118591&cv=10.74.0&isy=__IMAGE_STYLE__&pt=1&mix=__MIX__INFO__&at=CjEEPFEmLWm8-o_znDYB&ev=&et=&debug=1&tuc=1&ets=1762625122006&rt=native", "/ad.union.api/bf5e589298565ce32466b3c447d657c3", "/ad.union.api/bf5e589298565ce32466b3c447d657c3?lk3s=d16ba171&x-expires=1942070400&x-signature=c%2Bx%2BKPPuk7yBo6sDGGSYTitFx50%3D", "/api/common/ads", "/brand-ad/image/87e7-240116", "/bs2/adUnionVideo/6a3209c415294d78a6fbc815035d9dbb.jpg", "/bs2/adUnionVideo/93d734852f2f4ff2a1f0d5622071338a.jpg", "/bs2/adUnionVideo/aac2af500da442848a4123a77514d3f6.jpg", "/commercial_api/answer/1964758676352012948", "/commercial_api/answer/1968141324810172343", "/commercial_api/answer/1970585449224475995", "/commercial_api/answer/1970594474603307782", "/commercial_api/answer/1970597652069614784", "/commercial_api/app_float_layer", "/commercial_api/banners_v3/app_float_corner", "/commercial_api/banners_v3/app_float_corner?token=1964758676352012948&type=answer", "/commercial_api/banners_v3/app_float_corner?token=1968141324810172343&type=answer", "/commercial_api/banners_v3/app_float_corner?token=1970585449224475995&type=answer", "/commercial_api/banners_v3/app_float_corner?token=1970594474603307782&type=answer", "/commercial_api/banners_v3/app_float_corner?token=1970597652069614784&type=answer", "/commercial_api/banners_v3/app_topstory_banner", "/commercial_api/launch_v2", "/commercial_api/launch_v2?app=zhihu&non_full_size=1206%2A2232&size=1206%2A2622&vf=mp4", "/commercial_api/real_time_launch_v2", "/commercial_api/real_time_launch_v2?ZHLaunchContextAppDelegateKey=%3CZHAppDelegate%3A%200x11a6bbde0%3E&ZHLaunchContextUIApplicationKey=%3CUIApplication%3A%200x114200460%3E&app=zhihu&is_recommend=1&non_full_size=1206%2A2232&request_type=sync&size=1206%2A2622&start_type=cold&vf=mp4", "/commercial_api/real_time_pull_refresh_v2", "/commercial_api/real_time_pull_refresh_v2?size=750%2A600", "/commercial_api/real_time_second_floor_v2", "/content-promotion/super-coupon/remind", "/content-promotion/super-coupon/remind?scene_code=detail", "/dsp/np", "/dsp/np?posid=1999&v=707&union_id=1000023384&pid=103676&tagid=501406&resource_posid=32203&didmd5=__5IMEI5__&idfamd5=4aa5fa4bc346a14779e270f9ec51eb57&did=__IMEIIMEI__&idfa=__IDFAIDFA__&oaid=__OAID__&caidmd5=__CAID1__&oaidmd5=__OAID1__&caid=%5B%7B%22caid%22%3A%22510b5f3b90581803d7ea6b064d5895d4%22%2C%22version%22%3A%2220250325%22%7D%2C%7B%22caid%22%3A%22658969521c3f53c15109c8d671b11668%22%2C%22version%22%3A%2220230330%22%7D%5D&tg_ext=0-009900-a8327b569fde427b877c601ecb504798-tgx-5160448-19646-20251108-1762607439&ip=116.233.127.44&pl=6612&unt=40965&ct=2882599&external_request_id=38cb5d51-b863-46de-b32c-f92b836516e3", "/dsp/np?posid=1999&v=707&union_id=1000023384&pid=103676&tagid=501406&resource_posid=32203&didmd5=__5IMEI5__&idfamd5=4aa5fa4bc346a14779e270f9ec51eb57&did=__IMEIIMEI__&idfa=__IDFAIDFA__&oaid=__OAID__&caidmd5=__CAID1__&oaidmd5=__OAID1__&caid=__CAID__&tg_ext=0-005101-8646f6d401d54fc19ab8e8ce050eb44f-tgx-5161425-20826-20251109-1762625119&ip=218.1.147.153&pl=6612&unt=40965&ct=2932163&external_request_id=c9a9bc0c-ab16-4286-b5da-42740b8b141f", "/dsp/np?posid=1999&v=707&union_id=1000023384&pid=103676&tagid=501406&resource_posid=32203&didmd5=__5IMEI5__&idfamd5=4aa5fa4bc346a14779e270f9ec51eb57&did=__IMEIIMEI__&idfa=__IDFAIDFA__&oaid=__OAID__&caidmd5=__CAID1__&oaidmd5=__OAID1__&caid=__CAID__&tg_ext=0-008901-4de8b708d97b4c2b8860039481e9f4ec-tgx-5160448-19498-20251108-1762607615&ip=116.233.127.44&pl=6612&unt=40965&ct=2882602&external_request_id=92b1063d-6796-4404-b274-cdc05bbfcc8d", "/dsp/np?posid=1999&v=707&union_id=1000023384&pid=103676&tagid=501406&resource_posid=32203&didmd5=__5IMEI5__&idfamd5=4aa5fa4bc346a14779e270f9ec51eb57&did=__IMEIIMEI__&idfa=__IDFAIDFA__&oaid=__OAID__&caidmd5=__CAID1__&oaidmd5=__OAID1__&caid=__CAID__&tg_ext=0-008901-af08db1328664815b7b75eba04d90e2e-tgx-5160448-19498-20251108-1762614531&ip=218.1.147.153&pl=6612&unt=40965&ct=2882602&external_request_id=fbd98d06-cd24-453c-8468-40780eb70139", "/dsp/np?posid=1999&v=707&union_id=1000023384&pid=103676&tagid=501406&resource_posid=32203&didmd5=__5IMEI5__&idfamd5=4aa5fa4bc346a14779e270f9ec51eb57&did=__IMEIIMEI__&idfa=__IDFAIDFA__&oaid=__OAID__&caidmd5=__CAID1__&oaidmd5=__OAID1__&caid=__CAID__&tg_ext=0-009900-272cd9e0ccd04b2d82e24f53ffa02291-tgx-5160448-20866-20251108-1762611618&ip=218.1.147.153&pl=6612&unt=40965&ct=2898104&external_request_id=5d6adf93-385f-46b4-95dd-d999fb58a34f", "/dsp/np?posid=1999&v=707&union_id=1000023384&pid=103676&tagid=501406&resource_posid=32203&didmd5=__5IMEI5__&idfamd5=4aa5fa4bc346a14779e270f9ec51eb57&did=__IMEIIMEI__&idfa=__IDFAIDFA__&oaid=__OAID__&caidmd5=__CAID1__&oaidmd5=__OAID1__&caid=__CAID__&tg_ext=0-009900-519aa195c2044e14aea3bbd4801747c8-tgx-5160448-19646-20251108-1762614399&ip=116.233.127.44&pl=6612&unt=40965&ct=2882599&external_request_id=e62cec5e-cf75-49f9-8643-5ee707ce2292", "/dsp/np?posid=1999&v=707&union_id=1000023384&pid=103676&tagid=501406&resource_posid=32203&didmd5=__5IMEI5__&idfamd5=4aa5fa4bc346a14779e270f9ec51eb57&did=__IMEIIMEI__&idfa=__IDFAIDFA__&oaid=__OAID__&caidmd5=__CAID1__&oaidmd5=__OAID1__&caid=__CAID__&tg_ext=0-009900-73a6f913b46441c8918a4028b40d8019-tgx-5160448-20717-20251108-1762607347&ip=218.1.147.153&pl=6612&unt=40965&ct=2882620&external_request_id=f7256768-b4ed-4fca-8bc5-565a9620f7e0", "/dsp/np?posid=1999&v=707&union_id=1000023385&pid=103692&tagid=501406&resource_posid=32203&didmd5=__5IMEI5__&idfamd5=4aa5fa4bc346a14779e270f9ec51eb57&did=__IMEIIMEI__&idfa=__IDFAIDFA__&oaid=__OAID__&caidmd5=__CAID1__&oaidmd5=__OAID1__&caid=__CAID__&tg_ext=0-005101-9d03bd9a502f495eb9ac283c50f52314-tgx-5161424-21347-20251109-1762625030&ip=116.233.127.44&pl=6593&unt=40972&ct=2926773&external_request_id=2e23d264-2f4d-40f8-98f4-105d3ea04a31", "/dsp/np?posid=1999&v=707&union_id=1000027281&pid=103863&tagid=501406&resource_posid=32203&didmd5=__5IMEI5__&idfamd5=4aa5fa4bc346a14779e270f9ec51eb57&did=__IMEIIMEI__&idfa=__IDFAIDFA__&oaid=__OAID__&caidmd5=__CAID1__&oaidmd5=__OAID1__&caid=__CAID__&tg_ext=0-005101-40019a5c1f8a42a0b2b9a4cb0c50c0bd-tgx-5161422-19104-20251109-1762624252&ip=116.233.127.44&pl=6768&unt=41728&ct=2915479&external_request_id=b1d647e1-9a98-4ded-a48c-6dcbed73bf8c", "/dsp/np?posid=1999&v=707&union_id=1000027281&pid=103863&tagid=501406&resource_posid=32203&didmd5=__5IMEI5__&idfamd5=4aa5fa4bc346a14779e270f9ec51eb57&did=__IMEIIMEI__&idfa=__IDFAIDFA__&oaid=__OAID__&caidmd5=__CAID1__&oaidmd5=__OAID1__&caid=__CAID__&tg_ext=0-005101-b09545de1d704b72afd5217106b763e8-tgx-5161422-19104-20251109-1762624384&ip=218.1.147.153&pl=6768&unt=41728&ct=2915479&external_request_id=93048f8a-2d49-4884-9bd2-c6b1e1f89c51", "/kuaishou/trace/click", "/next-render", "/next-render?context_expand=1&id=1970585449224475995&is_native=1&limit=5&page_id=2&scenes=recommend&session_id=1762625143881384305&type=answer", "/next-render?context_expand=1&id=1970585449224475995&is_native=1&limit=5&page_id=3&scenes=recommend&session_id=1762625143881384305&type=answer", "/next-render?context_expand=1&id=1970597652069614784&is_native=1&limit=5&page_id=2&scenes=recommend&session_id=1762625137998401956&type=answer", "/next-render?context_expand=1&id=1970597652069614784&is_native=1&limit=5&page_id=3&scenes=recommend&session_id=1762625137998401956&type=answer", "/next-render?id=1964758676352012948&type=answer&scenes=recommend&context_expand=1&is_native=1", "/next-render?id=1968141324810172343&type=answer&scenes=recommend&context_expand=1&is_native=1", "/next-render?id=1970585449224475995&type=answer&scenes=recommend&context_expand=1&is_native=1", "/next-render?id=1970594474603307782&type=answer&scenes=recommend&context_expand=1&is_native=1", "/next-render?id=1970597652069614784&type=answer&scenes=recommend&context_expand=1&is_native=1", "/plutus_adreaper/ad_adx_log", "/plutus_adreaper/ad_adx_log?cv=10.74.0&ts=1762625123&pf=iOS&za=T1M9aU9TJlJlbGVhc2U9MjYuMSZNb2RlbD1pUGhvbmUxOCwzJlZlcnNpb25OYW1lPTEwLjc0LjAmVmVyc2lvbkNvZGU9Mjc0MDgmV2lkdGg9MTIwNiZIZWlnaHQ9MjYyMiZEZXZpY2VUeXBlPVBob25lJkJyYW5kPUFwcGxlJk9wZXJhdG9yVHlwZT02NTUzNTY1NTM1&di=tower&pref=0&ed=CjEEI1UzKCU9VjsIX3YtSlZ9HzlRfm9wdkFmVwgzYVYIJwxnDHBqeGMdZlMFfS5VCXVffVp3aXgqQHQLRG17A198Dn4Ld2hmO1FvVAg1ewNaJgB5WidsdH9AZwYCYi8DXnUPelonbCN7HDBBVTlxAl50CXsIcmpwfhViVwJ2KEMbLAR7CHdsZi1MbwIBKiVADicBbFssZ3d3HGFBRSA4DVhyHytRJ2dxfBdiUwh2NlMCeAh-AXtqcWhEIVoAdj9UAHgJbFozZ3d3HGFh1MSPA-nosA==&tuc=3&position_id=2&ets=1762625124758&rt=native", "/plutus_adreaper/ad_adx_log?cv=10.74.0&ts=1762625123&pf=iOS&za=T1M9aU9TJlJlbGVhc2U9MjYuMSZNb2RlbD1pUGhvbmUxOCwzJlZlcnNpb25OYW1lPTEwLjc0LjAmVmVyc2lvbkNvZGU9Mjc0MDgmV2lkdGg9MTIwNiZIZWlnaHQ9MjYyMiZEZXZpY2VUeXBlPVBob25lJkJyYW5kPUFwcGxlJk9wZXJhdG9yVHlwZT02NTUzNTY1NTM1&di=tower&pref=0&ed=CjEEPFEmLWYvX29fFyMlDV51AS4Mc2MjY0MxBQR9eANbfRRyDHdubSxAMFdXZy4EWH1dLx4vL315FmZeBmR_BFljTD4FcGMleRZjBAhjLlRdcQgvDSJpci0WZ1cHYC5UXSYMc1plPilzF2dWAWF8AVt1CXoIc2lmKlYiDgxhfARdY1ojBSZqOidVNwUJdi9fVnIAcwtlLjA6GGFQFzElVFZ0C3gId2NmNEY7WgBkdQhbdB8rS35rZj1BOVoBdi5AVnIAcwvv4onUO72DdQ==&tuc=3&position_id=2&ets=1762625124761&rt=native", "/plutus_adreaper/ad_adx_log?cv=10.74.0&ts=1762625133&pf=iOS&za=T1M9aU9TJlJlbGVhc2U9MjYuMSZNb2RlbD1pUGhvbmUxOCwzJlZlcnNpb25OYW1lPTEwLjc0LjAmVmVyc2lvbkNvZGU9Mjc0MDgmV2lkdGg9MTIwNiZIZWlnaHQ9MjYyMiZEZXZpY2VUeXBlPVBob25lJkJyYW5kPUFwcGxlJk9wZXJhdG9yVHlwZT02NTUzNTY1NTM1&wp=XXYJnME4-NwEy_E=&di=tower&pref=0&tsli=1739273675091275727&ed=CjEEI1UzKCU9VjsIX3YtSlZ9HzlRfmslehM2Vgg1YQlac1tnDHBjJWMcZFcHfS1UD3JYKFt7bHJ5EHQLRG17A198Dn4Ld2hmO1FvVgAzeVFScgp_DyFodCsdNwVQaHQCWSMOfA4nOyZ5HTNBVTlxAlJ8C3IIcGhwfRNhUgd2KEMbLAR7CHdrZi1Mb1YGZnUAX3YLeQt1Y2YtSm9RB2RqRBsxBHsIdXwhJ0FvVxcqL1lWdR8rS35oZj1BOVoBdi5AVnMPflRBVOPhGkwX&tuc=0&position_id=0&ets=1762625134560&rt=native", "/plutus_adreaper/ad_adx_log?cv=10.74.0&ts=1762625133&pf=iOS&za=T1M9aU9TJlJlbGVhc2U9MjYuMSZNb2RlbD1pUGhvbmUxOCwzJlZlcnNpb25OYW1lPTEwLjc0LjAmVmVyc2lvbkNvZGU9Mjc0MDgmV2lkdGg9MTIwNiZIZWlnaHQ9MjYyMiZEZXZpY2VUeXBlPVBob25lJkJyYW5kPUFwcGxlJk9wZXJhdG9yVHlwZT02NTUzNTY1NTM1&wp=XXYJnME4-NwEy_E=&di=tower&pref=0&tsli=1739273675091275727&ed=CjEEPFEmLWYvX29fFyMlDVogDXxccmMlYxxjUVN9eANSIBRzDnNsbS9BNlBQMi8IXXcOfx4vL315FmZeBmR_BFljTD4Fcmsje0RrUAJle1JZcVxyXSE7eHYXYAEGZnpUCiMOclllPilzF2teA2h8A1l1CnwLdmxmKlYiDgxhfARaY1ojBXJtdncVZlQDY38GUmNaJQV1bHRoUSITDGF8Bk0kUC4Fc3w6LUxvVxcxPw1ZY0ouU35qZixVb1EHZJLPX9QZffe1&tuc=2&et=passive&ets=1762625134586&rt=native", "/plutus_adreaper/ad_adx_log?cv=10.74.0&ts=1762625137&pf=iOS&za=T1M9aU9TJlJlbGVhc2U9MjYuMSZNb2RlbD1pUGhvbmUxOCwzJlZlcnNpb25OYW1lPTEwLjc0LjAmVmVyc2lvbkNvZGU9Mjc0MDgmV2lkdGg9MTIwNiZIZWlnaHQ9MjYyMiZEZXZpY2VUeXBlPVBob25lJkJyYW5kPUFwcGxlJk9wZXJhdG9yVHlwZT02NTUzNTY1NTM1&wp=WHwL9zt2zolJ_ik=&di=tower&pref=0&ed=CjEEI1UzKCU9VjsIX3YtSlZ0CX8eMDN9LBRhBABmf1VGJ10pXW5uI3xDf15TYC8dDXNcL1x3ayV3QzZUFzw5DVx2DXMPd2l0fAMnEww2dQAKIw0sC3dpJXcRY1JVaCkCD3ZcfQh2aSV4QDFfB3YoWVZ3DngJe253fhRiVgFgfBYPNkkjBXJqcnkDMQ4MYXQEXHIMfw10bHN8EmdQBHYvX1ZxCXoeNyo0cxZqQVA5KA1bY0MpUX5qZi9Wb1UXIyhbVnUfKEh-bnB-rlqou7TFHTY=&tuc=0&ets=1762625138576&rt=native", "/plutus_adreaper/ad_adx_log?cv=10.74.0&ts=1762625137&pf=iOS&za=T1M9aU9TJlJlbGVhc2U9MjYuMSZNb2RlbD1pUGhvbmUxOCwzJlZlcnNpb25OYW1lPTEwLjc0LjAmVmVyc2lvbkNvZGU9Mjc0MDgmV2lkdGg9MTIwNiZIZWlnaHQ9MjYyMiZEZXZpY2VUeXBlPVBob25lJkJyYW5kPUFwcGxlJk9wZXJhdG9yVHlwZT02NTUzNTY1NTM1&wp=WHwL9zt2zolJ_ik=&di=tower&pref=0&ed=CjEEPFEmLWYvX29WAWVqQwJ4W3sLIGt2fUB_BVUzKR1fJgssFXo4cC0INFFUNSgEWiAALFxwfCw7GGVUBWl7BFhxC2xNN2cmdxUzAQU2fwRYIAB-CXY-eCsXNlRUZ3wFWCAPL1t7bGYqTG9VBmJ9CF9yCXsIcmpwfgM2FEE5cQFbdw5sWypncXYRZVAEZXkHXXYLfQ10b2YtSm9TAWBqRBsxBHkAZTspKhhiQUszJQ1bY1g5BXF8MypOb1cXMjwNX3UJ3DtwiKcVRn4=&tuc=1&ets=1762625139384&rt=native", "/plutus_adreaper/ad_adx_log?cv=10.74.0&ts=1762625138&pf=iOS&za=T1M9aU9TJlJlbGVhc2U9MjYuMSZNb2RlbD1pUGhvbmUxOCwzJlZlcnNpb25OYW1lPTEwLjc0LjAmVmVyc2lvbkNvZGU9Mjc0MDgmV2lkdGg9MTIwNiZIZWlnaHQ9MjYyMiZEZXZpY2VUeXBlPVBob25lJkJyYW5kPUFwcGxlJk9wZXJhdG9yVHlwZT02NTUzNTY1NTM1&wp=X3YO_Mtg-1EtE98=&di=tower&pref=0&ed=CjEEI1UzKCU9VjsIX3YtSlZ0D3gJZSkpc0NhUQFlfABZaAB8D3Z3dChGNkoJZSlURn0JLlwmanUqR2NUAnYgRVZyCn4BdG5zehd0A1htfwBZdg5yCnZpc3ocalMXND9AAngIegxyfCMnGGNQCGF-A113AHIIenwjIRhmUgd2OEAfeAhzCWU7KSoYYkFLMyUNW2NYOQVxfDMqTm9XFzI8DV9wD5OD6PIVu227&tuc=0&position_id=1&ets=1762625139012&rt=native", "/plutus_adreaper/ad_adx_log?cv=10.74.0&ts=1762625138&pf=iOS&za=T1M9aU9TJlJlbGVhc2U9MjYuMSZNb2RlbD1pUGhvbmUxOCwzJlZlcnNpb25OYW1lPTEwLjc0LjAmVmVyc2lvbkNvZGU9Mjc0MDgmV2lkdGg9MTIwNiZIZWlnaHQ9MjYyMiZEZXZpY2VUeXBlPVBob25lJkJyYW5kPUFwcGxlJk9wZXJhdG9yVHlwZT02NTUzNTY1NTM1&wp=X3YO_Mtg-1EtE98=&di=tower&pref=0&ed=CjEEPFEmLWYvX29WB2J9FhgsBCwLdWp1fhVgSghmewVGcV8pXG5idStBf18BNChVW3BdKAlwaWYiUG9QAmR1B192DXgeJzN9fRVgVAZofgVYdg1zAHd8JD1VO1oAYHgBTSZQdwl0Y3F8FmRVCGh8CU0mVncMdmxmOlUmWgBpfRYKLF13CGUgIycYYkFQI3ECTTZdIQVzfCI-GGZSB2X1IStaFi-i&tuc=2&et=initiative&ets=1762625140218&rt=native", "/plutus_adreaper/ad_adx_log?cv=10.74.0&ts=1762625154&pf=iOS&za=T1M9aU9TJlJlbGVhc2U9MjYuMSZNb2RlbD1pUGhvbmUxOCwzJlZlcnNpb25OYW1lPTEwLjc0LjAmVmVyc2lvbkNvZGU9Mjc0MDgmV2lkdGg9MTIwNiZIZWlnaHQ9MjYyMiZEZXZpY2VUeXBlPVBob25lJkJyYW5kPUFwcGxlJk9wZXJhdG9yVHlwZT02NTUzNTY1NTM1&wp=WHMNuskWK0fFb8g=&di=tower&pref=0&ed=CjEEI1UzKCU9VjsIX3YtSlZ0CX8eMDN9fUFrAwM0fwFGcAFzAG5uJn1EfwYBaC0dX3VYcgglOyZ-FmoCFzw5DVx2DXMPd2l0fAMnEww2dQAKIw0sC3dpJXcRY1JVaCkCD3ZcfQh2aSV4QDFfB3YoWVZ3AHMAdWx1exxkUAlofBYPNkkjBXJqdH8DMQ4MYXkJXnYNfw9wa3l2AzEIDGN7Bk0xST4FcGJmL0w2WgF2NlMCeAlsWTBncmhWNgwMYGpSG3gKfQ49FzMEN1LVIA==&tuc=0&ets=1762625155142&rt=native", "/plutus_adreaper/ad_adx_log?cv=10.74.0&ts=1762625154&pf=iOS&za=T1M9aU9TJlJlbGVhc2U9MjYuMSZNb2RlbD1pUGhvbmUxOCwzJlZlcnNpb25OYW1lPTEwLjc0LjAmVmVyc2lvbkNvZGU9Mjc0MDgmV2lkdGg9MTIwNiZIZWlnaHQ9MjYyMiZEZXZpY2VUeXBlPVBob25lJkJyYW5kPUFwcGxlJk9wZXJhdG9yVHlwZT02NTUzNTY1NTM1&wp=WHMNuskWK0fFb8g=&di=tower&pref=0&ed=CjEEPFEmLWYvX29WAWVqQwJ4Ci4BJ2gkfRR_UglpdB1fIworFSJqeC8IZldQaHxWCiMJeQAmfCw7GGVUBWl7BFhxC2xNN2cmdxUzAQU2fwRYIAB-CXY-eCsXNlRUZ3wFWCAPL1t7bGYqTG9VCGl0Bl1wDHMOdGJ4fgM2FEE5cQFbcQhsWypncXscZ1QFZXsDWnwBbFssZ3N5E3QTQSRxA1NjWCNcfmpmNEY7WgF2LUNWdx85XChncGhHIloCZ3rgbJ2q6Xe2xQ==&tuc=2&ets=1762625155760&rt=native", "/prom/v2/verify", "/prom/v2/verify?source=SJ_ks25nsgs11pphtl_20&app_type=ios&app=group&coderesp=true&mt_channel=kuaishou&click_time=1762625134585&mac=&md5mac=&splitmac=&ip=218.1.147.153&campaign_id=5644947982&campaign_name=%E6%A0%B8%E6%A1%83%E6%9E%97%2DIOS%2D%E8%AE%A2%E5%8D%95%2D%E8%81%94%E7%9B%9F%2D%E5%9B%BE%E7%89%87%2D%E5%93%81%E7%89%8C%E4%BC%9A%E5%9C%BA%2D%E7%9B%AE%E6%A0%87%E4%BA%BA%E7%BE%A4%2D%E6%B7%B7%E5%93%81%2D%E5%A4%9A%E5%93%81%2D1031001%2DSJ%5Fks25nsgs11pphtl%5F20&adgroup_id=16075908658&creative_id=176904323369&csite=5&feedback_url=http%3A%2F%2Fad.partner.gifshow.com%2Ftrack%2Factivate%3Fcallback%3Dcw9ZD8CFUzcneHSPdwEPV4KiYis7B3STXy2dD11620ZAYgkMs1MN4RpWn2z0PR7z8zTiDyN-Nu4J02v6Zb8VumM-Fec4a5_5z5ETt73V60duJtRA21Rw3EZ1Rig1H0PrccOz2mHQnSAzw5_uJKr1LvbU5XdQ4x8ghi_SsaOpykJXgiEjKUb7cG6w-_mumHBW1n_pblb3hatvGufNyIal7sWhXUwzmf93on98Md3VKTM&md5_idfa=4AA5FA4BC346A14779E270F9EC51EB57&sha_idfa=5E37924642F8953D2F8E0D54372C39E79AAC1DC6&advertiser_id=70127674&ad_position_id=3x3wmipsixcgia9&vid=7&caid=%5B%7B%22kenyid%22%3A%22510b5f3b90581803d7ea6b064d5895d4%22%2C%22kenyid_MD5%22%3A%227833fd4d5d229d8e2eeec60b6d67fa3e%22%2C%22kenyId%22%3A%22510b5f3b90581803d7ea6b064d5895d4%22%2C%22kenyId_MD5%22%3A%227833fd4d5d229d8e2eeec60b6d67fa3e%22%2C%22version%22%3A%2220250325%22%7D%2C%7B%22kenyid%22%3A%22658969521c3f53c15109c8d671b11668%22%2C%22kenyid_MD5%22%3A%22b690a90e4daa8c10bd1571dc631c52fd%22%2C%22kenyId%22%3A%22658969521c3f53c15109c8d671b11668%22%2C%22kenyId_MD5%22%3A%22b690a90e4daa8c10bd1571dc631c52fd%22%2C%22version%22%3A%2220230330%22%7D%5D&request_id=2005195901733943410&photoid=__PHOTOID__&rta_trace_id=2009012072532961489&rta_valid_features=3&et=passive", "/read_history/add", "/root/tab/v2", "/root/tab/v2?city=%E4%B8%8A%E6%B5%B7", "/storage/v1/ad.union.api", "/topstory/hot-lists/total", "/topstory/hot-lists/total?limit=10&reverse_order=0", "/topstory/recommend", "/topstory/recommend?action=down&ad_interval=-10&after_id=23&end_offset=26&page_number=5&session_token=07b9ed7ac1ecdd45188ce684225a553f&device=phone&refresh_scene=0&short_container_setting_value=0&start_type=warm", "/topstory/recommend?action=down&ad_interval=3&after_id=5&end_offset=6&page_number=2&session_token=07b9ed7ac1ecdd45188ce684225a553f&device=phone&refresh_scene=0&short_container_setting_value=0&start_type=warm", "/topstory/recommend?action=down&ad_interval=6&after_id=17&end_offset=20&page_number=4&session_token=07b9ed7ac1ecdd45188ce684225a553f&device=phone&refresh_scene=0&short_container_setting_value=0&start_type=warm", "/topstory/recommend?action=pull&ad_interval=4&before_id=11&end_offset=13&page_number=3&session_token=07b9ed7ac1ecdd45188ce684225a553f&device=phone&refresh_scene=0&short_container_setting_value=0&start_type=warm", "/topstory/recommend?device=phone&refresh_scene=0&short_container_setting_value=0&start_type=cold", "/v3/ad/kuaishou", "/v3/ad/kuaishou?type=click&targetPkg=com.quark.browser&oaid=&imeiSum=&idfaSum=4AA5FA4BC346A14779E270F9EC51EB57&time=1762625155759&callbackUrl=http%3A%2F%2Fad.partner.gifshow.com%2Ftrack%2Factivate%3Fcallback%3Dcw9ZD8CFUzcneHSPdwEPV4KiYis7B3STXy2dD11620ZAYgkMs1MN4RpWn2z0PR7zhZ4Ut2CzGTlAE5owRZAHCADPQ5t6AjUsJvqRQeALfQmD2yxq78uqUpKYuSowzkXzg_mIpQNxEwocCPrWNB_6VC14y868IzUKaOVO5j6FwfcMDXSc2BaZrX0gnma5b_3ywx-IWFQ_PZclNFOVALOAu68DJk41pxeDX1IEBKMjx6s&ip=218.1.147.153&ua=Mozilla%2F5.0+%28iPhone%3B+CPU+iPhone+OS+18_7+like+Mac+OS+X%29+AppleWebKit%2F605.1.15+%28KHTML%2C+like+Gecko%29+Mobile%2F15E148&advertiserId=79367017&adGroupId=14085039115&creativeId=159534573198&campaignId=5131369916&csite=6&os=1&oaidSum=&caid=%5B%7B%22kenyid%22%3A%22510b5f3b90581803d7ea6b064d5895d4%22%2C%22kenyid_MD5%22%3A%227833fd4d5d229d8e2eeec60b6d67fa3e%22%2C%22kenyId%22%3A%22510b5f3b90581803d7ea6b064d5895d4%22%2C%22kenyId_MD5%22%3A%227833fd4d5d229d8e2eeec60b6d67fa3e%22%2C%22version%22%3A%2220250325%22%7D%2C%7B%22kenyid%22%3A%22658969521c3f53c15109c8d671b11668%22%2C%22kenyid_MD5%22%3A%22b690a90e4daa8c10bd1571dc631c52fd%22%2C%22kenyId%22%3A%22658969521c3f53c15109c8d671b11668%22%2C%22kenyId_MD5%22%3A%22b690a90e4daa8c10bd1571dc631c52fd%22%2C%22version%22%3A%2220230330%22%7D%5D&mid=5232338517133629185&unionSite=&rtaReqId=&reqId=2008983896729134865&model=V57AP&groupId=&ch=kk@quark_ad_ios_ks_ai_video_zz_tssp_dx_4"];

// 简易包含判断（兼容数组/字符串）
function includesStr(hay, needle) {
  if (hay == null) return false;
  if (Array.isArray(hay)) return hay.some((v) => String(v).includes(needle));
  return String(hay).includes(needle);
}

// 通用广告元素清理器（保证幂等、尽量不破坏结构）
function sanitizeAdPayload(root) {
  if (root == null) return root;

  // 1) 常见广告字段清理（仅删除“看起来就是广告”的键，避免误伤）
  const AD_KEYS = [
    "ad", "ad_info", "adjson", "ads", "advert", "advert_info", "promotion_extra",
    "recommend_info", "metrics_area", "market_card", "feed_advert"
  ];
  for (const k of AD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(root, k)) {
      try { delete root[k]; } catch (_e) {}
    }
  }

  // 2) 常见集合字段中过滤广告项
  const maybeArrays = [root?.data, root?.list, root?.items, root?.results];
  for (const arr of maybeArrays) {
    if (!Array.isArray(arr)) continue;
    for (let i = arr.length - 1; i >= 0; i--) {
      const it = arr[i];
      const isAdLike =
        includesStr(it?.type, "ad") ||
        includesStr(it?.origin_data?.type, "ad") ||
        includesStr(it?.origin_data?.resource_type, "ad") ||
        includesStr(it?.business_type, "paid") ||
        includesStr(it?.common_card?.footline?.elements?.[0]?.text?.panel_text, "广告") ||
        (it && Object.prototype.hasOwnProperty.call(it, "ad")) ||
        (it && it.promotion_extra != null);
      if (isAdLike) arr.splice(i, 1);
    }
  }
  return root;
}

// 是否匹配任何你抓取到的广告接口
function matchesAdEndpoint(u) {
  try { return AD_ENDPOINT_PATTERNS.some((p) => u.includes(p)); }
  catch (_e) { return false; }
}

// —— 以下为原有逻辑（不改变既有效果的逻辑，保持次序与语义） ——
if (url.includes("/answers/v2/") || url.includes("/articles/v2/")) {
  // 回答/文章列表中的“相关提问”
  if (obj?.third_business?.related_queries?.queries?.length) {
    obj.third_business.related_queries.queries = [];
  }
} else if (url.includes("/api/cloud/zhihu/config/all")) {
  // 全局配置：屏蔽灰度主题 & 顶部背景限时
  if (Array.isArray(obj?.data?.configs)) {
    for (const i of obj.data.configs) {
      if (i?.configKey === "feed_gray_theme" && i?.configValue) {
        i.configValue.start_time = FUTURE_TS_S.start;
        i.configValue.end_time = FUTURE_TS_S.end;
        i.status = false;
      } else if (i?.configKey === "feed_top_res" && i?.configValue) {
        i.configValue.start_time = FUTURE_TS_S.start;
        i.configValue.end_time = FUTURE_TS_S.end;
      }
    }
  }
} else if (url.includes("/api/v4/answers")) {
  // answers v4：删除 data/paging（常见广告/推荐容器）
  delete obj?.data;
  delete obj?.paging;
} else if (url.includes("/api/v4/articles")) {
  // articles v4：移除广告、翻页、推荐信息
  ["ad_info", "paging", "recommend_info"].forEach((k) => delete obj?.[k]);
} else if (url.includes("/appcloud2.zhihu.com/v3/config")) {
  // appcloud 配置调整：收敛 Tab，禁用灰度/僵尸粉等
  if (obj?.config?.hp_channel_tab) delete obj.config.hp_channel_tab;
  if (obj?.config) {
    if (obj.config?.homepage_feed_tab?.tab_infos) {
      obj.config.homepage_feed_tab.tab_infos = obj.config.homepage_feed_tab.tab_infos.filter((t) => {
        if (t?.tab_type === "activity_tab") {
          t.start_time = String(FUTURE_TS_S.start);
          t.end_time = String(FUTURE_TS_S.end);
          return true;
        }
        return false;
      });
    }
    if (obj.config?.zombie_conf) obj.config.zombie_conf.zombieEnable = false;
    if (obj.config?.gray_mode) {
      // 修正：确保是 enable 字段
      obj.config.gray_mode.enable = false;
      obj.config.gray_mode.start_time = String(FUTURE_TS_S.start);
      obj.config.gray_mode.end_time = String(FUTURE_TS_S.end);
    }
    if (obj.config?.zhcnh_thread_sync) {
      const sync = obj.config.zhcnh_thread_sync;
      sync.LocalDNSSetHostWhiteList = [];
      sync.isOpenLocalDNS = "0";
      sync.ZHBackUpIP_Switch_Open = "0";
      sync.dns_ip_detector_operation_lock = "1";
      sync.ZHHTTPSessionManager_setupZHHTTPHeaderField = "1";
    }
    obj.config.zvideo_max_number = 1;
    obj.config.is_show_followguide_alert = false;
  }
} else if (url.includes("/commercial_api/app_float_layer")) {
  // 悬浮图标：直接置空对象
  obj = {}
} else if (url.includes("/feed/render/tab/config")) {
  // 首页二级标签：仅保留 recommend/section
  if (Array.isArray(obj?.selected_sections)) {
    obj.selected_sections = obj.selected_sections.filter((i) => ["recommend", "section"].includes(i?.tab_type));
  }
} else if (url.includes("/moments_v3")) {
  // 屏蔽“为您推荐”类目
  if (Array.isArray(obj?.data)) {
    obj.data = obj.data.filter((i) => !String(i?.title || "").includes("为您推荐"));
  }
} else if (url.includes("/next-bff")) {
  // next-bff 信息流：过滤广告/推荐导流
  if (Array.isArray(obj?.data)) {
    obj.data = obj.data.filter((i) => {
      const o = i?.origin_data;
      const nextGuideTitle = o?.next_guide?.title || "";
      return !(
        includesStr(o?.type, "ad") ||
        includesStr(o?.resource_type, "ad") ||
        String(nextGuideTitle).includes("推荐")
      );
    });
  }
} else if (url.includes("/next-data")) {
  // next-data：过滤广告/盐选
  if (Array.isArray(obj?.data?.data)) {
    obj.data.data = obj.data.data.filter((i) => !(includesStr(i?.type, "ad") || includesStr(i?.data?.answer_type, "PAID")));
  }
} else if (url.includes("/next-render")) {
  // next-render：过滤多种业务类型与广告
  if (Array.isArray(obj?.data)) {
    obj.data = obj.data.filter((i) => !(
      i?.adjson ||
      includesStr(i?.biz_type_list, "article") ||
      includesStr(i?.biz_type_list, "content") ||
      includesStr(i?.business_type, "paid") ||
      i?.section_info ||
      i?.tips ||
      includesStr(i?.type, "ad")
    ));
  }
} else if (url.includes("/questions/")) {
  // 问题详情页：清理广告与付费答案
  delete obj?.ad_info;
  delete obj?.data?.ad_info;
  delete obj?.query_info;
  if (Array.isArray(obj?.data)) {
    obj.data = obj.data.filter((i) => !includesStr(i?.target?.answer_type, "paid"));
  }
} else if (url.includes("/root/tab")) {
  // 首页一级标签：仅保留关注/热榜/推荐
  if (Array.isArray(obj?.tab_list)) {
    obj.tab_list = obj.tab_list.filter((i) => ["follow", "hot", "recommend"].includes(i?.tab_type));
  }
} else if (url.includes("/topstory/hot-lists/everyone-seeing")) {
  // 热榜信息流：去“合作推广”
  if (Array.isArray(obj?.data?.data)) {
    obj.data.data = obj.data.data.filter((i) => !String(i?.target?.metrics_area?.text || "").includes("合作推广"));
  }
} else if (url.includes("/topstory/hot-lists/total")) {
  // 热榜排行榜：去“品牌甄选”
  if (Array.isArray(obj?.data)) {
    obj.data = obj.data.filter((i) => !Object.prototype.hasOwnProperty.call(i, "ad"));
  }
} else if (url.includes("/topstory/recommend")) {
  // 推荐信息流：修正视频 ID、移除直播/广告/营销位
  if (Array.isArray(obj?.data)) {
    obj.data = obj.data.filter((i) => {
      if (i?.type === "market_card" && i?.fields?.header?.url && i?.fields?.body?.video) {
        const videoID = getUrlParamValue(i.fields.header.url, "videoID");
        if (videoID) i.fields.body.video.id = videoID;
        return true;
      }
      if (i?.type === "common_card") {
        if (i?.extra?.type === "drama") return false; // 直播
        if (i?.extra?.type === "zvideo") {
          const videoUrl = i?.common_card?.feed_content?.video?.customized_page_url || "";
          const vid = getUrlParamValue(videoUrl, "videoID");
          if (vid) i.common_card.feed_content.video.id = vid;
        }
        if (i?.common_card?.footline?.elements?.[0]?.text?.panel_text?.includes?.("广告")) return false;
        if (i?.common_card?.feed_content?.source_line?.elements?.[1]?.text?.panel_text?.includes?.("盐选")) return false;
        if (i?.promotion_extra) return false;
        return true;
      }
      if (includesStr(i?.type, "aggregation_card")) return false; // 横排热榜卡
      if (i?.type === "feed_advert") return false; // 伪装广告
      return true;
    });
    fixPos(obj.data);
  }
} else if (matchesAdEndpoint(url)) {
  // —— 新增通用兜底：命中你抓取的广告接口 ——
  // 尽量只做“广告字段清理与广告项过滤”，不改变其他业务数据结构。
  obj = sanitizeAdPayload(obj);
}

// 输出
$done({ body: JSON.stringify(obj ?? {}, null, 0) });

// —— 辅助函数 ——
function fixPos(arr) { for (let i = 0; i < arr.length; i++) arr[i].offset = i + 1; }

function getUrlParamValue(u, key) {
  if (!u || u.indexOf("?") === -1 || !key) return "";
  const q = u.slice(u.indexOf("?") + 1).split("&");
  for (const pair of q) {
    const [k, v = ""] = pair.split("=");
    if (decodeURIComponent(k) === key) return decodeURIComponent(v);
  }
  return "";
}
