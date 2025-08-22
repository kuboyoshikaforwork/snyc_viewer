/**
 * @fileoverview 点群データ計測
 * @author Masaaki Takeuchi(MESW)
 * @created 2025/05/23
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import * as THREE from 'three';
import {Intersection, Object3D} from 'three';

import {PointDef} from './pointDef';
import {PointSet} from './pointSet';
import {ViewCamera} from '../three/viewCamera';
import {COPCControls} from '../copc/copcControls';
import {COPCScene} from '../copc/copcScene';
import {LeadlineProp} from '../three/viewScene';
import {COPCConf} from '../conf/copcConf';
import {COPCUtil} from '../util/copcUtil';
import {NodeInfo} from './nodeInfo';
import {TransformControls} from 'three/examples/jsm/controls/TransformControls.js';
import {LOG_CONF} from '../log/logConf';
import {Logging} from '../log/logging';
import {DownloadStatus, LasDownload} from './lasDownload';

/** 実行モード */
const MEASURE_MODE = {
  POINT_SELECTION: 0, // 点選択
  VERTICAL_MEASURE: 1, // 鉛直距離計測
  RANGE_SELECTION: 2, // 範囲選択
};

/** 無回転クォータニオン定義 */
const NO_ROTATE_QUATERNION = new THREE.Quaternion(0, 0, 0, 1);

/** オブジェクト操作モード */
export const OBJECT_CONTROL_MODE = {
  TRANSLATE: 0,
  ROTATE: 1,
  SCALE: 2,
};

/** 点選択の固定値 */
const POINT_SELECT = {
  POINT: {
    OPACITY: 1,
  },
  LINE: {
    OPACITY: 1,
    WIDTH: 1,
  },
  BOX: {
    OPACITY: 0.2,
    COLOR: 0xff0080,
  },
};
Object.freeze(POINT_SELECT);

/** 距離計測結果固定値 */
const VERTICAL_MEASURE = {
  POLE: {
    RADIAL_SEGMENTS: 32,
    OPACITY: 1,
    COLOR: 0xffffff,
  },
  SPHERE: {
    WIDTH_SEGMENTS: 32,
    HEIGHT_SEGMENTS: 32,
    OPACITY: 1,
  },
  TEXT: {
    POINT_COLOR: 0xff0000,
    POINT_RADIUS: 1,
    FONT: 'MS ゴシック',
    FONT_SIZE: 100,
    TEXT_COLOR: 0xff0000,
    POSITION: 'center',
    MARGIN: 5,
    LINE_COLOR: 0xff0000,
    LINE_WIDTH: 10,
    LINE_V_LENGTH: 50,
    LINE_ANGLE: 40,
    HV_LINE_ANGLE: 220,
    LINE_LENGTH_OFFSET: 75,
  },
};
Object.freeze(VERTICAL_MEASURE);

/** 範囲選択の固定値 */
const RANGE_SELECT = {
  OPACITY: 0.2,
  LINE_THICKNESS: 2,
  BOX: {
    WIDTH: 1,
    HEIGHT: 1,
    DEPTH: 1,
  },
  CYLINDER: {
    TOP_RADIUS: 1,
    BOTTOM_RADIUS: 1,
    HEIGHT: 1,
    RADIAL_SEGMENTS: 8,
    HEIGHT_SEGMENTS: 1,
    THETA_START: 0,
    THETA_LENGTH: Math.PI * 2,
  },
  SPHERE: {
    RADIUS: 1,
    WIDTH_SEGMENTS: 8,
    HEIGHT_SEGMENTS: 8,
  },
};
Object.freeze(RANGE_SELECT);

/** 2点選択の開始終了番号 */
const PS_POINT_POSITION = {
  START: 0,
  END: 1,
};
Object.freeze(PS_POINT_POSITION);

/** 点選択モード */
export const POINT_SELECTION_MODE = {
  NONE: -1,
  BOX: 0,
  DOUBLE: 1,
  HORIZONTAL_DOUBLE: 2,
  VERTICAL_DOUBLE: 3,
  SINGLE: 4,
};
Object.freeze(POINT_SELECTION_MODE);

/** 範囲選択オブジェクト種別 */
export const RANGE_SELECT_TYPE = {
  NONE: -1,
  BOX: 0,
  CYLINDER: 1,
  SPHERE: 2,
};
Object.freeze(RANGE_SELECT_TYPE);

/**
 * @interface オブジェクト操作イベント
 */
interface TransformEvent extends THREE.Event<string, TransformControls> {
  value: unknown;
}

/**
 * @interface 選択処理の計算パラメータ情報
 */
export interface SelectionParameter {
  position: THREE.Vector3;
  size: THREE.Vector3;
  matrix: THREE.Matrix4;
  checkInOut: (position: THREE.Vector4) => boolean;
}

/**
 * 点群データ計測を管理するクラス
 */
export class PointMeasure {
  /** 3D空間の点群表示シーンオブジェクト */
  private scene: COPCScene;
  /** 3D空間のカメラオブジェクト */
  private camera: ViewCamera;
  /** 3D空間のカメラ制御オブジェクト */
  private controls: COPCControls;
  /** 点群定義オブジェクト */
  private pointDef: PointDef;
  /** 点群データ管理オブジェクトの一覧 */
  private pointSetMap: Map<string, PointSet> = new Map();
  /** Y軸Z軸上方向設定(true：Y軸上方向、false：Z軸上方向) */
  private yAxisUp: boolean;

  /** ドラッグ制御オブジェクト */
  private objectControls: TransformControls;
  /** ドラッグ制御ドラッグチェンジイベントハンドラ */
  private ctrldraggingChangedEvent: (event: TransformEvent) => void;
  /** ドラッグ制御チェンジイベントハンドラ */
  private ctrlChangeEvent: (event: THREE.Event<string, TransformControls>) => void;

  /** 点群データ計測処理のモード */
  private measureMode: number = MEASURE_MODE.POINT_SELECTION;

  /** 点選択方式 */
  private psMode: number = POINT_SELECTION_MODE.BOX;
  /** 点選択処理の開始終了位置の点オブジェクト */
  private psPointObjects: [THREE.Points | undefined, THREE.Points | undefined] = [undefined, undefined];
  /** 点選択処理の開始位置の座標オブジェクト */
  private psStPoint: THREE.Vector3 | undefined = undefined;
  /** 点選択処理の終了位置の座標オブジェクト */
  private psEdPoint: THREE.Vector3 | undefined = undefined;
  /** 点選択処理(2点選択)の線オブジェクト */
  private psLineObject: THREE.Line | undefined = undefined;
  /** 点選択処理(矩形選択)の矩形オブジェクト */
  private psBoxObject: THREE.Mesh | undefined = undefined;
  /** 鉛直距離計測用オブジェクト */
  private pointDistanceObject: THREE.Object3D[] = [];
  /** 範囲選択処理のオブジェクト */
  private rsObject: THREE.Mesh | undefined = undefined;

  /** 鉛直距離計測有効状態 */
  private verticalMeasureEnable: boolean = false;

  /** 点選択完了時コールバック */
  private pointSelectionCallback: (() => void) | undefined = undefined;
  // 型の変更（SW仕様書記載型「(value: number)=>void」）
  /** 鉛直距離計測結果設定用コールバック(value：鉛直距離計測結果値(単位：m)) */
  private pointDistanceCallback: ((value: number) => void) | undefined = undefined;

  // 範囲選択処理
  /** オブジェクト種別(0: 直方体、1: 円柱、2: 球) */
  private rsType: number = RANGE_SELECT_TYPE.NONE;
  /** 範囲選択の回転を表すベクトル */
  private rsRotate: THREE.Vector3 = new THREE.Vector3();
  /** 範囲選択のサイズを表すベクトル */
  private rsSize: THREE.Vector3 = new THREE.Vector3();
  /** 範囲選択処理のオブジェクトの半径 */
  private rsRadius: number = 0;
  /** 範囲選択処理のオブジェクトの円周の開始位置 */
  private rsThetaStart: number = 0;
  /** 範囲選択処理のオブジェクトの円周の角度 */
  private rsThetaLength: number = 360;
  /** 範囲選択の回転行列 */
  private rsRotateMatrix = new THREE.Matrix4();

  /** オブジェクトサイズ設定用コールバック */
  private objectSizeCallback:
    | ((width: number, height: number, depth: number, radius: number, thetaLength: number, thetaStart: number) => void)
    | undefined = undefined;
  /** オブジェクト回転状態設定用コールバック */
  private objectRotateCallback: ((x: number, y: number, z: number) => void) | undefined = undefined;

  /** LASファイルダウンロード処理 */
  private lasDownloaders: Set<LasDownload> = new Set();

  /**
   * コンストラクタ
   * @param scene 3D空間の点群表示シーンオブジェクト
   * @param camera 3D空間のカメラオブジェクト
   * @param controls 3D空間の点群表示カメラ制御オブジェクト
   * @param pointDef 点群定義オブジェクト
   * @param pointSetMap 点群データ管理オブジェクトの一覧
   * @param domElement レンダラーのキャンバス要素
   * @param yAxisUp Y軸Z軸上方向設定(true：Y軸上方向、false：Z軸上方向)
   */
  constructor(
    scene: COPCScene,
    camera: ViewCamera,
    controls: COPCControls,
    pointDef: PointDef,
    pointSetMap: Map<string, PointSet>,
    domElement: HTMLElement,
    yAxisUp: boolean,
  ) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.pointDef = pointDef;
    this.pointSetMap = pointSetMap;
    this.yAxisUp = yAxisUp;

    // イベント処理バインド
    this.ctrldraggingChangedEvent = this.onCtrlDraggingChangedEvent.bind(this);
    this.ctrlChangeEvent = this.onCtrlChangedEvent.bind(this);

    // オブジェクト制御コントローラー
    this.objectControls = new TransformControls(this.camera.get(), domElement);
    this.objectControls.addEventListener('dragging-changed', this.ctrldraggingChangedEvent);
    this.objectControls.addEventListener('change', this.ctrlChangeEvent);
    this.scene.addObject3D(this.objectControls.getHelper());

    // 設定値反映
    this.applyConfig();
  }

  /**
   * 設定ファイルの定義を反映する。
   */
  public applyConfig(): void {
    // 生成済のオブジェクトを破棄
    this.clearPointSelection();
    this.stopRangeSelection();

    // 点選択処理反映
    this.psMode = COPCConf.conf.SELECTION_MODE;

    // 範囲選択処理反映
    this.rsSize = new THREE.Vector3(
      COPCConf.conf.SELECT_RANGE_X_SIZE,
      COPCConf.conf.SELECT_RANGE_Y_SIZE,
      COPCConf.conf.SELECT_RANGE_Z_SIZE,
    );
    this.rsRadius = COPCConf.conf.SELECT_RANGE_RADIUS;
    this.rsThetaStart = THREE.MathUtils.degToRad(COPCConf.conf.SELECT_RANGE_THETA_S);
    this.rsThetaLength = THREE.MathUtils.degToRad(COPCConf.conf.SELECT_RANGE_THETA_L);
  }

  /**
   * オブジェクト操作の開始終了時のイベント処理。視点制御の有効無効を制御する。
   * @param event オブジェクト操作イベント
   */
  private onCtrlDraggingChangedEvent(event: TransformEvent): void {
    if (!event.value) {
      this.controls.setEyeMoveEnabled();
    } else {
      this.controls.setEyeMoveDisabled();
    }
  }

  /**
   * オブジェクト操作中のイベント処理。オブジェクトの状態をパラメータに反映する。
   * @param event オブジェクト操作イベント
   */
  private onCtrlChangedEvent(event: THREE.Event<string, TransformControls>): void {
    if (event.target && event.target.object) {
      this.updateRangeSelectionParameter(event.target.object);
    }
  }

  /**
   * 生成したオブジェクトをすべて削除する。
   */
  public clear(): void {
    // LASダウンロード実行中の場合終了
    for (const downloader of this.lasDownloaders) {
      downloader.terminate();
    }
    this.lasDownloaders.clear();

    // 強制終了によってノードがロード状態のままとなるのを回避
    for (const pointSet of this.pointSetMap.values()) {
      const nodeInfoList = pointSet.getNodeInfoList();
      for (const nodeInfo of nodeInfoList) {
        nodeInfo.loading = false;
      }
    }

    // 点選択処理終了
    this.clearPointSelection();

    // 範囲選択処理を終了
    this.stopRangeSelection();

    // オブジェクト操作処理破棄
    this.scene.removeObject3D(this.objectControls.getHelper());
    this.objectControls.removeEventListener('dragging-changed', this.ctrldraggingChangedEvent);
    this.objectControls.removeEventListener('change', this.ctrlChangeEvent);

    Logging.debug(LOG_CONF.DEBUG_RELEASE_POINT_MEASURE_RESOURCE);
  }

  /**
   * 点選択処理の方式を設定する。
   * @param selectionMode 点選択の方式(0: 矩形選択、1: 2点選択、2: 水平方向制限付き2点選択、3: 垂直方向制限付き2点選択、4: 1点選択)
   * @throws 設定可能方式以外の数値を設定
   */
  public setPointSelectionMode(selectionMode: number): void {
    if (!(POINT_SELECTION_MODE.BOX <= selectionMode && selectionMode <= POINT_SELECTION_MODE.SINGLE)) {
      const message = Logging.error(LOG_CONF.ERROR_POINT_SELECT_MODE, selectionMode.toString());
      throw new Error(message);
    }
    this.psMode = selectionMode;
    Logging.info(LOG_CONF.INFO_SET_POINT_SELECT_MODE, selectionMode.toString());
  }

  /**
   * 選択中の点選択の方式を取得する。
   * @returns 点選択処理の方式(0: 矩形選択、1: 2点選択、2: 水平方向制限付き2点選択、3: 垂直方向制限付き2点選択、4: 1点選択)
   */
  public getPointSelectionMode(): number {
    return this.psMode;
  }

  /**
   * 点選択開始の処理を実行する。
   * @param position 選択位置の3D座標
   */
  public pointMeasureProcStart(position: THREE.Vector3): void {
    Logging.trace(LOG_CONF.TRACE_MEASURE_START_SELECTION, position.x.toString(), position.y.toString());

    // 実行済の点選択処理を終了
    this.clearPointSelection();

    // 範囲選択中の場合は範囲選択処理を終了
    this.stopRangeSelection();

    // 開始点位置オブジェクト表示処理定義
    const addPsPointObject = (position: THREE.Vector3) => {
      // オブジェクト生成
      this.psPointObjects[PS_POINT_POSITION.START] = this.scene.addPointObject(
        position,
        new THREE.Color(COPCConf.conf.SELECT_POINT_COLOR),
        POINT_SELECT.POINT.OPACITY,
        COPCConf.conf.SELECT_POINT_SIZE,
        false,
      );
    };

    if (this.measureMode === MEASURE_MODE.VERTICAL_MEASURE) {
      // 鉛直距離計測中の場合
      // 開始点を保持・開始点位置にオブジェクト表示
      this.psStPoint = position.clone();
      addPsPointObject(this.psStPoint);
    } else if (this.measureMode === MEASURE_MODE.POINT_SELECTION) {
      // 点選択処理の場合
      if (this.psMode === POINT_SELECTION_MODE.BOX) {
        // 矩形選択の場合、開始点を保持のみ行いオブジェクト生成はしない
        this.psStPoint = position.clone();
      } else {
        // 矩形選択以外の場合、開始点を保持し、オブジェクトを生成
        this.psStPoint = position.clone();
        addPsPointObject(this.psStPoint);
      }
    }
  }

  /**
   * 点選択中の処理を実行する。
   * @event event マウスイベント
   */
  public pointMeasureProcNow(event: MouseEvent): void {
    Logging.trace(LOG_CONF.TRACE_MEASURE_IN_PROGRESS, event.clientX.toString(), event.clientY.toString());

    // 開始点が選択できていない場合は処理を終了
    if (!this.psStPoint) {
      return;
    }

    // 開始点選択状態でシフトキーを押下していない場合は処理終了
    if (!event.shiftKey) {
      this.clearPointSelection();
      return;
    }

    // 終了点位置オブジェクト表示処理定義
    const addPsPointObject = (position: THREE.Vector3) => {
      // 生成済のオブジェクト破棄
      if (this.psPointObjects[PS_POINT_POSITION.END]) {
        this.scene.removePointObject(this.psPointObjects[PS_POINT_POSITION.END] as THREE.Points);
        this.psPointObjects[PS_POINT_POSITION.END] = undefined;
      }
      // オブジェクト生成
      this.psPointObjects[PS_POINT_POSITION.END] = this.scene.addPointObject(
        position,
        new THREE.Color(COPCConf.conf.SELECT_POINT_COLOR),
        POINT_SELECT.POINT.OPACITY,
        COPCConf.conf.SELECT_POINT_SIZE,
        false,
      );
    };
    // ラバーバンドオブジェクト表示処理定義
    const addPsLineObject = (position: THREE.Vector3[]) => {
      // 生成済のオブジェクト破棄
      if (this.psLineObject) {
        this.scene.removeLineObject(this.psLineObject);
        this.psLineObject = undefined;
      }
      // オブジェクト生成
      this.psLineObject = this.scene.addLineObject(
        position,
        new THREE.Color(COPCConf.conf.SELECT_POINT_COLOR),
        POINT_SELECT.LINE.OPACITY,
      );
    };

    if (this.measureMode === MEASURE_MODE.VERTICAL_MEASURE) {
      // 鉛直距離計測有効の場合

      // 開始点の鉛直方向上の3次元座標取得し、終了点位置として保持
      const screen = new THREE.Vector2(event.clientX, event.clientY);
      this.psEdPoint = this.getVerticalPositionAtMouse(this.psStPoint, screen);

      // 終了点位置にオブジェクト表示
      addPsPointObject(this.psEdPoint);

      // 開始点と終了点を結ぶラバーバンドを表示
      const psLinePosition = [this.psStPoint, this.psEdPoint];
      addPsLineObject(psLinePosition);

      // 距離結果をコールバックに設定
      const distance = this.psEdPoint.y - this.psStPoint.y;
      if (this.pointDistanceCallback) {
        this.pointDistanceCallback(distance);
      }
    } else if (this.measureMode === MEASURE_MODE.POINT_SELECTION) {
      // 点選択処理有効の場合

      // 点の座標が取得できていなければ終了
      const position = this.getRayPointPosition(event.clientX, event.clientY);
      if (!position) {
        return;
      }

      // 点選択モードごとの処理
      switch (this.psMode) {
        case POINT_SELECTION_MODE.BOX: {
          // 【矩形選択】
          this.psEdPoint = position.clone();
          const size = new THREE.Vector3(
            Math.abs(this.psEdPoint.x - this.psStPoint.x),
            Math.abs(this.psEdPoint.y - this.psStPoint.y),
            Math.abs(this.psEdPoint.z - this.psStPoint.z),
          );
          // シェーダ処理用にパラメータ設定
          const rotate = new THREE.Vector3(0, 0, 0);
          const rectPosition = this.psStPoint.clone().add(this.psEdPoint).divideScalar(2.0);
          const matrix = this.makeTranslationMatrix(rectPosition, size, rotate);
          this.pointDef.setRangeSelectionMatrix(matrix);
          this.pointDef.setRangeSelectionType(RANGE_SELECT_TYPE.BOX);

          // 立方体表示
          if (this.psBoxObject) {
            this.scene.removeMeshObject(this.psBoxObject);
            this.psBoxObject = undefined;
          }
          this.psBoxObject = this.scene.addBasicMaterialObject(
            rectPosition,
            NO_ROTATE_QUATERNION,
            new THREE.BoxGeometry(size.x, size.y, size.z),
            new THREE.Color(POINT_SELECT.BOX.COLOR),
            POINT_SELECT.BOX.OPACITY,
            THREE.DoubleSide,
          );
          break;
        }
        case POINT_SELECTION_MODE.DOUBLE:
        case POINT_SELECTION_MODE.VERTICAL_DOUBLE:
        case POINT_SELECTION_MODE.HORIZONTAL_DOUBLE: {
          // 【2点選択】
          this.psEdPoint = position.clone();

          // 垂直方向制限付き2点選択の場合
          if (this.psMode === POINT_SELECTION_MODE.VERTICAL_DOUBLE) {
            this.psEdPoint.x = this.psStPoint.x;
            if (this.yAxisUp) {
              this.psEdPoint.z = this.psStPoint.z;
            } else {
              this.psEdPoint.y = this.psStPoint.y;
            }
          }

          // 水平方向制限付き2点選択の場合
          if (this.psMode === POINT_SELECTION_MODE.HORIZONTAL_DOUBLE) {
            if (this.yAxisUp) {
              this.psEdPoint.y = this.psStPoint.y;
            } else {
              this.psEdPoint.z = this.psStPoint.z;
            }
          }

          // 終了点位置にオブジェクト表示
          addPsPointObject(this.psEdPoint);

          // 開始点と終了点を結ぶラバーバンドを表示
          const psLinePosition = [this.psStPoint, this.psEdPoint];
          addPsLineObject(psLinePosition);
          break;
        }
        default:
          // 1点選択やその他の場合は何もしない
          break;
      }
    }
  }

  /**
   * 点選択終了の処理をする。
   */
  public pointMeasureProcEnd(): void {
    // 開始点が選択できていない場合は処理を終了
    if (!this.psStPoint) {
      return;
    }

    // 点選択終了時のコールバック関数実行
    if (this.pointSelectionCallback) {
      this.pointSelectionCallback();
    }
  }

  /**
   * 点選択処理完了時のコールバックを設定する。
   * @param callback 点選択処理完了通知用コールバック
   */
  public setPointSelectCallback(callback: () => void): void {
    this.pointSelectionCallback = callback;
  }

  /**
   * 点群表示シーンの指定した2D座標上に存在する点オブジェクトの座標を取得する。
   * @param x 2D座標のx座標
   * @param y 2D座標のy座標
   * @returns 点オブジェクトの座標
   */
  public getRayPointPosition(x: number, y: number): THREE.Vector3 | undefined {
    const intersections = this.scene.getIntersectPoints(new THREE.Vector2(x, y));

    let targetIntersect: Intersection<Object3D> | undefined = undefined;
    let minDstanceToRay = Number.MAX_SAFE_INTEGER;
    for (const intersect of intersections) {
      if (intersect.object.type === 'Points' && undefined !== intersect.distanceToRay) {
        // レイとオブジェクトの最短距離の最小値となるポイントを取得
        if (intersect.distanceToRay < minDstanceToRay) {
          minDstanceToRay = intersect.distanceToRay;
          targetIntersect = intersect;
        }

        // 最も近いポイントから2m以上離れたら探索終了
        if (2.0 < Math.abs(intersect.distance - intersections[0].distance)) {
          break;
        }
      }
    }

    let position: THREE.Vector3 | undefined = undefined;
    if (targetIntersect && undefined !== targetIntersect.index) {
      const positionAttr = (targetIntersect.object as THREE.Points).geometry.attributes.position;
      position = new THREE.Vector3().fromBufferAttribute(positionAttr, targetIntersect.index);
      Logging.trace(
        LOG_CONF.TRACE_GET_POINT_AT_NDC,
        x.toString(),
        y.toString(),
        position.x.toString(),
        position.y.toString(),
        position.z.toString(),
      );
    }

    return position;
  }

  /**
   * 点選択処理を終了する。
   */
  public clearPointSelection(): void {
    if (!(this.measureMode === MEASURE_MODE.POINT_SELECTION || this.measureMode === MEASURE_MODE.VERTICAL_MEASURE)) {
      return;
    }

    let removeFlag = false;
    // 開始点のオブジェクト破棄
    if (this.psPointObjects[PS_POINT_POSITION.START]) {
      this.scene.removePointObject(this.psPointObjects[PS_POINT_POSITION.START] as THREE.Points);
      this.psStPoint = undefined;
      this.psPointObjects[PS_POINT_POSITION.START] = undefined;
      removeFlag = true;
    }
    // 終了点のオブジェクト破棄
    if (this.psPointObjects[PS_POINT_POSITION.END]) {
      this.scene.removePointObject(this.psPointObjects[PS_POINT_POSITION.END] as THREE.Points);
      this.psEdPoint = undefined;
      this.psPointObjects[PS_POINT_POSITION.END] = undefined;
      removeFlag = true;
    }
    // ラバーバンドのオブジェクト破棄
    if (this.psLineObject) {
      this.scene.removeLineObject(this.psLineObject);
      this.psLineObject = undefined;
      removeFlag = true;
    }
    // 矩形選択のオブジェクト破棄
    if (this.psBoxObject) {
      this.scene.removeMeshObject(this.psBoxObject);
      this.psBoxObject = undefined;
      removeFlag = true;
    }
    // Shaderの点選択処理の無効化
    this.pointDef.setRangeSelectionType(RANGE_SELECT_TYPE.NONE);

    // 鉛直距離計測中の場合結果初期化
    if (this.measureMode === MEASURE_MODE.VERTICAL_MEASURE) {
      if (this.pointDistanceCallback) {
        this.pointDistanceCallback(0);
      }
    }

    if (removeFlag) {
      Logging.trace(LOG_CONF.TRACE_MEASURE_END_SELECTION);
    }
  }

  /******************************************************************/
  // 距離計測
  /******************************************************************/

  /**
   * 2点選択状態の場合に2点間の距離(直線・水平・高さ)を算出し、表示結果を示すオブジェクトを生成する。
   * @returns 距離情報[直線距離, 水平距離, 垂直距離]
   * @throws 2点が選択されていない
   */
  public showPointDistance(): [number, number, number] {
    // 点選択実行中でない場合は終了
    if (this.measureMode !== MEASURE_MODE.POINT_SELECTION) {
      const message = Logging.error(LOG_CONF.ERROR_NOT_SELECTED_TWO_POINTS);
      throw new Error(message);
    }

    // 点選択が2点選択以外の場合は終了
    if (
      this.psMode !== POINT_SELECTION_MODE.DOUBLE &&
      this.psMode !== POINT_SELECTION_MODE.HORIZONTAL_DOUBLE &&
      this.psMode !== POINT_SELECTION_MODE.VERTICAL_DOUBLE
    ) {
      const message = Logging.error(LOG_CONF.ERROR_NOT_SELECTED_TWO_POINTS);
      throw new Error(message);
    }

    // 2点選択できていない場合は終了
    if (!(this.psStPoint && this.psEdPoint)) {
      const message = Logging.error(LOG_CONF.ERROR_NOT_SELECTED_TWO_POINTS);
      throw new Error(message);
    }

    // 距離計測結果が表示済の場合は破棄
    this.hidePointDistance();

    Logging.info(LOG_CONF.INFO_DISP_DISTANCE);

    // 計測結果の算出
    const distance = this.psStPoint.distanceTo(this.psEdPoint);
    const hDistance = COPCUtil.getHorizontalDist(this.psStPoint, this.psEdPoint, this.yAxisUp);
    const vDistance = COPCUtil.getVerticalDist(this.psStPoint, this.psEdPoint, this.yAxisUp);

    // 表示位置に応じて選択位置を保持
    let up: THREE.Vector3 = new THREE.Vector3();
    let bottom: THREE.Vector3 = new THREE.Vector3();
    let middle: THREE.Vector3 = new THREE.Vector3();
    if (this.yAxisUp) {
      if (this.psStPoint.y < this.psEdPoint.y) {
        // 始点の方が下
        up = this.psEdPoint.clone();
        bottom = this.psStPoint.clone();
      } else {
        // 始点の方が上
        up = this.psStPoint.clone();
        bottom = this.psEdPoint.clone();
      }
      middle = new THREE.Vector3(up.x, bottom.y, up.z);
    } else {
      if (this.psStPoint.z < this.psEdPoint.z) {
        // 始点の方が下
        up = this.psEdPoint.clone();
        bottom = this.psStPoint.clone();
      } else {
        // 始点の方が上
        up = this.psStPoint.clone();
        bottom = this.psEdPoint.clone();
      }
      middle = new THREE.Vector3(up.x, up.y, bottom.z);
    }

    // 2点選択中の2点表示を終了
    this.clearPointSelection();

    // 表示位置算出
    const position = new THREE.Vector3().addVectors(up, bottom).divideScalar(2.0);
    const vPosition = new THREE.Vector3().addVectors(up, middle).divideScalar(2.0);
    const hPosition = new THREE.Vector3().addVectors(bottom, middle).divideScalar(2.0);

    // ベースサイズ算出(2点選択の中点座標を基準)
    // 基準座標の1mあたりのピクセル数を考慮
    const baseSize = 1 / this.camera.getPixelPerMeter(position);
    const stripeRepeat = new THREE.Vector2(1, vDistance / (baseSize * 5));

    // 縞模様円柱生成
    const mekePoleObject = (position: THREE.Vector3, quaternion: THREE.Quaternion, distance: number): THREE.Mesh => {
      const stripeTexture = this.getStripedTexture(
        new THREE.Color(COPCConf.conf.STRIPE_MEASURE_COLOR1),
        new THREE.Color(COPCConf.conf.STRIPE_MEASURE_COLOR2),
        stripeRepeat,
      );
      const stripePole = this.scene.addBasicMaterialObject(
        position,
        quaternion,
        new THREE.CylinderGeometry(baseSize, baseSize, distance, VERTICAL_MEASURE.POLE.RADIAL_SEGMENTS),
        new THREE.Color(VERTICAL_MEASURE.POLE.COLOR),
        VERTICAL_MEASURE.POLE.OPACITY,
        THREE.DoubleSide,
        stripeTexture,
      );
      return stripePole;
    };
    this.pointDistanceObject.push(mekePoleObject(position, this.makeQuaternion(up, bottom), distance));
    this.pointDistanceObject.push(mekePoleObject(vPosition, this.makeQuaternion(up, middle), vDistance));
    this.pointDistanceObject.push(mekePoleObject(hPosition, this.makeQuaternion(bottom, middle), hDistance));

    // 線端球表示
    const mekeSphereObject = (potision: THREE.Vector3): THREE.Mesh => {
      return this.scene.addBasicMaterialObject(
        potision,
        NO_ROTATE_QUATERNION,
        new THREE.SphereGeometry(
          baseSize * 3,
          VERTICAL_MEASURE.SPHERE.WIDTH_SEGMENTS,
          VERTICAL_MEASURE.SPHERE.HEIGHT_SEGMENTS,
        ),
        new THREE.Color(COPCConf.conf.STRIPE_MEASURE_SPHERE_COLOR),
        VERTICAL_MEASURE.SPHERE.OPACITY,
        THREE.DoubleSide,
      );
    };
    this.pointDistanceObject.push(mekeSphereObject(up));
    this.pointDistanceObject.push(mekeSphereObject(bottom));
    this.pointDistanceObject.push(mekeSphereObject(middle));

    // 引出線付き文字列オブジェクト生成
    const makeTextObject = (
      position: THREE.Vector3,
      distance: number,
      lineVLength: number,
      lineAngle: number,
    ): THREE.Sprite => {
      const scale = baseSize * 300;
      const showDistance = COPCUtil.getUnitValue(distance, COPCConf.conf.MEASURE_VALUE_DIGIT, 'm');
      const leadlineProp: LeadlineProp = {
        pointColor: new THREE.Color(VERTICAL_MEASURE.TEXT.POINT_COLOR),
        pointRadius: VERTICAL_MEASURE.TEXT.POINT_RADIUS,
        font: VERTICAL_MEASURE.TEXT.FONT,
        fontSize: VERTICAL_MEASURE.TEXT.FONT_SIZE,
        textColor: new THREE.Color(VERTICAL_MEASURE.TEXT.TEXT_COLOR),
        textPosition: VERTICAL_MEASURE.TEXT.POSITION,
        textMargin: VERTICAL_MEASURE.TEXT.MARGIN,
        text: showDistance,
        lineColor: new THREE.Color(VERTICAL_MEASURE.TEXT.LINE_COLOR),
        lineWidth: VERTICAL_MEASURE.TEXT.LINE_WIDTH,
        lineHLength: showDistance.length * VERTICAL_MEASURE.TEXT.LINE_LENGTH_OFFSET,
        lineVLength: lineVLength,
        lineAngle: lineAngle,
      };
      return this.scene.addLeadlineBillboardObject(position, leadlineProp, scale, true);
    };
    this.pointDistanceObject.push(
      makeTextObject(position, distance, VERTICAL_MEASURE.TEXT.LINE_V_LENGTH, VERTICAL_MEASURE.TEXT.LINE_ANGLE),
    );
    this.pointDistanceObject.push(
      makeTextObject(vPosition, vDistance, VERTICAL_MEASURE.TEXT.LINE_V_LENGTH, VERTICAL_MEASURE.TEXT.HV_LINE_ANGLE),
    );
    this.pointDistanceObject.push(
      makeTextObject(hPosition, hDistance, VERTICAL_MEASURE.TEXT.LINE_V_LENGTH, VERTICAL_MEASURE.TEXT.HV_LINE_ANGLE),
    );

    return [distance, hDistance, vDistance];
  }

  /**
   * 縞模様テクスチャを生成する
   * @param color1 縞模様の色1
   * @param color2 縞模様の色2
   * @param repeat 縞模様の繰り返し率
   * @returns テクスチャ
   */
  private getStripedTexture(
    color1: THREE.Color,
    color2: THREE.Color,
    repeat: THREE.Vector2,
  ): THREE.Texture | undefined {
    // 縞模様テクスチャの設定
    let stripeTexture = undefined;

    const width = 64;
    const height = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle =
        'rgba(' +
        Math.round(color1.r * 255) +
        ',' +
        Math.round(color1.g * 255) +
        ',' +
        Math.round(color1.b * 255) +
        ', 1.0)';
      ctx.fillRect(0, height / 2, width, height / 2);
      ctx.fill();
      ctx.fillStyle =
        'rgba(' +
        Math.round(color2.r * 255) +
        ',' +
        Math.round(color2.g * 255) +
        ',' +
        Math.round(color2.b * 255) +
        ', 1.0)';
      ctx.fillRect(0, 0, width, height / 2);
      ctx.fillRect(0, 0, width / 8, height / 2);
      ctx.fillRect(width - width / 8, 0, width / 8, height / 2);
      ctx.fill();
      stripeTexture = new THREE.Texture(canvas);
      stripeTexture.needsUpdate = true;

      stripeTexture.minFilter = THREE.LinearFilter;
      stripeTexture.magFilter = THREE.LinearFilter;
      stripeTexture.wrapS = stripeTexture.wrapT = THREE.RepeatWrapping;

      // 縞模様の繰り返し率を設定
      stripeTexture.repeat.set(repeat.x, repeat.y);
    }
    return stripeTexture;
  }

  /**
   * 指定した2点の傾きをもつクォータニオンを生成する
   * @param point1 1点目の座標
   * @param point2 2点目の座標
   * @returns クォータニオン
   */
  private makeQuaternion(point1: THREE.Vector3, point2: THREE.Vector3): THREE.Quaternion {
    // オブジェクトの回転
    const up = new THREE.Vector3(0, 1, 0);
    // ベクトル作成
    const normalAxis = new THREE.Vector3().subVectors(point2, point1).normalize();
    // 「上」方向とポリライン両方と直行するベクトル計算、正規化。
    const dir = new THREE.Vector3().crossVectors(up, normalAxis).normalize();
    // 上記ベクトルとの内積（cosθ）
    const dot = up.dot(normalAxis);
    // acos関数を使ってラジアンに変換。
    const rad = Math.acos(dot);
    // dirは回転軸（3次元ベクトル）。radは回転軸から回転する角度を指す。
    return new THREE.Quaternion().setFromAxisAngle(dir, rad);
  }

  /**
   * 距離計測表示を終了する。生成済のオブジェクトを削除する。
   */
  public hidePointDistance(): void {
    if (this.pointDistanceObject.length === 0) {
      return;
    }

    for (const obj of this.pointDistanceObject) {
      if (obj instanceof THREE.Mesh) {
        this.scene.removeMeshObject(obj);
      } else if (obj instanceof THREE.Line) {
        this.scene.removeLineObject(obj);
      } else if (obj instanceof THREE.Sprite) {
        this.scene.removeSpriteObject(obj);
      }
    }
    this.pointDistanceObject = [];
    Logging.info(LOG_CONF.INFO_HIDE_DISTANCE);
  }

  /******************************************************************/
  // 鉛直距離計測
  /******************************************************************/
  /**
   *  鉛直距離計測を有効化する。点群データ計測のモードを鉛直距離計測に設定する。
   */
  public setVerticalMeasureEnabled(): void {
    // 鉛直距離計測中以外の場合は生成済のオブジェクトを破棄
    this.verticalMeasureEnable = true;
    if (this.measureMode !== MEASURE_MODE.VERTICAL_MEASURE) {
      Logging.info(LOG_CONF.INFO_ENABLE_MEASURE_VERTICAL_DISTANCE);
      this.clearPointSelection();
      this.stopRangeSelection();
      this.measureMode = MEASURE_MODE.VERTICAL_MEASURE;
    }
  }

  /**
   *  鉛直距離計測を無効化する。生成済のオブジェクトを削除し、点群データ計測のモードを点選択に設定する。
   */
  public setVerticalMeasureDisabled(): void {
    // 鉛直距離計測中の場合は終了、その他の場合は何もしない
    this.verticalMeasureEnable = false;
    if (this.measureMode === MEASURE_MODE.VERTICAL_MEASURE) {
      Logging.info(LOG_CONF.INFO_DISABLE_MEASURE_VERTICAL_DISTANCE);
      this.clearPointSelection();
      this.measureMode = MEASURE_MODE.POINT_SELECTION;
    }
  }

  /**
   * 鉛直距離計測の計測結果設定用のコールバックを設定する。
   */
  public setVerticalMeasureCallback(callback: (value: number) => void): void {
    Logging.debug(LOG_CONF.DEBUG_SET_VERTICAL_DISTANCE_CALLBACK);
    this.pointDistanceCallback = callback;
  }

  /**
   * ワールド座標の鉛直方向上で正規化デバイス座標に対応するワールド座標を取得する。
   * @param world ワールド座標
   * @param screen 正規化デバイス座標
   * @returns 鉛直方向3D座標
   */
  private getVerticalPositionAtMouse(world: THREE.Vector3, screen: THREE.Vector2): THREE.Vector3 {
    // x平面とRayの交点を算出
    const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -world.x);

    // 平面と指定座標の交点算出
    const intersection = this.camera.getIntersectPlane(screen, plane);

    if (this.yAxisUp) {
      return new THREE.Vector3(world.x, intersection.y, world.z);
    } else {
      return new THREE.Vector3(world.x, world.y, intersection.z);
    }
  }

  /******************************************************************/
  // 水平角度計測
  /******************************************************************/

  /**
   * 2点選択状態の場合に1点目を含む3D空間のXZ平面と、2点を結ぶ線分がなす角度（水平角度）を取得する。
   * @returns 水平角度(単位：ラジアン)
   * @throws 2点が選択されていない
   */
  public getHorizontalAngle(): number {
    let rad = 0;

    // 点選択処理以外の場合は終了
    if (this.measureMode !== MEASURE_MODE.POINT_SELECTION) {
      const message = Logging.error(LOG_CONF.ERROR_NOT_SELECTED_TWO_POINTS);
      throw new Error(message);
    }

    // 2点選択できていない場合は終了
    if (!(this.psStPoint && this.psEdPoint)) {
      const message = Logging.error(LOG_CONF.ERROR_NOT_SELECTED_TWO_POINTS);
      throw new Error(message);
    }

    // 座標取得
    const start = this.psStPoint;
    const end = this.psEdPoint;

    // 求める角度をなすベクトルを生成
    const vec1 = new THREE.Vector3().subVectors(end, start);
    const vec2 = new THREE.Vector3(end.x - start.x, 0, end.z - start.z);

    // 標準化
    const nVec1 = vec1.clone().normalize();
    const nVec2 = vec2.clone().normalize();

    // 角度算出
    rad = nVec1.angleTo(nVec2);

    // endの方がy軸成分が小さければ角度は負の値
    if (start.y > end.y) {
      rad *= -1;
    }

    return rad;
  }

  /***************************************************************** */
  // 範囲選択
  /***************************************************************** */

  /**
   * 範囲選択処理の指定したオブジェクト種別に応じてオブジェクトを生成する。
   * @param rsType オブジェクト種別(0: 直方体、1: 円柱、2: 球)
   * @throws 設定可能なオブジェクト種別以外の数値を設定
   */
  public startRangeSelection(rsType: number): void {
    if (!(RANGE_SELECT_TYPE.BOX <= rsType && rsType <= RANGE_SELECT_TYPE.SPHERE)) {
      const message = Logging.error(LOG_CONF.ERROR_RANGE_SELECT_TYPE, rsType.toString());
      throw new Error(message);
    }

    // オブジェクト表示済で選択方式が変化しない場合は終了
    if (this.rsType === rsType) {
      return;
    }

    Logging.info(LOG_CONF.INFO_START_AREA_SELECT_MODE, rsType.toString());

    // 点選択処理が実行中の場合は終了
    this.clearPointSelection();

    // 範囲選択オブジェクト表示済の場合は破棄してから再生成
    if (this.rsObject) {
      this.stopRangeSelection();
    }

    // 範囲選択モードに設定
    this.measureMode = MEASURE_MODE.RANGE_SELECTION;

    // 設定に応じてオブジェクト生成
    const position: THREE.Vector3 = this.controls.getFocus();
    switch (rsType) {
      case RANGE_SELECT_TYPE.BOX:
        this.rsObject = this.scene.addWireframeMeshObject(
          position,
          NO_ROTATE_QUATERNION,
          new THREE.BoxGeometry(RANGE_SELECT.BOX.WIDTH, RANGE_SELECT.BOX.HEIGHT, RANGE_SELECT.BOX.DEPTH),
          new THREE.Color(COPCConf.conf.SELECT_RANGE_WIREFRAME_COLOR),
          RANGE_SELECT.OPACITY,
          RANGE_SELECT.LINE_THICKNESS,
        );
        break;
      case RANGE_SELECT_TYPE.CYLINDER:
        this.rsObject = this.scene.addWireframeMeshObject(
          position,
          NO_ROTATE_QUATERNION,
          new THREE.CylinderGeometry(
            RANGE_SELECT.CYLINDER.TOP_RADIUS,
            RANGE_SELECT.CYLINDER.BOTTOM_RADIUS,
            RANGE_SELECT.CYLINDER.HEIGHT,
            RANGE_SELECT.CYLINDER.RADIAL_SEGMENTS,
            RANGE_SELECT.CYLINDER.HEIGHT_SEGMENTS,
            false,
            COPCUtil.normalizeRadian(this.rsThetaStart),
            COPCUtil.normalizeRadian(this.rsThetaLength),
          ),
          new THREE.Color(COPCConf.conf.SELECT_RANGE_WIREFRAME_COLOR),
          RANGE_SELECT.OPACITY,
          RANGE_SELECT.LINE_THICKNESS,
        );
        break;
      case RANGE_SELECT_TYPE.SPHERE:
        this.rsObject = this.scene.addWireframeMeshObject(
          position,
          NO_ROTATE_QUATERNION,
          new THREE.SphereGeometry(
            RANGE_SELECT.SPHERE.RADIUS,
            RANGE_SELECT.SPHERE.WIDTH_SEGMENTS,
            RANGE_SELECT.SPHERE.HEIGHT_SEGMENTS,
          ),
          new THREE.Color(COPCConf.conf.SELECT_RANGE_WIREFRAME_COLOR),
          RANGE_SELECT.OPACITY,
          RANGE_SELECT.LINE_THICKNESS,
        );
        break;
      default:
        // 呼び出し時の種別判定で妥当性チェック済のため到達しない
        break;
    }

    // オブジェクト生成完了
    if (this.rsObject) {
      // 対象オブジェクト種別設定
      this.rsType = rsType;
      this.pointDef.setRangeSelectionType(this.rsType);

      // 表示位置設定
      this.rsObject.position.set(position.x, position.y, position.z);

      // 回転行列生成
      this.rsRotateMatrix = new THREE.Matrix4();

      // 見た目の更新
      this.updateRangeSelectionView();

      // オブジェクトをドラッグ対象に設定
      this.objectControls.attach(this.rsObject);
    }
  }

  /**
   * 範囲選択処理のオブジェクトを削除し、点群データ計測のモードを点選択に設定する。
   */
  public stopRangeSelection(): void {
    if (this.measureMode !== MEASURE_MODE.RANGE_SELECTION) {
      return;
    }

    Logging.info(LOG_CONF.INFO_END_AREA_SELECT_MODE, this.rsType.toString());
    this.rsType = RANGE_SELECT_TYPE.NONE;
    this.measureMode = MEASURE_MODE.POINT_SELECTION;
    if (this.verticalMeasureEnable) {
      this.measureMode = MEASURE_MODE.VERTICAL_MEASURE;
    }

    // 各点群の設定値更新
    this.pointDef.setRangeSelectionType(this.rsType);

    if (this.rsObject) {
      // ドラッグ対象から削除
      this.objectControls.detach();

      this.scene.removeMeshObject(this.rsObject);
      this.rsObject = undefined;
    }
  }

  /**
   * 範囲選択処理のオブジェクトの操作モードを設定する。
   * @param mode オブジェクト操作のモード(0:移動、1:回転、2:拡縮)
   * @throws 設定可能方式以外の数値を設定
   */
  public setObjectControlMode(mode: number) {
    switch (mode) {
      case OBJECT_CONTROL_MODE.TRANSLATE: {
        this.objectControls.mode = 'translate';
        break;
      }
      case OBJECT_CONTROL_MODE.ROTATE: {
        this.objectControls.mode = 'rotate';
        break;
      }
      case OBJECT_CONTROL_MODE.SCALE: {
        this.objectControls.mode = 'scale';
        break;
      }
      default: {
        const message = Logging.error(LOG_CONF.ERROR_OBJECT_CONTROL_MODE, mode.toString());
        throw new Error(message);
      }
    }
  }

  /**
   * 範囲選択処理のオブジェクトのサイズ設定用のコールバックを設定する。
   * @param callback オブジェクトサイズ設定用コールバック
   */
  public setRangeSelectObjectSizeCallback(
    callback: (
      xSize: number,
      ySize: number,
      zSize: number,
      radius: number,
      thetaLength: number,
      thetaStart: number,
    ) => void,
  ): void {
    Logging.debug(LOG_CONF.DEBUG_SET_OBJ_SIZE_CALLBACK);
    this.objectSizeCallback = callback;
  }

  /**
   * 範囲選択処理のオブジェクトの回転状態設定用のコールバックを設定する。
   * @param callback オブジェクト回転状態設定用コールバック
   */
  public setRangeSelectObjectRotateCallback(callback: (x: number, y: number, z: number) => void) {
    Logging.debug(LOG_CONF.DEBUG_SET_OBJ_ROTATION_CALLBACK);
    this.objectRotateCallback = callback;
  }

  /**
   * 範囲選択計算用の行列の生成をする。
   * @param position オブジェクトの表示位置
   * @param size オブジェクトの表示サイズ
   * @param rotate オブジェクトの回転状態
   * @returns オブジェクト移動行列の逆行列
   */
  private makeTranslationMatrix(position: THREE.Vector3, size: THREE.Vector3, rotate: THREE.Vector3): THREE.Matrix4 {
    // 平行移動行列反映
    const translationMatrix = new THREE.Matrix4();
    // prettier-ignore
    translationMatrix.set(
      1.0, 0.0, 0.0, position.x,
      0.0, 1.0, 0.0, position.y,
      0.0, 0.0, 1.0, position.z,
      0.0, 0.0, 0.0, 1.0,
    )

    // 回転行列反映
    const tmpRotateMatrix = new THREE.Matrix4();
    tmpRotateMatrix.makeRotationFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(rotate.x),
        THREE.MathUtils.degToRad(rotate.y),
        THREE.MathUtils.degToRad(rotate.z),
        'XYZ',
      ),
    );
    translationMatrix.multiply(tmpRotateMatrix);

    // Cylinderの場合はthetaStartの値も反映する
    if (RANGE_SELECT_TYPE.CYLINDER === this.rsType) {
      const thetaStart = COPCUtil.normalizeRadian(this.rsThetaStart);
      tmpRotateMatrix.makeRotationFromEuler(new THREE.Euler(0, thetaStart, 0, 'XYZ'));
      translationMatrix.multiply(tmpRotateMatrix);
    }

    // 拡大縮小行列反映
    const scaleMat = new THREE.Matrix4().makeScale(size.x, size.y, size.z);
    translationMatrix.multiply(scaleMat);

    // 逆行列を生成
    const invert = translationMatrix.clone().invert();

    return invert;
  }

  /**
   * 指定したパラメータで範囲選択オブジェクトの描画を更新する。
   * @param position オブジェクトの表示位置
   * @param size オブジェクトの表示サイズ
   * @param rotate オブジェクトの回転状態
   */
  private updateRangeSelectionObject(position: THREE.Vector3, size: THREE.Vector3, rotate: THREE.Vector3): void {
    if (this.rsObject) {
      // スケール設定
      this.rsObject.scale.set(size.x, size.y, size.z);

      // オブジェクトを原点に移動する行列を適用
      let mat = new THREE.Matrix4().makeTranslation(-position.x, -position.y, -position.z);
      this.rsObject.applyMatrix4(mat);

      // オブジェクトの回転をもとに戻す行列を適用
      mat = this.rsRotateMatrix.clone().invert();
      this.rsObject.applyMatrix4(mat);

      // 原点正対のオブジェクトに対して回転
      this.rsRotateMatrix.makeRotationFromEuler(
        new THREE.Euler(
          THREE.MathUtils.degToRad(rotate.x),
          THREE.MathUtils.degToRad(rotate.y),
          THREE.MathUtils.degToRad(rotate.z),
          'XYZ',
        ),
      );
      this.rsObject.applyMatrix4(this.rsRotateMatrix);

      // オブジェクトを元の位置に戻す
      mat = new THREE.Matrix4().makeTranslation(position.x, position.y, position.z);
      this.rsObject.applyMatrix4(mat);
    }
  }

  /**
   * 範囲選択処理の更新をする。
   */
  public updateRangeSelectionView(): void {
    if (this.rsObject) {
      Logging.trace(LOG_CONF.TRACE_UPDATE_OBJECT_STATE);
      // オブジェクト種別に応じたパラメータ設定
      const position = this.rsObject.position.clone();
      const size = new THREE.Vector3();
      switch (this.rsType) {
        case RANGE_SELECT_TYPE.BOX:
          size.x = this.rsSize.x;
          size.y = this.rsSize.y;
          size.z = this.rsSize.z;
          break;
        case RANGE_SELECT_TYPE.CYLINDER:
          size.x = this.rsRadius;
          size.y = this.rsSize.y;
          size.z = this.rsRadius;
          break;
        case RANGE_SELECT_TYPE.SPHERE:
          size.x = this.rsRadius;
          size.y = this.rsRadius;
          size.z = this.rsRadius;
          break;
        default:
          // RANGE_SELECT_TYPE.NONEの場合は何もしない
          break;
      }

      // 範囲選択オブジェクトの描画更新
      this.updateRangeSelectionObject(position, size, this.rsRotate);

      // オブジェクト移動行列生成
      const matrix = this.makeTranslationMatrix(position, size, this.rsRotate);

      // シェーダ処理用にパラメータ更新
      this.pointDef.setRangeSelectionThetaLength(this.rsThetaLength);
      this.pointDef.setRangeSelectionMatrix(matrix);
    }
  }

  /**
   * オブジェクトの回転状態をもとに範囲選択処理の回転角度を更新する。
   * @param object オブジェクト
   */
  public updateRangeSelectionParameter(object: THREE.Object3D): void {
    this.rsRotate.x = THREE.MathUtils.radToDeg(object.rotation.x);
    this.rsRotate.y = THREE.MathUtils.radToDeg(object.rotation.y);
    this.rsRotate.z = THREE.MathUtils.radToDeg(object.rotation.z);
    this.rsRotateMatrix.makeRotationFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(this.rsRotate.x),
        THREE.MathUtils.degToRad(this.rsRotate.y),
        THREE.MathUtils.degToRad(this.rsRotate.z),
        'XYZ',
      ),
    );

    Logging.trace(
      LOG_CONF.TRACE_SET_OBJECT_ROTATION,
      THREE.MathUtils.degToRad(this.rsRotate.x).toString(),
      THREE.MathUtils.degToRad(this.rsRotate.y).toString(),
      THREE.MathUtils.degToRad(this.rsRotate.z).toString(),
    );

    switch (this.rsType) {
      case RANGE_SELECT_TYPE.BOX: {
        this.rsSize.x = Math.abs(object.scale.x);
        this.rsSize.y = Math.abs(object.scale.y);
        this.rsSize.z = Math.abs(object.scale.z);
        break;
      }
      case RANGE_SELECT_TYPE.CYLINDER: {
        const tmp: number = this.rsRadius;
        if (tmp !== object.scale.x) {
          this.rsRadius = Math.abs(object.scale.x);
        }
        if (tmp !== object.scale.z) {
          this.rsRadius = Math.abs(object.scale.z);
        }
        this.rsSize.y = object.scale.y;
        break;
      }
      case RANGE_SELECT_TYPE.SPHERE: {
        const tmp: number = this.rsRadius;
        if (tmp !== object.scale.x) {
          this.rsRadius = Math.abs(object.scale.x);
        }
        if (tmp !== object.scale.y) {
          this.rsRadius = Math.abs(object.scale.y);
        }
        if (tmp !== object.scale.z) {
          this.rsRadius = Math.abs(object.scale.z);
        }
        break;
      }
      default:
        // RANGE_SELECT_TYPE.NONEの場合は何もしない
        break;
    }

    // 画面の見た目を更新
    this.updateRangeSelectionView();

    // コールバックに設定値を反映
    if (this.objectSizeCallback) {
      this.objectSizeCallback(
        this.rsSize.x,
        this.rsSize.y,
        this.rsSize.z,
        this.rsRadius,
        this.rsThetaLength,
        this.rsThetaStart,
      );
    }
    if (this.objectRotateCallback) {
      this.objectRotateCallback(this.rsRotate.x, this.rsRotate.y, this.rsRotate.z);
    }
  }

  /**
   * 範囲選択処理のオブジェクトのX軸回転角度を設定する。
   * @param xRotate オブジェクトのX軸回転角度(-180度～180度)
   * @throws パラメータの範囲外の数値を設定
   */
  public setRangeSelectionXRotate(xRotate: number): void {
    if (xRotate < -180 || 180 < xRotate) {
      const message = Logging.error(LOG_CONF.ERROR_RANGE_SELECT_PARAMETER, 'xRotate', xRotate.toString());
      throw new Error(message);
    }
    this.rsRotate.x = xRotate;
  }

  /**
   * 範囲選択処理のオブジェクトのX軸回転角度を取得する。
   * @returns オブジェクトのX軸回転角度
   */
  public getRangeSelectionXRotate(): number {
    return this.rsRotate.x;
  }

  /**
   * 範囲選択処理のオブジェクトのY軸回転角度を設定する。
   * @param yRotate オブジェクトのY軸回転角度(-180度～180度)
   * @throws パラメータの範囲外の数値を設定
   */
  public setRangeSelectionYRotate(yRotate: number): void {
    if (yRotate < -180 || 180 < yRotate) {
      const message = Logging.error(LOG_CONF.ERROR_RANGE_SELECT_PARAMETER, 'yRotate', yRotate.toString());
      throw new Error(message);
    }
    this.rsRotate.y = yRotate;
  }

  /**
   * 範囲選択処理のオブジェクトのY軸回転角度を取得する。
   * @returns オブジェクトのY軸回転角度
   */
  public getRangeSelectionYRotate(): number {
    return this.rsRotate.y;
  }

  /**
   * 範囲選択処理のオブジェクトのZ軸回転角度を設定する。
   * @param zRotate オブジェクトのZ軸回転角度(-180度～180度)
   * @throws パラメータの範囲外の数値を設定
   */
  public setRangeSelectionZRotate(zRotate: number): void {
    if (zRotate < -180 || 180 < zRotate) {
      const message = Logging.error(LOG_CONF.ERROR_RANGE_SELECT_PARAMETER, 'zRotate', zRotate.toString());
      throw new Error(message);
    }
    this.rsRotate.z = zRotate;
  }

  /**
   * 範囲選択処理のオブジェクトのZ軸回転角度を取得する。
   * @returns オブジェクトのZ軸回転角度
   */
  public getRangeSelectionZRotate(): number {
    return this.rsRotate.z;
  }

  /**
   * 範囲選択処理のオブジェクトのX軸方向サイズを設定する。
   * @param xSize オブジェクトのX軸方向サイズ(0より大きい値)
   * @throws パラメータの範囲外の数値を設定
   */
  public setRangeSelectionXSize(xSize: number): void {
    if (xSize <= 0) {
      const message = Logging.error(LOG_CONF.ERROR_RANGE_SELECT_PARAMETER, 'x-size', xSize.toString());
      throw new Error(message);
    }
    this.rsSize.x = xSize;
  }

  /**
   * 範囲選択処理のオブジェクトのX軸方向サイズを取得する。
   * @returns オブジェクトのX軸方向サイズ
   */
  public getRangeSelectionXSize(): number {
    return this.rsSize.x;
  }

  /**
   * 範囲選択処理のオブジェクトのY軸方向サイズを設定する。
   * @param ySize オブジェクトのY軸方向サイズ(0より大きい値)
   * @throws パラメータの範囲外の数値を設定
   */
  public setRangeSelectionYSize(ySize: number): void {
    if (ySize <= 0) {
      const message = Logging.error(LOG_CONF.ERROR_RANGE_SELECT_PARAMETER, 'y-size', ySize.toString());
      throw new Error(message);
    }
    this.rsSize.y = ySize;
  }

  /**
   * 範囲選択処理のオブジェクトのY軸方向サイズを取得する。
   * @returns オブジェクトのY軸方向サイズ
   */
  public getRangeSelectionYSize(): number {
    return this.rsSize.y;
  }

  /**
   * 範囲選択処理のオブジェクトのZ軸方向サイズを設定する。
   * @param zSize オブジェクトのZ軸方向サイズ(0より大きい値)
   * @throws パラメータの範囲外の数値を設定
   */
  public setRangeSelectionZSize(zSize: number) {
    if (zSize <= 0) {
      const message = Logging.error(LOG_CONF.ERROR_RANGE_SELECT_PARAMETER, 'z-size', zSize.toString());
      throw new Error(message);
    }
    this.rsSize.z = zSize;
  }

  /**
   * 範囲選択処理のオブジェクトのZ軸方向サイズを取得する。
   * @returns オブジェクトのZ軸方向サイズ
   */
  public getRangeSelectionZSize(): number {
    return this.rsSize.z;
  }

  /**
   * 範囲選択処理のオブジェクトの半径を設定する。
   * @param radius オブジェクトの半径(0より大きい値)
   * @throws パラメータの範囲外の数値を設定
   */
  public setRangeSelectionRadius(radius: number): void {
    if (radius <= 0) {
      const message = Logging.error(LOG_CONF.ERROR_RANGE_SELECT_PARAMETER, 'radius', radius.toString());
      throw new Error(message);
    }
    this.rsRadius = radius;
  }

  /**
   * 範囲選択処理のオブジェクトの半径を取得する。
   * @returns オブジェクトの半径
   */
  public getRangeSelectionRadius(): number {
    return this.rsRadius;
  }

  /**
   * 範囲選択処理のオブジェクトの円周の角度を設定する。
   * @param thetaLength オブジェクトの円周の角度(0以上)
   * @throws パラメータの範囲外の数値を設定
   */
  public setRangeSelectionThetaLength(thetaLength: number): void {
    if (thetaLength < 0) {
      const message = Logging.error(LOG_CONF.ERROR_RANGE_SELECT_PARAMETER, 'thetaLength', thetaLength.toString());
      throw new Error(message);
    }
    this.rsThetaLength = thetaLength;
    if (this.rsType === RANGE_SELECT_TYPE.CYLINDER && this.rsObject) {
      COPCUtil.updateCylinderGeometry(this.rsObject, this.rsThetaStart, this.rsThetaLength);
    }
  }

  /**
   * 範囲選択処理のオブジェクトの円周の角度を取得する。
   * @returns オブジェクトの円周の角度
   */
  public getRangeSelectionThetaLength(): number {
    return this.rsThetaLength;
  }

  /**
   * 範囲選択処理のオブジェクトの円周の開始位置を設定する。
   * @param thetaStart オブジェクトの円周の開始位置(0以上)
   * @throws パラメータの範囲外の数値を設定
   */
  public setRangeSelectionThetaStart(thetaStart: number): void {
    if (thetaStart < 0) {
      const message = Logging.error(LOG_CONF.ERROR_RANGE_SELECT_PARAMETER, 'thetaStart', thetaStart.toString());
      throw new Error(message);
    }
    this.rsThetaStart = thetaStart;
    if (this.rsType === RANGE_SELECT_TYPE.CYLINDER && this.rsObject) {
      COPCUtil.updateCylinderGeometry(this.rsObject, this.rsThetaStart, this.rsThetaLength);
    }
  }

  /**
   * 範囲選択処理のオブジェクトの円周の開始位置を取得する。
   * @returns オブジェクトの円周の開始位置
   */
  public getRangeSelectionThetaStart(): number {
    return this.rsThetaStart;
  }

  /***************************************************************** */
  // 点座標取得
  /***************************************************************** */

  /**
   * 選択中の点の座標を取得する。選択中の点が最大点数を超過した場合は最大点数分取得する。
   * @param coords 選択状態の点の座標
   * @returns 点選択の最大点数超過有無(true: 最大点数超過、false: 最大点数以下)
   */
  public getSelectedPointCoords(coords: THREE.Vector3[]): boolean {
    coords.length = 0;

    let isOver = false;
    switch (this.measureMode) {
      case MEASURE_MODE.POINT_SELECTION: {
        // 点選択処理の場合
        Logging.info(LOG_CONF.INFO_GET_COORDS_POINT_SELECT);
        isOver = this.getPointSelectedPointCoords(coords);
        break;
      }
      case MEASURE_MODE.RANGE_SELECTION: {
        // 範囲選択処理の場合
        Logging.info(LOG_CONF.INFO_GET_COORDS_RANGE_SELECT);
        isOver = this.getRangeSelectedPointCoords(coords);
        break;
      }
      default:
        // 選択中でなければ何もしない
        break;
    }

    if (isOver) {
      Logging.info(LOG_CONF.INFO_OVER_LIMIT);
    }

    return isOver;
  }

  /**
   * ノードのキーの数値でノード一覧を昇順にソートする
   * @param nodeInfoList ソート対象のノードリスト
   */
  private sortNodeInfoByKey(nodeInfoList: NodeInfo[]) {
    nodeInfoList.sort((a: NodeInfo, b: NodeInfo) => {
      const [aD, aX, aY, aZ] = a.getKey().split('-').map(Number);
      const [bD, bX, bY, bZ] = b.getKey().split('-').map(Number);

      if (aD !== bD) return aD - bD;
      if (aX !== bX) return aX - bX;
      if (aY !== bY) return aY - bY;
      return aZ - bZ;
    });
  }

  /**
   * 点選択処理の矩形選択中の点の座標を取得する。選択中の点が最大点数を超過した場合は最大点数分取得する。
   * @param coords 選択状態の点の座標
   * @returns 点選択の最大点数超過有無(true: 最大点数超過、false: 最大点数以下)
   */
  private getPointCoordsInBox(coords: THREE.Vector3[]): boolean {
    // 矩形選択の内外判定処理
    function checkInOut(position: THREE.Vector4): boolean {
      let inside: boolean = -0.5 <= position.x && position.x <= 0.5;
      inside = inside && -0.5 <= position.y && position.y <= 0.5;
      inside = inside && -0.5 <= position.z && position.z <= 0.5;

      return inside;
    }

    // 点選択の最大点数超過有無
    let isOver: boolean = false;

    if (this.psStPoint && this.psEdPoint) {
      // 選択計算用行列
      const position = this.psStPoint.clone().add(this.psEdPoint).divideScalar(2.0);
      const size = new THREE.Vector3().subVectors(this.psEdPoint, this.psStPoint);
      const rotate = new THREE.Vector3(0, 0, 0);
      const matrix = this.makeTranslationMatrix(position, size, rotate);

      // 矩形の最小最大位置(矩形と重なるノードを処理の対象とする)
      const boxMin = this.psStPoint.clone().min(this.psEdPoint);
      const boxMax = this.psStPoint.clone().max(this.psEdPoint);

      // 矩形内部に存在するノードの一覧を取得
      const nodeInfoList: NodeInfo[] = [];
      for (const pointSet of this.pointSetMap.values()) {
        // 非表示状態の点群は非対象
        if (!pointSet.getVisibleStatus()) {
          continue;
        }

        const insideNode: NodeInfo[] = [];
        const rootNode = pointSet.getRootNode();
        if (rootNode) {
          rootNode.getNodesInShape(boxMin, boxMax, insideNode);
        }
        nodeInfoList.push(...insideNode);
      }

      // 対象ノードをソート
      this.sortNodeInfoByKey(nodeInfoList);

      // 選択中のノードにおける内外判定による座標取得
      for (const nodeInfo of nodeInfoList) {
        const tmp: THREE.Vector3[] = nodeInfo.getPointCoordInShape(matrix, checkInOut);
        if (COPCConf.conf.SELECT_MAX_POINT < coords.length + tmp.length) {
          isOver = true;
          break;
        }
        coords.push(...tmp);
      }
    }

    return isOver;
  }

  /**
   * 点選択処理の選択中の点の座標を取得する。選択中の点が最大点数を超過した場合は最大点数分取得する。
   * @param coords 選択状態の点の座標
   * @returns 点選択の最大点数超過有無(true: 最大点数超過、false: 最大点数以下)
   */
  private getPointSelectedPointCoords(coords: THREE.Vector3[]): boolean {
    let isOver = false;
    switch (this.psMode) {
      case POINT_SELECTION_MODE.BOX:
        // 矩形選択
        isOver = this.getPointCoordsInBox(coords);
        break;
      case POINT_SELECTION_MODE.DOUBLE:
      case POINT_SELECTION_MODE.HORIZONTAL_DOUBLE:
      case POINT_SELECTION_MODE.VERTICAL_DOUBLE:
        // 2点選択関連
        if (this.psStPoint) {
          coords.push(this.psStPoint);
        }
        if (this.psEdPoint) {
          coords.push(this.psEdPoint);
        }
        break;
      case POINT_SELECTION_MODE.SINGLE:
        // 1点選択
        if (this.psStPoint) {
          coords.push(this.psStPoint);
        }
        break;
      default:
        // POINT_SELECTION_MODE_TYPE.NONEの場合は何もしない
        break;
    }

    return isOver;
  }

  /**
   * 範囲選択処理のオブジェクトのパラメータ情報を取得する。
   * @returns オブジェクトのパラメータ情報
   */
  private getRangeSelectionParameter(): SelectionParameter | undefined {
    const size = new THREE.Vector3();
    let position = new THREE.Vector3();
    let matrix = new THREE.Matrix4();
    let checkInOut = undefined;

    if (this.rsObject) {
      position = this.rsObject.position.clone();

      switch (this.rsType) {
        case RANGE_SELECT_TYPE.BOX: {
          // BOX選択の内外判定処理
          checkInOut = function checkInOutInBox(position: THREE.Vector4): boolean {
            let inside: boolean = -0.5 <= position.x && position.x <= 0.5;
            inside = inside && -0.5 <= position.y && position.y <= 0.5;
            inside = inside && -0.5 <= position.z && position.z <= 0.5;

            return inside;
          };
          size.set(this.rsSize.x, this.rsSize.y, this.rsSize.z);
          break;
        }
        case RANGE_SELECT_TYPE.CYLINDER: {
          // CYLINDER選択の内外判定処理
          const thetaLength = this.rsThetaLength;
          checkInOut = function checkInOutInCylinder(position: THREE.Vector4): boolean {
            // 高さ
            let inside: boolean = -0.5 <= position.y && position.y <= 0.5;
            // 半径
            let distance = Math.pow(position.x, 2.0) + Math.pow(position.z, 2.0);
            distance = Math.sqrt(distance);
            inside = inside && distance <= 1.0;

            // 扇形
            let angle = Math.atan2(position.x, position.z);
            angle = COPCUtil.fmod(angle, Math.PI * 2.0);
            inside = inside && angle <= thetaLength;
            return inside;
          };
          size.set(this.rsRadius, this.rsSize.y, this.rsRadius);
          break;
        }
        case RANGE_SELECT_TYPE.SPHERE: {
          // SPHERE選択の内外判定処理
          checkInOut = function checkInOutInSphere(position: THREE.Vector4): boolean {
            let distance = Math.pow(position.x, 2.0) + Math.pow(position.y, 2.0) + Math.pow(position.z, 2.0);
            distance = Math.sqrt(distance);
            const inside: boolean = distance <= 1.0;

            return inside;
          };
          size.set(this.rsRadius, this.rsRadius, this.rsRadius);
          break;
        }
        default:
          // RANGE_SELECT_TYPE.NONEの場合は何もしない
          break;
      }
    }

    if (checkInOut) {
      matrix = this.makeTranslationMatrix(position, size, this.rsRotate);
      const parameter: SelectionParameter = {
        position: position,
        size: size,
        matrix: matrix,
        checkInOut: checkInOut,
      };
      return parameter;
    } else {
      return undefined;
    }
  }

  /**
   * 範囲選択処理の選択中の点の座標を取得する。選択中の点が最大点数を超過した場合は最大点数分取得する。
   * @param coords 選択状態の点の座標
   * @returns 点選択の最大点数超過有無(true: 最大点数超過、false: 最大点数以下)
   */

  private getRangeSelectedPointCoords(coords: THREE.Vector3[]): boolean {
    // 範囲選択処理のオブジェクトのパラメータ情報を取得
    const parameter: SelectionParameter | undefined = this.getRangeSelectionParameter();

    // 点選択の最大点数超過有無
    let isOver: boolean = false;

    if (parameter) {
      const position = parameter.position;
      const size = parameter.size;
      // 矩形の最小最大位置(矩形と重なるノードを処理の対象とする)
      const boxMin = new THREE.Vector3(position.x - size.x / 2, position.y - size.y / 2, position.z - size.z / 2);
      const boxMax = new THREE.Vector3(position.x + size.x / 2, position.y + size.y / 2, position.z + size.z / 2);

      // 矩形内部に存在するノードの一覧を取得
      const nodeInfoList: NodeInfo[] = [];
      for (const pointSet of this.pointSetMap.values()) {
        // 非表示状態の点群は非対象
        if (!pointSet.getVisibleStatus()) {
          continue;
        }

        const insideNode: NodeInfo[] = [];
        const rootNode = pointSet.getRootNode();
        if (rootNode) {
          rootNode.getNodesInShape(boxMin, boxMax, insideNode);
        }
        nodeInfoList.push(...insideNode);
      }

      // 対象ノードをソート
      this.sortNodeInfoByKey(nodeInfoList);

      // 範囲選択中のノードにおける内外判定による座標取得
      for (const nodeInfo of nodeInfoList) {
        const tmp: THREE.Vector3[] = nodeInfo.getPointCoordInShape(parameter.matrix, parameter.checkInOut);
        if (COPCConf.conf.SELECT_MAX_POINT < coords.length + tmp.length) {
          isOver = true;
          break;
        }
        coords.push(...tmp);
      }
    } else {
      Logging.error(LOG_CONF.ERROR_RANGE_SELECT_PARAM_INFO);
    }

    return isOver;
  }

  /***************************************************************** */
  // LASファイルダウンロード
  /***************************************************************** */

  /**
   * LASファイルのダウンロード処理実行中か否か取得する
   * @returns LASファイルのダウンロード実行状態(true：実行中、false：非実行中)
   */
  public isLasDownloading(): boolean {
    if (0 < this.lasDownloaders.size) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * 点群データをLAS形式のファイルでダウンロードする
   * @param callback ダウンロード処理状態を設定するコールバック
   * @param filePathList ダウンロードする点群のファイルパス
   */
  public downloadLas(callback: (status: DownloadStatus[]) => void, filePathList?: string[]): void {
    // LASファイルダウンロード処理開始
    Logging.info(LOG_CONF.INFO_LAS_DOWNLOAD_START);

    // ダウンロード実行オブジェクト生成
    const downloader: LasDownload = new LasDownload();
    this.lasDownloaders.add(downloader);

    // ダウンロード処理終了時の処理定義
    const terminateDownloadProc = () => {
      // 想定外の異常終了等でノードがダウンロード状態のままとなるのを回避
      for (const pointSet of this.pointSetMap.values()) {
        const nodeInfoList = pointSet.getNodeInfoList();
        for (const nodeInfo of nodeInfoList) {
          nodeInfo.loading = false;
        }
      }
      downloader.terminate();
      this.lasDownloaders.delete(downloader);
      Logging.info(LOG_CONF.INFO_LAS_DOWNLOAD_END);
    };

    // 範囲選択処理のパラメータ情報を取得
    const parameter: SelectionParameter | undefined = this.getRangeSelectionParameter();

    // 範囲選択状態に応じてダウンロード処理
    if (this.measureMode === MEASURE_MODE.RANGE_SELECTION && undefined !== parameter) {
      // 範囲選択状態 ⇒ 選択して点群のダウンロード

      // 処理対象の点群取得
      const targetPointSetList = Array.from(this.pointSetMap.values());

      downloader
        .startForSelected(targetPointSetList, callback, parameter)
        .then(() => {
          // ダウンロード正常終了(エラー発生の終了含む)
          terminateDownloadProc();
        })
        .catch((error: unknown) => {
          // ダウンロード異常終了(予期せぬエラー)
          Logging.error(LOG_CONF.ERROR_UNKNOWN, this.downloadLas.name, String(error));
          terminateDownloadProc();
        });
    } else {
      // 非範囲選択状態 ⇒ ファイルごとのダウンロード
      const targetPointSetList: PointSet[] = [];
      // ダウンロード対象の点群取得
      if (filePathList) {
        // 指定された点群を取得
        for (const filePath of filePathList) {
          if (this.pointSetMap.has(filePath)) {
            targetPointSetList.push(this.pointSetMap.get(filePath)!);
          }
        }
      } else {
        // 表示中の点群を取得
        for (const pointSet of this.pointSetMap.values()) {
          if (pointSet.getVisibleStatus()) {
            targetPointSetList.push(pointSet);
          }
        }
      }
      // ファイルごとのダウンロード処理実行
      downloader
        .startForFile(targetPointSetList, callback)
        .then(() => {
          // ダウンロード正常終了(エラー発生の終了含む)
          terminateDownloadProc();
        })
        .catch((error: unknown) => {
          // ダウンロード異常終了(予期せぬエラー)
          Logging.error(LOG_CONF.ERROR_UNKNOWN, this.downloadLas.name, String(error));
          terminateDownloadProc();
        });
    }
  }
}
