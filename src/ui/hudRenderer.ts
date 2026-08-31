/**
 * [INPUT]: gameState - 引用自 src/core/state.ts, soundManager - 引用自 src/audio/soundManager.ts
 * [OUTPUT]: HudRenderer 类 (renderHeader, renderRulesBanner, renderBottomToolbar)
 * [POS]: 游戏 HUD 与状态栏渲染系统，负责资源、生命值、倒计时、规则胶囊与道具栏展示
 *
 * [自指声明]
 * 1. 一旦我被更新，必须更新本文件 Header
 * 2. 影响外部接口则更新所属 folder.md/CLAUDE.md
 * 3. 架构级变动则更新根目录 CLAUDE.md
 * 4. 若依赖的文件 POS 变化，需检查本文件 INPUT 是否仍然准确
 *
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { gameState } from '../core/state';
import { soundManager } from '../audio/soundManager';

export class HudRenderer {
  private headerEl: HTMLElement;
  private bannerEl: HTMLElement;
  private toolbarEl: HTMLElement;
  private onOpenSettings: () => void;
  private onOpenGuide: () => void;

  constructor(
    headerEl: HTMLElement,
    bannerEl: HTMLElement,
    toolbarEl: HTMLElement,
    onOpenSettings: () => void,
    onOpenGuide: () => void
  ) {
    this.headerEl = headerEl;
    this.bannerEl = bannerEl;
    this.toolbarEl = toolbarEl;
    this.onOpenSettings = onOpenSettings;
    this.onOpenGuide = onOpenGuide;
  }

  public render() {
    this.renderHeader();
    this.renderRulesBanner();
    this.renderBottomToolbar();
  }

  /**
   * 渲染顶部资源、关卡、攻略与倒计时状态栏
   */
  public renderHeader() {
    const user = gameState.user;
    const time = gameState.timeRemaining;
    const remainingPonies = gameState.remainingPonies;

    this.headerEl.innerHTML = `
      <div class="hud-top-row">
        <div class="hud-left-group">
          <button id="btn-settings" class="game-icon-btn settings-btn" aria-label="设置" title="游戏设置">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button id="btn-guide" class="game-icon-btn guide-btn" aria-label="攻略" title="玩法攻略与破局技巧">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
          </button>
          <div class="resource-badge coin-badge">
            <span class="coin-icon">🪙</span>
            <span class="badge-val">${user.coins}</span>
          </div>
        </div>

        <div class="hud-center-group">
          <button id="btn-level-title" class="level-title-btn" title="点击选关">
            <span class="level-title-text">第${user.level}关</span>
            <span class="level-arrow">▾</span>
          </button>
        </div>

        <div class="hud-right-group">
          <div class="streak-badge">
            <span class="trophy-icon">🏆</span>
            <span class="streak-text">${user.streak}</span>
          </div>
          <button id="btn-reset-l1" class="game-icon-btn reset-btn" title="重置本关">
            <svg class="hud-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="hud-status-row">
        <div class="status-pill target-pill">
          <img src="/bull.png" class="pill-bull-icon" alt="牛头" />
          <span class="pill-label">剩余:</span>
          <span class="pill-num highlight-red">${remainingPonies}</span>
        </div>
        <div class="status-pill timer-pill">
          <span class="pill-icon">⏱️</span>
          <span class="pill-label">时间:</span>
          <span class="pill-num highlight-red">${time}</span>
        </div>
      </div>
    `;

    // 绑定设置按钮、攻略按钮与选关按钮
    this.headerEl.querySelector('#btn-settings')?.addEventListener('click', () => {
      soundManager.playButton();
      this.onOpenSettings();
    });

    this.headerEl.querySelector('#btn-guide')?.addEventListener('click', () => {
      soundManager.playButton();
      this.onOpenGuide();
    });

    this.headerEl.querySelector('#btn-level-title')?.addEventListener('click', () => {
      soundManager.playButton();
      this.onOpenSettings();
    });

    this.headerEl.querySelector('#btn-reset-l1')?.addEventListener('click', () => {
      soundManager.playButton();
      gameState.clearBoard();
    });
  }

  /**
   * 独立极速刷新倒计时数字，避免触发全屏棋盘重绘
   */
  public updateTimer(time: number) {
    const timerNumEl = this.headerEl.querySelector('.timer-pill .pill-num');
    if (timerNumEl) {
      timerNumEl.textContent = time.toString();
    }
  }

  /**
   * 渲染三公理规则胶囊牌
   */
  public renderRulesBanner() {
    this.bannerEl.innerHTML = `
      <div class="rules-card-container">
        <div class="rule-card">
          <div class="rule-title">每种颜色1个</div>
          <div class="rule-sub">牛头</div>
        </div>
        <div class="rule-card">
          <div class="rule-title">每行每列均有且</div>
          <div class="rule-sub">仅有1个牛头</div>
        </div>
        <div class="rule-card">
          <div class="rule-title">牛头不能相邻</div>
          <div class="rule-sub">(含斜向)</div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染底部道具与控制栏 (清除、放大镜探照、灯泡提示、坐标)
   */
  public renderBottomToolbar() {
    const user = gameState.user;
    const hasCoordinates = user.settings.coordinates;

    this.toolbarEl.innerHTML = `
      <div class="toolbar-wrapper">
        <!-- 清除/重置 -->
        <button id="btn-clear" class="tool-btn action-clear" title="清空全部标记">
          <div class="tool-icon-wrapper">
            <svg class="tool-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </div>
          <span class="tool-label">清除</span>
        </button>

        <!-- 探照/牛头探照道具 -->
        <button id="btn-detector" class="tool-btn prop-btn ${user.props.detector <= 0 ? 'disabled' : ''}" title="探照：随机排除一个不可能的格子">
          <div class="prop-card-3d">
            <img src="/bull.png" class="prop-bull-icon" alt="探照" />
            <div class="prop-badge-pill">${user.props.detector}</div>
          </div>
          <span class="tool-label">探照</span>
        </button>

        <!-- 提示/神奇灯泡道具 -->
        <button id="btn-hint" class="tool-btn prop-btn ${user.props.hint <= 0 ? 'disabled' : ''}" title="提示：直接找出一个小牛的正确位置">
          <div class="prop-card-3d">
            <svg class="prop-lightbulb-svg" viewBox="0 0 24 24" fill="none" stroke="#F39C12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18h6"></path>
              <path d="M10 22h4"></path>
              <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"></path>
            </svg>
            <div class="prop-badge-pill badge-green">${user.props.hint > 0 ? user.props.hint : '+'}</div>
          </div>
          <span class="tool-label">提示</span>
        </button>

        <!-- 坐标开关 -->
        <button id="btn-coords" class="tool-btn action-coords ${hasCoordinates ? 'active' : ''}" title="开启/关闭棋盘行列坐标">
          <div class="tool-icon-wrapper">
            <svg class="tool-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          <span class="tool-label">坐标</span>
        </button>
      </div>
    `;

    // 绑定底部按钮事件（双重保障 click 与 touchend，杜绝移动端丢事件）
    const bindBtn = (id: string, action: () => void) => {
      const btn = this.toolbarEl.querySelector(id) as HTMLElement | null;
      if (!btn) return;
      let lastTriggerTime = 0;
      const handler = (e: Event) => {
        const now = Date.now();
        if (now - lastTriggerTime < 300) return; // 防重复双触
        lastTriggerTime = now;
        e.stopPropagation();
        action();
      };
      btn.addEventListener('click', handler);
      btn.addEventListener('touchend', handler);
    };

    bindBtn('#btn-clear', () => gameState.clearBoard());
    bindBtn('#btn-detector', () => gameState.useDetectorProp());
    bindBtn('#btn-hint', () => gameState.useHintProp());
    bindBtn('#btn-coords', () => gameState.toggleCoordinates());
  }

  /**
   * 全局悬浮式 Toast 错误提示（绝对定位悬浮，绝不挤压主棋盘导致布局跳动）
   */
  public static showToast(msg: string) {
    let toastContainer = document.getElementById('global-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'global-toast-container';
      toastContainer.className = 'toast-floating-container';
      document.body.appendChild(toastContainer);
    }

    toastContainer.innerHTML = `
      <div class="toast-pill">
        <span class="toast-icon">⚠️</span>
        <span class="toast-text">${msg}</span>
      </div>
    `;

    setTimeout(() => {
      if (toastContainer) {
        toastContainer.innerHTML = '';
      }
    }, 2000);
  }
}
