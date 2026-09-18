#!/usr/bin/env bash
# 一键加载 SiteSnippets 到 Google Chrome（开发者模式 / 加载已解压的扩展程序）
set -euo pipefail

EXT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$EXT_DIR/manifest.json" ]; then
  echo "错误：$EXT_DIR 下未找到 manifest.json"
  exit 1
fi

if [ -d "/Applications/Google Chrome.app" ]; then
  # 直接调用二进制打开 chrome:// 页面（open -a 在部分机器上无法唤起 chrome:// URL）
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "chrome://extensions/" >/dev/null 2>&1 &
else
  echo "未检测到 /Applications/Google Chrome.app，请先安装 Chrome。"
fi

# 在 Finder 中打开扩展目录，便于直接拖入扩展页或点「加载已解压的扩展程序」选择
open "$EXT_DIR" || true

cat <<EOF

============================================================
 SiteSnippets 安装指引
 扩展目录：$EXT_DIR
------------------------------------------------------------
 Chrome 出于安全限制，不允许脚本静默安装本地扩展，
 仅剩两步手动操作：

 1. 在刚打开的「扩展程序」页面右上角，打开「开发者模式」
 2. 将本目录（site-snippets 文件夹）直接拖入扩展页面；
    或点击「加载已解压的扩展程序」后选择该目录

 安装后建议点工具栏拼图图标，把「SiteSnippets」固定到工具栏。
 本扩展为纯 JS 零构建：改完 src 代码后，在扩展卡片上点「刷新 ⟳」即可生效。
============================================================
EOF
