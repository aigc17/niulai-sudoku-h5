/**
 * [INPUT]: gameState - 引用自 src/core/state.ts, soundManager - 引用自 src/audio/soundManager.ts
 * [OUTPUT]: ModalRenderer 类 (showWinModal, showLoseModal, showSettingsModal, closeModal)
 * [POS]: 弹窗与礼花粒子特效渲染子系统，处理通关奖励、失败结算与设置选关交互
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
import { HudRenderer } from './hudRenderer';

export class ModalRenderer {
  private overlayEl: HTMLElement;
  private confettiAnimId: number | null = null;

  constructor(overlayEl: HTMLElement) {
    this.overlayEl = overlayEl;
  }

  public closeModal() {
    this.overlayEl.classList.add('hidden');
    this.overlayEl.innerHTML = '';
    if (this.confettiAnimId) {
      cancelAnimationFrame(this.confettiAnimId);
      this.confettiAnimId = null;
    }
  }

  /**
   * 通关胜利弹窗 + 满屏五彩礼花纸屑
   */
  public showWinModal() {
    this.overlayEl.classList.remove('hidden');
    this.overlayEl.innerHTML = `
      <canvas id="confetti-canvas" class="confetti-canvas"></canvas>
      <div class="modal-card win-card animate-pop">
        <h2 class="modal-title win-title">通关大捷！</h2>
        <p class="modal-subtitle">成功解开第 ${gameState.user.level} 关谜题</p>
        
        <div class="rewards-box">
          <div class="reward-item">
            <span class="reward-label">金币</span>
            <span class="reward-val">+10</span>
          </div>
          <div class="reward-item">
            <span class="reward-label">连胜</span>
            <span class="reward-val">${gameState.user.streak}</span>
          </div>
        </div>

        <button id="btn-next-level" class="modal-primary-btn win-btn">
          进入下一关
        </button>
      </div>
    `;

    this.startConfetti();

    this.overlayEl.querySelector('#btn-next-level')?.addEventListener('click', () => {
      soundManager.playButton();
      this.closeModal();
      gameState.nextLevel();
    });
  }

  /**
   * 失败重试弹窗
   */
  public showLoseModal() {
    this.overlayEl.classList.remove('hidden');
    this.overlayEl.innerHTML = `
      <div class="modal-card lose-card animate-pop">
        <h2 class="modal-title lose-title">挑战未完成</h2>
        <p class="modal-subtitle">别气馁，稍加推理即可破解！</p>
        
        <div class="modal-btn-row">
          <button id="btn-retry-level" class="modal-primary-btn">
            重新挑战
          </button>
        </div>
      </div>
    `;

    this.overlayEl.querySelector('#btn-retry-level')?.addEventListener('click', () => {
      soundManager.playButton();
      this.closeModal();
      gameState.retryLevel();
    });
  }

  /**
   * 设置与快速选关弹窗
   */
  public showSettingsModal() {
    const user = gameState.user;
    this.overlayEl.classList.remove('hidden');
    this.overlayEl.innerHTML = `
      <div class="modal-card settings-card animate-pop">
        <div class="modal-header">
          <h2 class="modal-title">游戏设置</h2>
          <button id="btn-close-settings" class="modal-close-x">关闭</button>
        </div>

        <div class="settings-list">
          <div class="setting-row">
            <span>游戏音效</span>
            <input type="checkbox" id="chk-sound" ${user.settings.sound ? 'checked' : ''} />
          </div>
          <div class="setting-row">
            <span>触觉震动</span>
            <input type="checkbox" id="chk-haptics" ${user.settings.haptics ? 'checked' : ''} />
          </div>
          <div class="setting-row">
            <span>放置时自动填叉</span>
            <input type="checkbox" id="chk-autocross" ${user.settings.autoCross ? 'checked' : ''} />
          </div>
          <div class="setting-row">
            <span>色盲辅助模式</span>
            <input type="checkbox" id="chk-colorblind" ${user.settings.colorblind ? 'checked' : ''} />
          </div>
          <div class="setting-row">
            <span>坐标标尺</span>
            <input type="checkbox" id="chk-coords" ${user.settings.coordinates ? 'checked' : ''} />
          </div>
        </div>

        <div class="quick-level-select">
          <div class="select-label">已解锁关卡（已通关关卡可随时重玩）：</div>
          <div class="level-btn-grid">
            ${[1, 2, 3, 4, 5, 10, 24, 50].map(lvl => {
              const isUnlocked = lvl <= (user.maxUnlockedLevel || 1);
              const isCurrent = lvl === user.level;
              return `
                <button class="lvl-jump-btn ${isCurrent ? 'current' : ''} ${isUnlocked ? '' : 'locked'}" data-lvl="${lvl}" ${isUnlocked ? '' : 'disabled'}>
                  ${isUnlocked ? `第${lvl}关` : `第${lvl}关 🔒`}
                </button>
              `;
            }).join('')}
          </div>
          <div class="custom-jump-row">
            <input type="number" id="input-custom-lvl" class="custom-jump-input" min="1" max="${user.maxUnlockedLevel || 1}" placeholder="输入已解锁关卡 (1~${user.maxUnlockedLevel || 1})" />
            <button id="btn-custom-jump" class="custom-jump-btn">前往</button>
          </div>
        </div>
      </div>
    `;

    // 绑定事件
    this.overlayEl.querySelector('#btn-close-settings')?.addEventListener('click', () => {
      soundManager.playButton();
      this.closeModal();
    });

    this.overlayEl.querySelector('#chk-sound')?.addEventListener('change', () => {
      gameState.toggleSound();
    });

    this.overlayEl.querySelector('#chk-haptics')?.addEventListener('change', (e) => {
      user.settings.haptics = (e.target as HTMLInputElement).checked;
      soundManager.setHapticsEnabled(user.settings.haptics);
    });

    this.overlayEl.querySelector('#chk-autocross')?.addEventListener('change', (e) => {
      user.settings.autoCross = (e.target as HTMLInputElement).checked;
    });

    this.overlayEl.querySelector('#chk-colorblind')?.addEventListener('change', () => {
      gameState.toggleColorblind();
    });

    this.overlayEl.querySelector('#chk-coords')?.addEventListener('change', () => {
      gameState.toggleCoordinates();
    });

    this.overlayEl.querySelectorAll('.lvl-jump-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const lvl = parseInt((e.currentTarget as HTMLElement).dataset.lvl || '1', 10);
        soundManager.playButton();
        this.closeModal();
        gameState.loadLevel(lvl);
      });
    });

    this.overlayEl.querySelector('#btn-custom-jump')?.addEventListener('click', () => {
      const input = this.overlayEl.querySelector('#input-custom-lvl') as HTMLInputElement;
      const lvl = parseInt(input?.value || '1', 10);
      const maxUnlocked = user.maxUnlockedLevel || 1;
      if (lvl >= 1 && lvl <= maxUnlocked) {
        soundManager.playButton();
        this.closeModal();
        gameState.loadLevel(lvl);
      } else {
        HudRenderer.showToast(`第 ${lvl} 关尚未解锁，请先通过第 ${maxUnlocked} 关！`);
      }
    });
  }

  /**
   * 绘制绚丽的五彩礼花纸屑动画
   */
  private startConfetti() {
    const canvas = this.overlayEl.querySelector('#confetti-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#F07C68', '#F6BA58', '#F6A8B8', '#D8DE6E', '#7E98D6', '#AFDCF5', '#B3A4D4'];
    const particles = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height * 0.5,
      r: Math.random() * 6 + 4,
      d: Math.random() * 90,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.floor(Math.random() * 10) - 10,
      tiltAngleIncremental: Math.random() * 0.07 + 0.05,
      tiltAngle: 0
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += (Math.cos(p.d) + 3 + p.r / 2) * 0.8;
        p.x += Math.sin(p.tiltAngle) * 2;
        p.tilt = Math.sin(p.tiltAngle) * 15;

        ctx.beginPath();
        ctx.lineWidth = p.r / 2;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 4, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4);
        ctx.stroke();

        if (p.y > canvas.height) {
          p.x = Math.random() * canvas.width;
          p.y = -20;
        }
      });

      this.confettiAnimId = requestAnimationFrame(render);
    };

    render();
  }
}
