/**
 * [INPUT]: None - 浏览器原生 AudioContext 与 Navigator 接口
 * [OUTPUT]: SoundManager 单例 (playTap, playCross, playAnimal, playConflict, playWin, playHint, playButton)
 * [POS]: 音频子系统核心，负责 0 延迟 Web Audio 合成音效与移动端触觉震动反馈
 *
 * [自指声明]
 * 1. 一旦我被更新，必须更新本文件 Header
 * 2. 影响外部接口则更新所属 folder.md/CLAUDE.md
 * 3. 架构级变动则更新根目录 CLAUDE.md
 * 4. 若依赖的文件 POS 变化，需检查本文件 INPUT 是否仍然准确
 *
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export class SoundManager {
  private static instance: SoundManager;
  private ctx: AudioContext | null = null;
  private isUnlocked: boolean = false;
  private soundEnabled: boolean = true;
  private hapticsEnabled: boolean = true;

  private constructor() {
    // 延迟到首次用户触碰时初始化 AudioContext 以满足 iOS 策略
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public setHapticsEnabled(enabled: boolean) {
    this.hapticsEnabled = enabled;
  }

  public isSoundOn(): boolean {
    return this.soundEnabled;
  }

  /**
   * 解锁 iOS / 移动端 AudioContext
   */
  public unlock() {
    if (this.isUnlocked && this.ctx && this.ctx.state === 'running') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.isUnlocked = true;
    } catch {
      // 忽略无法创建音频上下文的环境
    }
  }

  private triggerHaptic(duration: number | number[] = 15) {
    if (!this.hapticsEnabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      navigator.vibrate(duration);
    } catch {
      // 忽略震动不受支持的情况
    }
  }

  /**
   * 1. 点击轻微木质音 (Tap)
   */
  public playTap() {
    if (!this.soundEnabled) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.04);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.04);
    this.triggerHaptic(10);
  }

  /**
   * 2. 划叉排除音 (Cross - ❌)
   */
  public playCross() {
    if (!this.soundEnabled) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.05);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.05);
    this.triggerHaptic(12);
  }

  /**
   * 3. 放置小马/小牛命中音 (Animal - 🐴/🐮)
   */
  public playAnimal() {
    if (!this.soundEnabled) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5 阳光大三和弦
    
    freqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.03);

      gain.gain.setValueAtTime(0.18, t + idx * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.03 + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + idx * 0.03);
      osc.stop(t + idx * 0.03 + 0.2);
    });

    this.triggerHaptic([20, 40, 20]);
  }

  /**
   * 4. 规则冲突蜂鸣警告音 (Conflict Error)
   */
  public playConflict() {
    if (!this.soundEnabled) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.linearRampToValueAtTime(110, t + 0.12);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.12);
    this.triggerHaptic([40, 60, 40]);
  }

  /**
   * 5. 道具释放音 (Hint / Prop)
   */
  public playHint() {
    if (!this.soundEnabled) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // 琶音向上 C5-E5-G5-C6

    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.06);

      gain.gain.setValueAtTime(0.2, t + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + idx * 0.06);
      osc.stop(t + idx * 0.06 + 0.15);
    });

    this.triggerHaptic(25);
  }

  /**
   * 6. 通关胜利号角 (Victory Fanfare)
   */
  public playWin() {
    if (!this.soundEnabled) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const melody = [
      { f: 523.25, d: 0.12 }, // C5
      { f: 659.25, d: 0.12 }, // E5
      { f: 783.99, d: 0.12 }, // G5
      { f: 1046.50, d: 0.35 } // C6
    ];

    let acc = 0;
    melody.forEach((note) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, t + acc);

      gain.gain.setValueAtTime(0.3, t + acc);
      gain.gain.exponentialRampToValueAtTime(0.001, t + acc + note.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + acc);
      osc.stop(t + acc + note.d);

      acc += note.d * 0.85;
    });

    this.triggerHaptic([30, 50, 30, 80, 50]);
  }

  /**
   * 7. 按钮与UI交互音 (Button)
   */
  public playButton() {
    if (!this.soundEnabled) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.exponentialRampToValueAtTime(500, t + 0.03);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.03);
  }
}

export const soundManager = SoundManager.getInstance();
