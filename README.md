# 日常实用工具箱

纯前端单文件静态页面，包含 4 个常用工具：
1. **倒数日 & 日期计算**：自定义倒数日（`localStorage` 本地保存）、两日期相差天数（含工作日）、日期推算。
2. **专注计时器**：番茄钟 25m / 短休 / 长休 / 自定义分钟数，带环形进度条与提示音。
3. **字数与排版清理**：中英文字数统计、阅读时间估算、中英文自动加空格、去多余空行、全角转半角。
4. **数学倒数与比例**：`1/x` 倒数、百分比、平方/平方根、两数变化率与倍数计算。

## 在 Halo 中嵌入

将本目录上传至 GitHub 仓库并开启 GitHub Pages（或 Cloudflare Pages / Vercel）后，在 Halo 自定义页面或文章中插入 HTML 代码块：

```html
<iframe
  src="https://cye04.github.io/cecp-tool/"
  style="width: 100%; min-height: 760px; border: none; border-radius: 14px;"
  loading="lazy">
</iframe>
```
