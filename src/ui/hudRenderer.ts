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
    this.renderDeductiveHintUI();
  }

  private formatTime(time: number): string {
    const m = Math.floor(Math.max(0, time) / 60);
    const s = Math.max(0, time) % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * 渲染顶部一体化白色导航栏与状态胶囊
   */
  public renderHeader() {
    const user = gameState.user;
    const time = gameState.timeRemaining;
    const remainingPonies = gameState.remainingPonies;

    this.headerEl.innerHTML = `
      <!-- 一体化顶部白色主导航栏 -->
      <div class="hud-main-navbar">
        <div class="navbar-left">
          <button id="btn-settings" class="nav-icon-btn" aria-label="设置" title="游戏设置">
            <svg class="nav-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0 1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button id="btn-guide" class="nav-icon-btn" aria-label="攻略" title="玩法攻略与破局技巧">
            <svg class="nav-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
          </button>
        </div>

        <button id="btn-level-title" class="navbar-level-btn" title="点击选关">
          <span class="level-btn-text">第 ${user.level} 关</span>
          <span class="level-btn-arrow">▾</span>
        </button>

        <div class="navbar-right">
          <div class="navbar-coin-badge">
            <span class="coin-icon">🪙</span>
            <span class="coin-num">${user.coins}</span>
          </div>
        </div>
      </div>

      <!-- 状态指示胶囊条 (虚线边框质感) -->
      <div class="hud-status-strip">
        <div class="status-dashed-pill">
          <img src="/bull.png" class="status-bull-img" alt="牛头" />
          <span class="status-label">剩余:</span>
          <span class="status-num-red">${remainingPonies}</span>
        </div>
        <div class="status-dashed-pill timer-pill">
          <span class="status-clock-icon">⏱️</span>
          <span class="status-label">剩余时间:</span>
          <span class="status-num-red timer-val">${this.formatTime(time)}</span>
        </div>
      </div>
    `;

    // 绑定设置按钮、攻略按钮与选关按钮
    const bindHeaderBtn = (id: string, action: () => void) => {
      const btn = this.headerEl.querySelector(id) as HTMLElement | null;
      if (!btn) return;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        soundManager.playButton();
        action();
      });
    };

    bindHeaderBtn('#btn-settings', () => this.onOpenSettings());
    bindHeaderBtn('#btn-guide', () => this.onOpenGuide());
    bindHeaderBtn('#btn-level-title', () => this.onOpenSettings());
  }

  /**
   * 独立极速刷新倒计时数字，避免触发全屏棋盘重绘
   */
  public updateTimer(time: number) {
    const timerNumEl = this.headerEl.querySelector('.timer-val');
    if (timerNumEl) {
      timerNumEl.textContent = this.formatTime(time);
    }
  }

  /**
   * 渲染关卡核心三大规则提示条 (蓝线描边框 + 虚线分隔，100% 还原原版设计且零截断)
   */
  public renderRulesBanner() {
    this.bannerEl.innerHTML = `
      <div class="rules-blueprint-box">
        <div class="rule-col">
          <div class="rule-text-row">每种颜色1个</div>
          <div class="rule-text-row">牛头</div>
        </div>
        <div class="rule-col">
          <div class="rule-text-row">每行每列均有且</div>
          <div class="rule-text-row">仅有1个牛头</div>
        </div>
        <div class="rule-col">
          <div class="rule-text-row">牛头不能相邻</div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染底部道具与控制栏 (清除、灯泡提示、坐标)
   */
  public renderBottomToolbar() {
    const user = gameState.user;
    const hasCoordinates = user.settings.coordinates;
    const maxQuota = gameState.currentLevel ? (gameState.currentLevel.targetCount || gameState.currentLevel.size) : 7;
    const isLevelMaxReached = gameState.usedHintsThisLevel >= maxQuota;

    this.toolbarEl.innerHTML = `
      <div class="toolbar-wrapper">
        <!-- 清除全部标记 -->
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

        <!-- 提示/神奇灯泡道具 (每关上限为当前关牛只数，可自如加点) -->
        <button id="btn-hint" class="tool-btn prop-btn ${isLevelMaxReached ? 'disabled' : ''}" title="提示：找出一只小牛的正确位置">
          <div class="prop-card-3d">
            <svg class="prop-lightbulb-svg" viewBox="0 0 24 24" fill="none" stroke="#F39C12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18h6"></path>
              <path d="M10 22h4"></path>
              <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"></path>
            </svg>
            <div class="prop-badge-pill ${user.props.hint > 0 ? 'badge-green' : 'badge-orange'}">
              ${isLevelMaxReached ? '0' : (user.props.hint > 0 ? user.props.hint : `
                <svg class="badge-plus-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              `)}
            </div>
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

    // 绑定底部按钮事件
    const bindBtn = (id: string, action: () => void) => {
      const btn = this.toolbarEl.querySelector(id) as HTMLElement | null;
      if (!btn) return;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        action();
      });
    };

    bindBtn('#btn-clear', () => gameState.clearBoard());
    bindBtn('#btn-hint', () => gameState.useHintProp());
    bindBtn('#btn-coords', () => gameState.toggleCoordinates());
  }

  /**
   * 渲染动态启发式逻辑推导浮层（顶部白底气泡说明 + 底部【快速应用】黄色高亮药丸）
   */
  public renderDeductiveHintUI() {
    let hintContainer = document.getElementById('deductive-hint-layer');
    if (!hintContainer) {
      hintContainer = document.createElement('div');
      hintContainer.id = 'deductive-hint-layer';
      hintContainer.className = 'deductive-hint-layer';
      document.body.appendChild(hintContainer);
    }

    if (!gameState.activeDeductiveHint) {
      hintContainer.innerHTML = '';
      hintContainer.style.display = 'none';
      return;
    }

    hintContainer.style.display = 'block';
    hintContainer.innerHTML = `
      <!-- 顶部浮动逻辑推导气泡说明 -->
      <div class="hint-floating-banner pop-in-banner">
        <div class="hint-bulb-glow">💡</div>
        <div class="hint-msg-text">${gameState.activeDeductiveHint.message}</div>
      </div>

      <!-- 底部【快速应用】亮黄色药丸按钮 -->
      <div class="quick-apply-floating-bar pop-in-btn">
        <button id="btn-quick-apply" class="quick-apply-btn">快速应用</button>
      </div>
    `;

    const btnQuickApply = hintContainer.querySelector('#btn-quick-apply') as HTMLElement | null;
    if (btnQuickApply) {
      btnQuickApply.addEventListener('click', (e) => {
        e.stopPropagation();
        gameState.applyActiveHint();
      });
    }
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
