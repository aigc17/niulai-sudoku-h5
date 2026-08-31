# 牛来数独 (Niulai Sudoku H5) - 高玩区域八皇后益智闯关手游
HTML5 + CSS3 + TypeScript + Vite + Web Audio API

## 目录结构
src/ - 核心前端源码 (5子目录: core, audio, ui, styles, types)
  ├── core/ - 关卡生成器、CSP约束求解器、关卡题库与状态机 (4文件)
  ├── audio/ - 纯合成 Web Audio API 零延迟音效系统 (1文件)
  ├── ui/ - 棋盘渲染、手势交互、HUD状态栏与弹窗系统 (4文件)
  └── styles/ - 响应式移动端样式、马卡龙色彩与动画特效 (1文件)

## 配置文件
package.json - 项目依赖与构建脚本
tsconfig.json - TypeScript 严格编译规则
vite.config.ts - 极速前端热更新与打包配置
index.html - 移动端全屏视口与应用宿主入口

[PROTOCOL]: 变更时更新此头部，然后检查各级 CLAUDE.md
