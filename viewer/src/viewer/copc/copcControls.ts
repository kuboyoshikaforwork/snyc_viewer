/**
 * @fileoverview 3D空間の点群表示のカメラ制御を提供するクラスの定義
 * @author Kota Kubota(SEQ)
 * @created 2025/05/02
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import {COPCConf} from '../conf/copcConf';
import {ViewCamera} from '../three/viewCamera';
import {CameraControls} from '../three/cameraControls';
import {Logging} from '../log/logging';
import {LOG_CONF} from '../log/logConf';

/**
 * 3D空間の点群表示のカメラ制御を提供するクラス
 * @extends CameraControls
 */
export class COPCControls extends CameraControls {
  /** ダブルクリック注視点移動制御可否 */
  private dblClickEnabled: boolean = true;

  /**
   * コンストラクタ
   * @param camera 3D空間のカメラオブジェクト
   * @param domElement レンダラーのキャンバス要素
   * @param yAxisUp Y軸Z軸上方向設定(true：Y軸上方向、false：Z軸上方向)
   */
  constructor(camera: ViewCamera, domElement: HTMLElement, yAxisUp: boolean) {
    super(camera, domElement, yAxisUp);

    // 設定値反映
    this.dblClickEnabled = COPCConf.conf.DBLCLICK_MOVE_EYE_ENABLED;
  }

  /**
   * 3D空間のカメラ制御オブジェクトに設定ファイルの定義を反映する。
   */
  public applyConfig(): void {
    super.applyConfig();
    this.dblClickEnabled = COPCConf.conf.DBLCLICK_MOVE_EYE_ENABLED;
  }

  /**
   * ダブルクリック注視点移動有効化
   */
  public setDblclickFocusMoveEnabled(): void {
    this.dblClickEnabled = true;
    Logging.debug(LOG_CONF.DEBUG_ENABLE_DOUBLECLICK_FOCUS_MOVE);
  }

  /**
   * ダブルクリック注視点移動無効化
   */
  public setDblclickFocusMoveDisabled(): void {
    this.dblClickEnabled = false;
    Logging.debug(LOG_CONF.DEBUG_DISABLE_DOUBLECLICK_FOCUS_MOVE);
  }

  /**
   * ダブルクリック注視点移動有効化状態取得
   * @returns ダブルクリック注視点移動有効化状態
   */
  public isDblclickFocusMoveEnabled(): boolean {
    return this.dblClickEnabled;
  }
}
