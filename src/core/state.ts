/**
 * [INPUT]: CellState, LevelData, UserProfile, GameStatus, ConflictInfo - 引用自 src/types.ts
 *          QueensSolver - 引用自 src/core/solver.ts, getLevelById - 引用自 src/core/levels.ts
 *          soundManager - 引用自 src/audio/soundManager.ts
 * [OUTPUT]: GameStateManager 响应式状态机类及 gameState 单例
 * [POS]: 全局响应式状态机与业务逻辑枢纽，驱动数据流、撤销栈、倒计时与持久化
 *
 * [自指声明]
 * 1. 一旦我被更新，必须更新本文件 Header
 * 2. 影响外部接口则更新所属 folder.md/CLAUDE.md
 * 3. 架构级变动则更新根目录 CLAUDE.md
 * 4. 若依赖的文件 POS 变化，需检查本文件 INPUT 是否仍然准确
 *
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { CellState, LevelData, UserProfile, GameStatus, ConflictInfo } from '../types';
import { QueensSolver } from './solver';
import { getLevelById } from './levels';
import { soundManager } from '../audio/soundManager';

export class GameStateManager {
  private static instance: GameStateManager;

  public user: UserProfile = {
    level: 1, // 初始从第 1 关开始闯关
    maxUnlockedLevel: 1, // 当前用户已解锁的最高关卡 (未通关的关卡不可跳跃)
    coins: 46,
    energy: 166,
    lives: 2,
    streak: 6,
    props: {
      detector: 1,
      hint: 1
    },
    settings: {
      sound: true,
      haptics: true,
      colorblind: false,
      coordinates: false,
      autoCross: false
    }
  };

  public currentLevel!: LevelData;
  public grid: CellState[][] = [];
  public conflicts: ConflictInfo[] = [];
  public status: GameStatus = 'PLAYING';
  public timeRemaining: number = 209;
  public remainingPonies: number = 7;

  public lastPopCell: { row: number; col: number } | null = null;
  public lastErrorCell: { row: number; col: number } | null = null;

  private history: CellState[][][] = [];
  private timerInterval: number | null = null;
  private listeners: (() => void)[] = [];

  private constructor() {
    this.loadStorage();
    this.loadLevel(this.user.level);
  }

  public static getInstance(): GameStateManager {
    if (!GameStateManager.instance) {
      GameStateManager.instance = new GameStateManager();
    }
    return GameStateManager.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  public onTimerTick: ((time: number) => void) | null = null;
  public onErrorMessage: ((msg: string) => void) | null = null;

  public loadLevel(levelId: number) {
    // 关卡锁判定：用户只能选择 <= maxUnlockedLevel 的已通关或当前关卡进行挑战
    const maxUnlocked = this.user.maxUnlockedLevel || 1;
    if (levelId > maxUnlocked) {
      if (this.onErrorMessage) {
        this.onErrorMessage(`第 ${levelId} 关尚未解锁，请先通过第 ${maxUnlocked} 关！`);
      }
      return;
    }

    this.currentLevel = getLevelById(levelId);
    this.user.level = levelId;
    this.grid = Array.from({ length: this.currentLevel.size }, () =>
      new Array<CellState>(this.currentLevel.size).fill(CellState.EMPTY)
    );
    this.history = [];
    this.conflicts = [];
    this.status = 'PLAYING';
    this.timeRemaining = this.currentLevel.initialTime || 209;
    this.remainingPonies = this.currentLevel.targetCount || this.currentLevel.size;

    this.startTimer();
    this.saveStorage();
    this.notify();
  }

  public startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = window.setInterval(() => {
      if (this.status !== 'PLAYING') return;
      if (this.timeRemaining > 0) {
        this.timeRemaining--;
        if (this.onTimerTick) {
          this.onTimerTick(this.timeRemaining);
        }
        if (this.timeRemaining === 0) {
          this.handleTimeOut();
        }
      } else {
        this.handleTimeOut();
      }
    }, 1000);
  }

  public stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private handleTimeOut() {
    this.status = 'LOST';
    this.stopTimer();
    soundManager.playConflict();
    this.notify();
  }

  /**
   * 记录一步历史用于撤销
   */
  private pushHistory() {
    const copy = this.grid.map(row => [...row]);
    this.history.push(copy);
    if (this.history.length > 50) this.history.shift();
  }

  /**
   * 循环切换格子状态：EMPTY -> CROSS (白叉) -> ANIMAL (正确牛头) / ERROR_CROSS (错误红叉) -> EMPTY
   * 严苛益智逻辑：选错绝不放牛头，直接化为红色错误叉叉 ❌，并触发报错打击反馈；选对才升起 Q 弹小牛！
   */
  public cycleCell(r: number, c: number) {
    if (this.status !== 'PLAYING') return;

    this.pushHistory();
    const cur = this.grid[r][c];
    let next: CellState = CellState.EMPTY;

    if (cur === CellState.EMPTY) {
      // 1. 空白格 -> 正常白色排查叉叉
      next = CellState.CROSS;
      this.lastPopCell = null;
      this.lastErrorCell = null;
      soundManager.playCross();
      this.grid[r][c] = next;
      this.evaluateBoard();
    } else if (cur === CellState.CROSS) {
      // 2. 叉叉 -> 玩家想要放置牛头：校验是否为本关正解坐标！
      const solution = this.currentLevel.solution || (QueensSolver.solve(this.currentLevel.regions)[0] ?? []);
      const isCorrect = solution.some(s => s.row === r && s.col === c);

      if (!isCorrect) {
        // ❌ 选错了：坚决不生成牛头，直接变成红色错误叉叉 ❌ 并触发抖动报错与错误音效！
        next = CellState.ERROR_CROSS;
        this.lastErrorCell = { row: r, col: c };
        this.lastPopCell = null;
        soundManager.playConflict();
        if (this.onErrorMessage) {
          this.onErrorMessage('该位置选错啦，已为你标红排除！');
        }
        this.grid[r][c] = next;
        this.evaluateBoard();
        setTimeout(() => {
          if (this.lastErrorCell && this.lastErrorCell.row === r && this.lastErrorCell.col === c) {
            this.lastErrorCell = null;
            this.notify();
          }
        }, 800);
      } else {
        // ✅ 选对了：成功升起可爱萌牛 🐮 并触发 Q 弹放大回弹动效！
        next = CellState.ANIMAL;
        this.lastPopCell = { row: r, col: c };
        this.lastErrorCell = null;
        soundManager.playAnimal();
        this.grid[r][c] = next;
        this.evaluateBoard();
      }
    } else if (cur === CellState.ERROR_CROSS) {
      // 3. 错误红叉 -> 允许重置为空白格
      next = CellState.EMPTY;
      this.lastPopCell = null;
      this.lastErrorCell = null;
      soundManager.playTap();
      this.grid[r][c] = next;
      this.evaluateBoard();
    } else {
      // 4. 正确牛头 -> 允许重置为空白格
      next = CellState.EMPTY;
      this.lastPopCell = null;
      this.lastErrorCell = null;
      soundManager.playTap();
      this.grid[r][c] = next;
      this.evaluateBoard();
    }
  }

  /**
   * 直接设置格子状态（用于玩家单指拖拽连划 ❌）
   */
  public autoFillCross(r: number, c: number) {
    if (this.status !== 'PLAYING') return;
    let changed = false;

    // 行和列
    for (let i = 0; i < this.currentLevel.size; i++) {
      if (i !== c && this.grid[r][i] === CellState.EMPTY) {
        this.grid[r][i] = CellState.CROSS;
        changed = true;
      }
      if (i !== r && this.grid[i][c] === CellState.EMPTY) {
        this.grid[i][c] = CellState.CROSS;
        changed = true;
      }
    }

    // 周围 8 个格子
    const dirs = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < this.currentLevel.size && nc >= 0 && nc < this.currentLevel.size) {
        if (this.grid[nr][nc] === CellState.EMPTY) {
          this.grid[nr][nc] = CellState.CROSS;
          changed = true;
        }
      }
    }

    // 同一区域 (颜色)
    const regionId = this.currentLevel.regions[r][c];
    for (let i = 0; i < this.currentLevel.size; i++) {
      for (let j = 0; j < this.currentLevel.size; j++) {
        if (this.currentLevel.regions[i][j] === regionId && this.grid[i][j] === CellState.EMPTY) {
          this.grid[i][j] = CellState.CROSS;
          changed = true;
        }
      }
    }

    if (changed) {
      this.evaluateBoard();
      this.notify();
    }
  }

  /**
   * 玩家试图在 (r, c) 放置牛头（严格校验唯一正解）
   */
  public handlePlaceAnimal(r: number, c: number) {
    if (this.status !== 'PLAYING') return;

    this.pushHistory();
    const solution = this.currentLevel.solution || (QueensSolver.solve(this.currentLevel.regions)[0] ?? []);
    const isCorrect = solution.some(s => s.row === r && s.col === c);

    if (!isCorrect) {
      // ❌ 选错了：坚决不能放牛头！直接变成红色错误叉叉 ❌
      this.grid[r][c] = CellState.ERROR_CROSS;
      this.lastErrorCell = { row: r, col: c };
      this.lastPopCell = null;
      soundManager.playConflict();
      if (this.onErrorMessage) {
        this.onErrorMessage('该位置选错啦，已为你标红排除！');
      }
      this.evaluateBoard();
      setTimeout(() => {
        if (this.lastErrorCell && this.lastErrorCell.row === r && this.lastErrorCell.col === c) {
          this.lastErrorCell = null;
          this.notify();
        }
      }, 800);
    } else {
      // ✅ 选对了：该位置是真正的正解牛头！
      this.grid[r][c] = CellState.ANIMAL;
      this.lastPopCell = { row: r, col: c };
      this.lastErrorCell = null;
      soundManager.playAnimal();
      this.evaluateBoard();
    }
  }

  public setCellState(r: number, c: number, state: CellState, recordHistory: boolean = true) {
    if (this.status !== 'PLAYING') return;
    if (this.grid[r][c] === state) return;

    if (state === CellState.ANIMAL) {
      this.handlePlaceAnimal(r, c);
      return;
    }

    if (recordHistory) this.pushHistory();
    this.grid[r][c] = state;
    this.lastPopCell = null; // 清除新落子标记，确保已有牛头不重复跳动

    if (state === CellState.CROSS) {
      soundManager.playCross();
    } else if (state === CellState.EMPTY) {
      soundManager.playTap();
    }

    this.evaluateBoard();
  }

  /**
   * 撤销上一步
   */
  public undo() {
    if (this.status !== 'PLAYING' || this.history.length === 0) return;
    const prev = this.history.pop();
    if (prev) {
      this.grid = prev;
      soundManager.playButton();
      this.evaluateBoard();
    }
  }

  /**
   * 清除棋盘上所有标记
   */
  public clearBoard() {
    if (this.status !== 'PLAYING') return;
    this.pushHistory();
    const size = this.currentLevel.size;
    this.grid = Array.from({ length: size }, () => new Array<CellState>(size).fill(CellState.EMPTY));
    soundManager.playButton();
    this.evaluateBoard();
  }

  /**
   * 道具：使用放大镜/探照 (自动排查填充 X)
   */
  public useDetectorProp(): boolean {
    if (this.status !== 'PLAYING' || this.user.props.detector <= 0) return false;
    const exclusions = QueensSolver.getDetectorExclusions(this.grid, this.currentLevel.regions);
    if (exclusions.length === 0) return false;

    this.pushHistory();
    this.user.props.detector--;
    soundManager.playHint();

    exclusions.forEach(({ row, col }) => {
      this.grid[row][col] = CellState.CROSS;
    });

    this.evaluateBoard();
    this.saveStorage();
    return true;
  }

  /**
   * 道具：使用灯泡提示 (直接放置 1 匹正解小马)
   */
  public useHintProp(): boolean {
    if (this.status !== 'PLAYING' || this.user.props.hint <= 0) return false;
    const target = QueensSolver.getSmartHint(this.grid, this.currentLevel.regions);
    if (!target) return false;

    this.pushHistory();
    this.user.props.hint--;
    soundManager.playHint();

    this.grid[target.row][target.col] = CellState.ANIMAL;
    this.evaluateBoard();
    this.saveStorage();
    return true;
  }

  public toggleColorblind() {
    this.user.settings.colorblind = !this.user.settings.colorblind;
    soundManager.playButton();
    this.saveStorage();
    this.notify();
  }

  public toggleCoordinates() {
    this.user.settings.coordinates = !this.user.settings.coordinates;
    soundManager.playButton();
    this.saveStorage();
    this.notify();
  }

  public toggleSound() {
    this.user.settings.sound = !this.user.settings.sound;
    soundManager.setSoundEnabled(this.user.settings.sound);
    soundManager.playButton();
    this.saveStorage();
    this.notify();
  }

  /**
   * 评估棋盘状态：计算冲突与胜利判定
   */
  private evaluateBoard() {
    const size = this.currentLevel.size;
    this.conflicts = QueensSolver.findConflicts(this.grid, this.currentLevel.regions);

    let placedCount = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (this.grid[r][c] === CellState.ANIMAL) {
          placedCount++;
        }
      }
    }

    this.remainingPonies = Math.max(0, size - placedCount);

    // 冲突震慑音效
    if (this.conflicts.length > 0) {
      soundManager.playConflict();
    }

    // 胜利条件：恰好放置了 N 匹小马，且无任何冲突
    if (placedCount === size && this.conflicts.length === 0) {
      this.handleWin();
    }

    this.notify();
  }

  private handleWin() {
    this.status = 'WON';
    this.stopTimer();
    this.user.coins += 10;
    this.user.streak += 1;
    // 成功通关：解锁下一关
    this.user.maxUnlockedLevel = Math.max(this.user.maxUnlockedLevel || 1, this.user.level + 1);
    soundManager.playWin();
    this.saveStorage();
    this.notify();
  }

  public nextLevel() {
    const nextLvl = this.user.level + 1;
    this.user.maxUnlockedLevel = Math.max(this.user.maxUnlockedLevel || 1, nextLvl);
    this.loadLevel(nextLvl);
  }

  public retryLevel() {
    this.loadLevel(this.user.level);
  }

  /**
   * 倒计时耗尽复活：保留当前棋盘推理进度，续时 60 秒继续挑战
   */
  public reviveWithTime(extraSeconds: number = 60) {
    this.status = 'PLAYING';
    this.timeRemaining = extraSeconds;
    this.startTimer();
    soundManager.playButton();
    this.notify();
  }

  /**
   * 倒计时耗尽复活：自动落下一只正确牛头并加时 60 秒继续挑战
   */
  public reviveWithHint() {
    this.status = 'PLAYING';
    this.timeRemaining = 60;
    const target = QueensSolver.getSmartHint(this.grid, this.currentLevel.regions);
    if (target) {
      this.grid[target.row][target.col] = CellState.ANIMAL;
      this.lastPopCell = { row: target.row, col: target.col };
      soundManager.playAnimal();
      this.evaluateBoard();
    }
    this.startTimer();
    this.notify();
  }

  /**
   * 重置游戏进度回到第 1 关
   */
  public resetProgress() {
    this.user.level = 1;
    this.user.maxUnlockedLevel = 1;
    this.user.coins = 0;
    this.user.streak = 0;
    this.user.props = { detector: 3, hint: 3 };
    this.saveStorage();
    this.loadLevel(1);
  }

  public isFirstLaunch: boolean = false;

  /**
   * 生成跨设备导出存档码 (Base64 安全编码)
   */
  public generateSaveCode(): string {
    const payload = {
      v: 1,
      l: this.user.level,
      m: this.user.maxUnlockedLevel,
      c: this.user.coins,
      s: this.user.streak,
      p: this.user.props,
      t: Date.now()
    };
    try {
      const jsonStr = JSON.stringify(payload);
      return 'NIU-' + btoa(unescape(encodeURIComponent(jsonStr)));
    } catch {
      return 'NIU-' + btoa(JSON.stringify(payload));
    }
  }

  /**
   * 导入跨设备存档码并实时恢复游戏进度
   */
  public importSaveCode(code: string): boolean {
    try {
      let raw = code.trim();
      if (raw.startsWith('NIU-')) raw = raw.slice(4);
      const jsonStr = decodeURIComponent(escape(atob(raw)));
      const p = JSON.parse(jsonStr);

      if (p && typeof p.l === 'number') {
        this.user.level = Math.max(1, p.l);
        this.user.maxUnlockedLevel = Math.max(1, p.m || p.l);
        this.user.coins = Math.max(0, p.c || 0);
        this.user.streak = Math.max(0, p.s || 0);
        if (p.p) {
          this.user.props = {
            detector: Math.max(0, p.p.detector ?? p.p.d ?? 1),
            hint: Math.max(0, p.p.hint ?? p.p.h ?? 1)
          };
        }
        this.saveStorage();
        this.loadLevel(this.user.level);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private saveStorage() {
    try {
      localStorage.setItem('NIULAI_SUDOKU_USER_V2', JSON.stringify(this.user));
    } catch {
      // 忽略无法写入 LocalStorage 的情况
    }
  }

  private loadStorage() {
    try {
      // 从本地持久化存储加载用户关卡进度与设置
      const data = localStorage.getItem('NIULAI_SUDOKU_USER_V2');
      if (data) {
        const parsed = JSON.parse(data);
        this.user = { ...this.user, ...parsed };
        
        // 容错校准：确保 level 与 maxUnlockedLevel 有效且合法
        this.user.maxUnlockedLevel = Math.max(1, this.user.maxUnlockedLevel || this.user.level || 1);
        this.user.level = Math.max(1, Math.min(this.user.level || 1, this.user.maxUnlockedLevel));

        soundManager.setSoundEnabled(this.user.settings.sound);
        soundManager.setHapticsEnabled(this.user.settings.haptics);
        this.isFirstLaunch = false;
      } else {
        // 新设备首次进入
        this.user.level = 1;
        this.user.maxUnlockedLevel = 1;
        this.isFirstLaunch = true;
      }
    } catch {
      this.user.level = 1;
      this.user.maxUnlockedLevel = 1;
      this.isFirstLaunch = false;
    }
  }
}

export const gameState = GameStateManager.getInstance();
