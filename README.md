# Commute Predictor — PWA v0.1

这是「第一城 ↔ HKUST」个人化通勤 ETA 网站版。

## 目前已经能做什么
- PWA：iPhone Safari 可“添加到主屏幕”
- GPS：到家和 HKUST 各保存一次位置，之后自动判断去学校/回家
- 路线推荐：校巴、91、91M、彩虹 11 小巴等
- 你的偏好：钻石山直接坐 91M 有额外不舒适 penalty，可自行调节
- 当前 HKUST 2026 秋季钻石山校巴时刻
- KMB 91 / 91M 官方实时 ETA 接口
- GMB 11 官方 ETA（按新界区、行程方向和实际候车站匹配）
- 开始/结束一次通勤并自动记录真实总耗时
- 手动记录通勤、备注异常原因
- 个人 ETA 学习：EWMA + 工作日/周末 + 2 小时时间段
- 大致到达区间与个性化信心
- 本地保存，无需账号
- JSON 数据导出

## 本地运行
进入文件夹后运行：

```bash
python3 -m http.server 8000
```

Mac Safari 打开 `http://localhost:8000`。

iPhone 正式使用建议部署到 HTTPS，因为浏览器定位需要安全上下文。

## 部署
这是纯静态网站，可直接部署到：
- Netlify
- Vercel
- GitHub Pages
- Cloudflare Pages

上传整个 CommutePWA 文件夹即可。

部署后，在 iPhone Safari：
1. 打开网址
2. 分享
3. 添加到主屏幕

## 第一次设置
1. 在家打开网站：设置 → 把当前位置设为 Home
2. 到 HKUST：设置 → 把当前位置设为 HKUST
3. 之后首页会自动判断方向

## 10:15 → 九龙塘
你描述过一班 10:15 HKUST → 九龙塘的免费 Shuttle。
当前 HKUST 2026 秋季官方 Student Shuttle 页面没有列出这班车，因此本版本把它作为：
- 个人规则
- 默认关闭
- 可在设置中开启

## 个人学习模型
每条路线先有一个 baseline。你的实际记录会用 EWMA 更新，最近的通勤权重更高。
同时按：
- 工作日 / 周末
- 2 小时时间桶
- 具体路线
区分情境。

记录越多，你自己的数据权重越高，但保留 baseline，避免一次严重堵车把预测完全带偏。

## 下一步建议
1. 继续根据实际通勤记录微调 91／91M／11 的分段时间
2. 分段自动学习：Home→第一城、MTR、钻石山步行、校巴等
3. 加天气和雨天步行 penalty
4. “我要几点到”反推最迟出门
5. Supabase 多设备同步
6. 服务器每天同步 HKUST Shuttle timetable
