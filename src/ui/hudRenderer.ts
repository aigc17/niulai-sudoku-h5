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

  constructor(
    headerEl: HTMLElement,
    bannerEl: HTMLElement,
    toolbarEl: HTMLElement,
    onOpenSettings: () => void
  ) {
    this.headerEl = headerEl;
    this.bannerEl = bannerEl;
    this.toolbarEl = toolbarEl;
    this.onOpenSettings = onOpenSettings;
  }

  public render() {
    this.renderHeader();
    this.renderRulesBanner();
    this.renderBottomToolbar();
  }

  /**
   * 渲染顶部资源、关卡、心心与倒计时状态栏 (100% 还原截图)
   */
  public renderHeader() {
    const user = gameState.user;
    const time = gameState.timeRemaining;
    const remainingPonies = gameState.remainingPonies;

    this.headerEl.innerHTML = `
      <div class="hud-top-row">
        <div class="hud-left-group">
          <button id="btn-settings" class="icon-btn" aria-label="设置" title="游戏设置">设置</button>
          <div class="resource-badge coin-badge">
            <span class="badge-label">金币</span>
            <span class="badge-val">${user.coins}</span>
          </div>
        </div>

        <div class="hud-center-group">
          <button id="btn-level-title" class="level-title-btn" title="点击选关">
            第${user.level}关 <span class="level-arrow">▾</span>
          </button>
        </div>

        <div class="hud-right-group">
          <div class="streak-badge">
            <span class="streak-text">连胜: ${user.streak}</span>
          </div>
          <button id="btn-reset-l1" class="quick-reset-btn" title="回到第 1 关">
            重置
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
      ${this.renderConflictNotice()}
    `;

    // 绑定设置按钮与选关按钮
    this.headerEl.querySelector('#btn-settings')?.addEventListener('click', () => {
      soundManager.playButton();
      this.onOpenSettings();
    });

    this.headerEl.querySelector('#btn-level-title')?.addEventListener('click', () => {
      soundManager.playButton();
      this.onOpenSettings();
    });

    this.headerEl.querySelector('#btn-reset-l1')?.addEventListener('click', () => {
      soundManager.playButton();
      gameState.resetProgress();
    });
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
        <button id="btn-clear" class="tool-btn action-clear">
          <div class="tool-name">清除</div>
        </button>

        <!-- 放大镜/探照道具 -->
        <button id="btn-detector" class="tool-btn prop-btn ${user.props.detector <= 0 ? 'disabled' : ''}">
          <div class="prop-card">
            <span class="prop-text-icon">探照</span>
            <div class="prop-badge">${user.props.detector}</div>
          </div>
        </button>

        <!-- 提示/灯泡道具 -->
        <button id="btn-hint" class="tool-btn prop-btn ${user.props.hint <= 0 ? 'disabled' : ''}">
          <div class="prop-card">
            <span class="prop-text-icon">提示</span>
            <div class="prop-badge ${user.props.hint <= 0 ? 'badge-plus' : ''}">
              ${user.props.hint > 0 ? user.props.hint : '+'}
            </div>
          </div>
        </button>

        <!-- 坐标开关 -->
        <button id="btn-coords" class="tool-btn action-coords ${hasCoordinates ? 'active' : ''}">
          <div class="tool-name">坐标</div>
        </button>
      </div>
    `;

    // 绑定底部按钮事件
    this.toolbarEl.querySelector('#btn-clear')?.addEventListener('click', () => {
      gameState.clearBoard();
    });

    this.toolbarEl.querySelector('#btn-detector')?.addEventListener('click', () => {
      gameState.useDetectorProp();
    });

    this.toolbarEl.querySelector('#btn-hint')?.addEventListener('click', () => {
      gameState.useHintProp();
    });

    this.toolbarEl.querySelector('#btn-coords')?.addEventListener('click', () => {
      gameState.toggleCoordinates();
    });
  }

  private renderConflictNotice(): string {
    if (gameState.conflicts.length === 0) return '';

    const c = gameState.conflicts[0];
    let msg = '';
    if (c.type === 'ROW') {
      msg = `第 ${c.coords[0].row + 1} 行已有 2 个牛头（每行只能放1个）`;
    } else if (c.type === 'COL') {
      msg = `第 ${c.coords[0].col + 1} 列已有 2 个牛头（每列只能放1个）`;
    } else if (c.type === 'REGION') {
      msg = `同一种颜色区域放了 2 个牛头（每种颜色只能放1个）`;
    } else if (c.type === 'ADJACENT') {
      msg = `两个牛头挨在一起了（四周含斜向不能相邻）`;
    }

    return `
      <div class="conflict-notice-bar">
        <span class="conflict-notice-icon">⚠️</span>
        <span class="conflict-notice-text">${msg}</span>
      </div>
    `;
  }
}
