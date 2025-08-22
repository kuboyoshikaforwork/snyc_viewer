/**
 * @fileoverview 2画面分割表示を管理するクラスの定義
 * @author Masaaki Takeuchi(MESW)
 * @created 2025/05/20
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import {COPCConf} from './conf/copcConf';
import {COPCViewer} from './copcViewer';
import {LOG_CONF} from './log/logConf';
import {Logging} from './log/logging';

/** 動作モード */
const MULTI_VIEWER_MODE = {
  SYNC_ON: 0,
  SYNC_OFF: 1,
};

/** メイン画面の設定番号 */
const MAIN_VIEWER = {
  NO1: 1,
  NO2: 2,
};

/**
 * 2画面分割表示を管理するクラス
 */
export class MultiViewerControl {
  /** 2画面分割表示の1つ目のビューアオブジェクト */
  private viewer1: COPCViewer;
  /** 2画面分割表示の2つ目のビューアオブジェクト */
  private viewer2: COPCViewer;

  /** 動作モード(0：連動、1：独立) */
  private mode: number = MULTI_VIEWER_MODE.SYNC_ON;

  /** 連動動作時のメイン画面番号 */
  private mainViewer: number;

  /**
   * 2画面分割表示を管理するオブジェクトを生成する。
   * @param viewer1 2画面分割表示の1つ目のビューアオブジェクト
   * @param viewer2 2画面分割表示の2つ目のビューアオブジェクト
   */
  constructor(viewer1: COPCViewer, viewer2: COPCViewer) {
    // ビューア設定
    this.viewer1 = viewer1;
    this.viewer2 = viewer2;

    // 制御オブジェクト設定
    this.viewer1.setSync(this);
    this.viewer2.setSync(this);

    // メイン画面設定
    this.mainViewer = MAIN_VIEWER.NO1;

    // 設定反映
    this.applyConfig();

    Logging.info(LOG_CONF.INFO_MULTI_VIEWER);
  }

  /**
   * 2画面分割表示を管理するオブジェクトに設定ファイルの定義を反映する。
   */
  public applyConfig() {
    // 動作モード設定
    this.mode = COPCConf.conf.MULTI_VIEW_MODE;
  }

  /**
   * 「独立」「連動」切り替え時に、視点・注視点の基準となる画面を設定する
   * @param mainViewer 基準となる画面の番号(1 or 2)
   * @throws 設定可能画面番号以外の数値を設定
   */
  public setMainViewer(mainViewer: number): void {
    if (mainViewer === MAIN_VIEWER.NO1 || mainViewer === MAIN_VIEWER.NO2) {
      Logging.info(LOG_CONF.INFO_MULTI_VIEWER_SET_MAIN, mainViewer.toString());
      this.mainViewer = mainViewer;
    } else {
      const message: string = Logging.error(LOG_CONF.ERROR_MULTI_VIEWER_SET_MAIN, mainViewer.toString());
      throw new Error(message);
    }
  }

  /**
   * 動作モードを「連動」に設定し、視点・注視点を基準の画面に合わせる
   */
  public syncOn(): void {
    Logging.info(LOG_CONF.INFO_MULTI_VIEWER_SYNC_ON);
    this.mode = MULTI_VIEWER_MODE.SYNC_ON;

    // 基準画面の視点・注視点を反映
    if (this.mainViewer === MAIN_VIEWER.NO1) {
      this.viewer2.getControls().setEye(this.viewer1.getControls().getEye());
      this.viewer2.getControls().setFocus(this.viewer1.getControls().getFocus());
    } else {
      this.viewer1.getControls().setEye(this.viewer2.getControls().getEye());
      this.viewer1.getControls().setFocus(this.viewer2.getControls().getFocus());
    }
  }

  /**
   * 動作モードを「独立」に設定する
   */
  public syncOff(): void {
    Logging.info(LOG_CONF.INFO_MULTI_VIEWER_SYNC_OFF);
    this.mode = MULTI_VIEWER_MODE.SYNC_OFF;
  }

  /**
   * 動作モードに応じて画面の視点と注視点の位置を設定する
   * @param viewer 画面制御対象のビューアオブジェクト
   */
  public update(viewer: COPCViewer): void {
    if (this.mode === MULTI_VIEWER_MODE.SYNC_ON) {
      // 動作モードが「連動」の場合、処理対象画面の視点・注視点を他方の画面に反映
      if (viewer === this.viewer1) {
        this.viewer2.getControls().setEye(this.viewer1.getControls().getEye());
        this.viewer2.getControls().setFocus(this.viewer1.getControls().getFocus());
      } else {
        this.viewer1.getControls().setEye(this.viewer2.getControls().getEye());
        this.viewer1.getControls().setFocus(this.viewer2.getControls().getFocus());
      }
    } else {
      // 動作モードが「独立」の場合、何もしない
    }
  }
}
