/**
 * [INPUT]: gameState - 引用自 src/core/state.ts, soundManager - 引用自 src/audio/soundManager.ts
 *          BoardRenderer, TouchHandler, HudRenderer, ModalRenderer - 引用自 src/ui/
 * [OUTPUT]: 游戏生命周期挂载与响应式全局渲染管线
 * [POS]: 前端应用总入口，组装渲染器、手势处理器与全局事件总线
 *
 * [自指声明]
 * 1. 一旦我被更新，必须更新本文件 Header
 * 2. 影响外部接口则更新所属 folder.md/CLAUDE.md
 * 3. 架构级变动则更新根目录 CLAUDE.md
 * 4. 若依赖的文件 POS 变化，需检查本文件 INPUT 是否仍然准确
 *
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { gameState } from './core/state';
import { soundManager } from './audio/soundManager';
import { BoardRenderer } from './ui/boardRenderer';
import { TouchHandler } from './ui/touchHandler';
import { HudRenderer } from './ui/hudRenderer';
import { ModalRenderer } from './ui/modalRenderer';

document.addEventListener('DOMContentLoaded', () => {
  const headerEl = document.getElementById('hud-header') as HTMLElement;
  const bannerEl = document.getElementById('rules-banner') as HTMLElement;
  const boardEl = document.getElementById('board-container') as HTMLElement;
  const toolbarEl = document.getElementById('bottom-toolbar') as HTMLElement;
  const modalOverlayEl = document.getElementById('modal-overlay') as HTMLElement;
  const colorblindBtn = document.getElementById('colorblind-toggle-btn') as HTMLElement;

  // 1. 初始化各子系统渲染器
  const modalRenderer = new ModalRenderer(modalOverlayEl);
  const hudRenderer = new HudRenderer(
    headerEl,
    bannerEl,
    toolbarEl,
    () => modalRenderer.showSettingsModal(),
    () => modalRenderer.showGuideModal()
  );
  const boardRenderer = new BoardRenderer(boardEl);
  new TouchHandler(boardEl);

  // 绑定独立倒计时刷新回调，彻底杜绝背景秒级触发棋盘全屏重绘
  gameState.onTimerTick = (time: number) => {
    hudRenderer.updateTimer(time);
  };

  // 绑定悬浮式 Toast 错误提示回调，绝对定位不挤压主棋盘
  gameState.onErrorMessage = (msg: string) => {
    HudRenderer.showToast(msg);
  };

  // 2. 绑定色盲辅助模式悬浮按钮
  colorblindBtn.addEventListener('click', () => {
    gameState.toggleColorblind();
  });

  // 3. 用户首次任意触屏操作时解锁 iOS Web Audio 上下文
  const unlockAudio = () => {
    soundManager.unlock();
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('click', unlockAudio);
  };
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('click', unlockAudio, { passive: true });

  // 4. 核心渲染响应流水线
  let prevStatus = gameState.status;

  const updateUI = () => {
    hudRenderer.render();
    boardRenderer.render();

    // 状态流转弹窗触发
    if (gameState.status === 'WON' && prevStatus !== 'WON') {
      modalRenderer.showWinModal();
    } else if (gameState.status === 'LOST' && prevStatus !== 'LOST') {
      modalRenderer.showLoseModal();
    }

    prevStatus = gameState.status;
  };

  // 订阅响应式状态更新
  gameState.subscribe(updateUI);

  // 首次触发完整渲染
  updateUI();
});
