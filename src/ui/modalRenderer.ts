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

  private bindModalBtn(selector: string, action: () => void) {
    const btn = this.overlayEl.querySelector(selector) as HTMLElement | null;
    if (!btn) return;
    let last = 0;
    const handler = (e: Event) => {
      const now = Date.now();
      if (now - last < 300) return;
      last = now;
      e.stopPropagation();
      action();
    };
    btn.addEventListener('click', handler);
    btn.addEventListener('touchend', handler);
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

    this.bindModalBtn('#btn-next-level', () => {
      soundManager.playButton();
      this.closeModal();
      gameState.nextLevel();
    });
  }

  /**
   * 失败/超时结算弹窗 (提供加时继续、获得提示、重新开始三重视角)
   */
  public showLoseModal() {
    this.overlayEl.classList.remove('hidden');
    this.overlayEl.innerHTML = `
      <div class="modal-card lose-card animate-pop">
        <div class="lose-icon">⏱️</div>
        <h2 class="modal-title lose-title">时间用尽啦</h2>
        <p class="modal-subtitle">别气馁，选择下方方案继续破解！</p>
        
        <div class="lose-actions-column">
          <button id="btn-revive-time" class="modal-primary-btn btn-revive">
            ⏱️ 加时 60 秒继续挑战
          </button>
          <button id="btn-revive-hint" class="modal-secondary-btn btn-hint-revive">
            💡 获得提示并继续 (+60s)
          </button>
          <button id="btn-retry-level" class="modal-text-btn">
            🔄 重新开始本关
          </button>
        </div>
      </div>
    `;

    this.bindModalBtn('#btn-revive-time', () => {
      this.closeModal();
      gameState.reviveWithTime(60);
    });

    this.bindModalBtn('#btn-revive-hint', () => {
      this.closeModal();
      gameState.reviveWithHint();
    });

    this.bindModalBtn('#btn-retry-level', () => {
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

        <!-- 跨设备存档同步 -->
        <div class="save-sync-section">
          <div class="select-label">☁️ 我的当前存档 ID (点击一键复制)：</div>
          <div id="box-save-code" class="save-code-badge" title="点击一键复制存档ID">
            <span class="save-code-str">${gameState.generateSaveCode()}</span>
            <span class="save-copy-tag">📋 复制</span>
          </div>
          <div class="custom-jump-row" style="margin-top: 10px;">
            <input type="text" id="input-import-save" class="custom-jump-input" placeholder="粘贴其他设备存档 ID (NIU-...)" />
            <button id="btn-import-save" class="custom-jump-btn">导入</button>
          </div>
        </div>

        <button id="btn-open-guide-from-settings" class="modal-secondary-btn" style="margin-top: 14px;">
          📖 查看玩法攻略与排查秘籍
        </button>
      </div>
    `;

    // 绑定事件
    this.bindModalBtn('#btn-close-settings', () => {
      soundManager.playButton();
      this.closeModal();
    });

    const copySaveCode = () => {
      const code = gameState.generateSaveCode();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(() => {
          HudRenderer.showToast('✅ 存档 ID 已复制到剪贴板！可发至其他设备导入');
        }).catch(() => {
          prompt('请长按复制你的专属存档 ID：', code);
        });
      } else {
        prompt('请长按复制你的专属存档 ID：', code);
      }
    };

    this.bindModalBtn('#box-save-code', () => {
      soundManager.playButton();
      copySaveCode();
    });

    this.bindModalBtn('#btn-import-save', () => {
      const input = this.overlayEl.querySelector('#input-import-save') as HTMLInputElement;
      const code = input?.value || '';
      if (!code) {
        HudRenderer.showToast('⚠️ 请先输入或粘贴存档码！');
        return;
      }
      const success = gameState.importSaveCode(code);
      if (success) {
        HudRenderer.showToast(`🎉 存档恢复成功！已同步至第 ${gameState.user.level} 关！`);
        this.closeModal();
      } else {
        HudRenderer.showToast('❌ 存档码格式无效，请检查后重试');
      }
    });

    this.bindModalBtn('#btn-open-guide-from-settings', () => {
      soundManager.playButton();
      this.showGuideModal();
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

    this.overlayEl.querySelector('#chk-coords')?.addEventListener('change', () => {
      gameState.toggleCoordinates();
    });

    this.overlayEl.querySelectorAll('.lvl-jump-btn').forEach(btn => {
      const el = btn as HTMLElement;
      const lvl = parseInt(el.dataset.lvl || '1', 10);
      const handler = (e: Event) => {
        e.stopPropagation();
        soundManager.playButton();
        this.closeModal();
        gameState.loadLevel(lvl);
      };
      el.addEventListener('click', handler);
      el.addEventListener('touchend', handler);
    });

    this.bindModalBtn('#btn-custom-jump', () => {
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
   * 新设备首次进入欢迎与存档导入弹窗
   */
  public showWelcomeModal() {
    this.overlayEl.classList.remove('hidden');
    this.overlayEl.innerHTML = `
      <div class="modal-card welcome-card animate-pop">
        <div class="lose-icon">🐮</div>
        <h2 class="modal-title">欢迎来到牛来数独</h2>
        <p class="modal-subtitle">检测到你是首次在此设备游玩：</p>

        <div class="lose-actions-column">
          <button id="btn-welcome-new" class="modal-primary-btn">
            🚀 开始全新游戏 (第 1 关)
          </button>
          <button id="btn-welcome-show-import" class="modal-secondary-btn">
            📥 导入已有存档码 (同步其他设备)
          </button>
          
          <div id="welcome-import-box" class="welcome-import-box hidden">
            <input type="text" id="input-welcome-save" class="custom-jump-input" placeholder="粘贴存档码 (NIU-...)" style="width: 100%; box-sizing: border-box;" />
            <button id="btn-welcome-import-submit" class="custom-jump-btn" style="margin-top: 8px; width: 100%;">
              立即同步进度
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindModalBtn('#btn-welcome-new', () => {
      soundManager.playButton();
      this.closeModal();
      HudRenderer.showToast('🎉 祝你闯关愉快！随时可在设置中备份存档');
    });

    this.bindModalBtn('#btn-welcome-show-import', () => {
      const box = this.overlayEl.querySelector('#welcome-import-box');
      box?.classList.toggle('hidden');
    });

    this.bindModalBtn('#btn-welcome-import-submit', () => {
      const input = this.overlayEl.querySelector('#input-welcome-save') as HTMLInputElement;
      const code = input?.value || '';
      if (!code) {
        HudRenderer.showToast('⚠️ 请先输入或粘贴存档码！');
        return;
      }
      const success = gameState.importSaveCode(code);
      if (success) {
        HudRenderer.showToast(`🎉 存档恢复成功！已同步至第 ${gameState.user.level} 关！`);
        this.closeModal();
      } else {
        HudRenderer.showToast('❌ 存档码格式无效，请检查后重试');
      }
    });
  }

  /**
   * 玩法攻略与破局秘籍弹窗
   */
  public showGuideModal() {
    this.overlayEl.classList.remove('hidden');
    this.overlayEl.innerHTML = `
      <div class="modal-card guide-card animate-pop">
        <div class="modal-header">
          <h2 class="modal-title">📖 玩法攻略与秘籍</h2>
          <button id="btn-close-guide" class="modal-close-x">关闭</button>
        </div>

        <div class="guide-scroll-body">
          <div class="guide-section">
            <h3 class="guide-sec-title">👑 核心三大公理</h3>
            <ul class="guide-list">
              <li><b>① 颜色唯一</b>：每个同色区域内，只能放 <b>1 头牛 🐮</b>。</li>
              <li><b>② 行列唯一</b>：每 1 横行、每 1 竖列，只能放 <b>1 头牛 🐮</b>。</li>
              <li><b>③ 八向互斥</b>：两头牛四周 8 格（含 4 斜角）<b>绝不能碰面 ❌</b>。</li>
            </ul>
          </div>

          <div class="guide-section">
            <h3 class="guide-sec-title">💡 四大进阶破局绝技</h3>
            <div class="guide-tip-card">
              <div class="tip-title">🎯 技巧 1：孤岛单格锁定法 (首选破局)</div>
              <div class="tip-desc">观察全盘，若某种颜色<b>全图仅有 1 个格子</b>，则此处 <b>100% 必放牛</b>！落下即可触发多米诺连环效应！</div>
            </div>

            <div class="guide-tip-card">
              <div class="tip-title">⚡ 技巧 2：十字光线排除法 (落子即排查)</div>
              <div class="tip-desc">只要成功落下一头牛，立刻滑动将其所在<b>整行、整列及四周 8 格全部打 ❌</b>，瞬间清空无效区域。</div>
            </div>

            <div class="guide-tip-card">
              <div class="tip-title">🔒 技巧 3：狭管双格封锁法 (高阶推演)</div>
              <div class="tip-desc">若某种颜色的所有可用格子<b>全部挤在同一行（或同一列）</b>，则该行其他非同色格子绝不能有牛，可提前打 ❌ 排除！</div>
            </div>

            <div class="guide-tip-card">
              <div class="tip-title">📐 技巧 4：拐角孤立挤压法 (大师解题)</div>
              <div class="tip-desc">棋盘角落与边缘易受多重排除挤压，常为打破僵局的第二关键落子点。</div>
            </div>
          </div>
        </div>

        <button id="btn-know-guide" class="modal-primary-btn" style="margin-top: 12px;">
          我学会了，立即实战！
        </button>
      </div>
    `;

    const close = () => {
      soundManager.playButton();
      this.closeModal();
    };
    this.bindModalBtn('#btn-close-guide', close);
    this.bindModalBtn('#btn-know-guide', close);
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
