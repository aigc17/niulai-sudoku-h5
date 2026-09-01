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

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.04);
    this.triggerHaptic(10);
  }

  /**
   * 2. 划叉/点击排查音效 (100% 还原 iOS 原生键盘/屏幕轻敲 "哒-哒-哒" 瞬态机械声，音量饱满清脆)
   */
  public playCross() {
    if (!this.soundEnabled) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    
    // 生成 9ms 高频物理敲击脉冲
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = Math.max(64, Math.floor(sampleRate * 0.009));
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // 真实物理碰撞衰减曲线
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // 带通滤波：锁定 iOS 原生键盘 2100Hz 质感
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2100, t);
    filter.Q.setValueAtTime(3.5, t);

    // 辅助高频微谐振
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.009);

    oscGain.gain.setValueAtTime(0.45, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.009);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.95, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.009);

    noise.connect(filter);
    filter.connect(gain);
    osc.connect(oscGain);
    oscGain.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    osc.start(t);
    osc.stop(t + 0.009);
    this.triggerHaptic(4);
  }

  /**
   * 3. 放置正确小牛命中音 (Bouncy Joyful Victory Chime - 🐮，大音量饱满欢快)
   */
  public playAnimal() {
    if (!this.soundEnabled) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 阳光大四和弦
    
    freqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const startTime = t + idx * 0.035;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, startTime + 0.25);

      gain.gain.setValueAtTime(0.55, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });

    this.triggerHaptic([15, 30, 15]);
  }

  /**
   * 4. 规则冲突 / 错误落子短促警告双音 (Punchy Arcade Error Buzzer)
   */
  public playConflict() {
    if (!this.soundEnabled) return;
    this.unlock();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    
    const pulses = [
      { offset: 0, f1: 220, f2: 155, dur: 0.08 },
      { offset: 0.09, f1: 180, f2: 125, dur: 0.12 }
    ];

    pulses.forEach(p => {
      if (!this.ctx) return;
      const startTime = t + p.offset;

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(p.f1, startTime);
      osc1.frequency.exponentialRampToValueAtTime(p.f1 * 0.7, startTime + p.dur);

      osc2.type = 'square';
      osc2.frequency.setValueAtTime(p.f2, startTime);
      osc2.frequency.exponentialRampToValueAtTime(p.f2 * 0.7, startTime + p.dur);

      gain.gain.setValueAtTime(0.65, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + p.dur);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + p.dur);
      osc2.stop(startTime + p.dur);
    });

    this.triggerHaptic([35, 45, 35]);
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

      gain.gain.setValueAtTime(0.55, t + idx * 0.06);
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

      gain.gain.setValueAtTime(0.7, t + acc);
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

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.03);
  }
}

export const soundManager = SoundManager.getInstance();
