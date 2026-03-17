# 西语 PDF 点读机

一个本地运行的小型 Web 工具：

- 导入西语 PDF
- 保留原始页面里的图片和版式
- 在有文字层的页面上直接选中一句或一段
- 使用浏览器内置语音直接朗读

## 运行

在项目目录启动一个本地静态服务器：

```bash
cd /Users/cccc/Documents/spanish-pdf-reader
python3 -m http.server 4173
```

然后访问：

```text
http://localhost:4173
```

## 说明

- 当前版本适合“文本型 PDF”，也就是本来就能复制文字的 PDF。
- 如果某一页只有图片没有文字层，现在会正常显示页面图片，但无法直接划词，需要再接 OCR。
- PDF 解析使用 CDN 加载的 `pdf.js`，所以首次打开页面时需要网络可访问 CDN。
- 朗读使用浏览器的 `SpeechSynthesis`，实际可选西语语音取决于系统和浏览器。
