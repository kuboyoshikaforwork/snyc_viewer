/**
 * @fileoverview 3D空間のカメラ制御を提供するクラスの定義
 * @author Kota Kubota(SEQ)
 * @created 2025/05/02
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import * as THREE from 'three';
import {MOUSE_EVENT_CODE} from '../util/constant';
import {ViewUtil} from '../util/viewUtil';
import {COPCConf} from '../conf/copcConf';
import {ViewCamera} from './viewCamera';
import {Logging} from '../log/logging';
import {LOG_CONF} from '../log/logConf';

/**
 * @interface イベントマップ
 */
interface ControlsEventMap {
  targetChange: unknown;
  change: unknown;
}

/**
 * @interface キーコード定義
 */
interface KeyCode {
  up: string;
  left: string;
  right: string;
  down: string;
}

/**
 * @interface マウスボタン定義
 */
interface MouseButton {
  left: number;
  middle: number;
  right: number;
}

/** 誤差計算用数値 */
const EPS = 0.000001;

/** キー操作時の視点移動スピード */
const KEY_ROTATION_SPEED = 1.0;
/** キー操作時の注視点移動スピード */
const KEY_PAN_SPEED = 7.0;

/** ズーム操作の時間間隔 */
const ZOOM_INTERVAL_TIME = 800;

/** マウス操作状態 */
const CONTROL_STATE = {
  NONE: -1, // 操作中でない
  ROTATE: 0, // 注視点を中心にして視点を移動中
  DOLLY: 1, // 拡大、縮小中
  PAN: 2, // 注視点と視点を平行移動中
};
Object.freeze(CONTROL_STATE);

/** 視点操作方法 */
const CONTROL_NO = {
  ROTATE: 0,
  DOLLY: 1,
  PAN: 2,
};
Object.freeze(CONTROL_NO);

/**
 * 3D空間のカメラ制御を提供するクラス
 * @extends THREE.EventDispatcher<ControlsEventMap>
 */
export class CameraControls extends THREE.EventDispatcher<ControlsEventMap> {
  /** 3D空間のカメラオブジェクト */
  private camera: ViewCamera;

  /** レンダラーのキャンバス要素 */
  private domElement: HTMLElement;

  /** 視点移動操作制御可否 */
  protected enabled: boolean = COPCConf.conf.EYE_MOVE_ENABLED;

  /** 視点移動制御の中心座標 */
  private target: THREE.Vector3 = new THREE.Vector3();

  /** 前回視点位置座標 */
  private lastTarget: THREE.Vector3 = new THREE.Vector3();

  /** 前回注視点位置座標 */
  private lastPosition: THREE.Vector3 = new THREE.Vector3();

  /** 回転操作の割り当てキーコード */
  private rotateKeyCode: KeyCode = {
    up: COPCConf.conf.KEY_ROTATE_UP.toUpperCase(),
    left: COPCConf.conf.KEY_ROTATE_LEFT.toUpperCase(),
    right: COPCConf.conf.KEY_ROTATE_RIGHT.toUpperCase(),
    down: COPCConf.conf.KEY_ROTATE_DOWN.toUpperCase(),
  };

  /** パン操作の割り当てキーコード */
  private panKeyCode: KeyCode = {
    up: COPCConf.conf.KEY_PAN_UP.toUpperCase(),
    left: COPCConf.conf.KEY_PAN_LEFT.toUpperCase(),
    right: COPCConf.conf.KEY_PAN_RIGHT.toUpperCase(),
    down: COPCConf.conf.KEY_PAN_DOWN.toUpperCase(),
  };

  /** 視点制御の割り当てマウスボタンコード */
  private mouseButtonCode: MouseButton = {left: CONTROL_NO.ROTATE, middle: CONTROL_NO.DOLLY, right: CONTROL_NO.PAN};

  /** 視線方向 */
  private up: THREE.Vector3;

  /** マウス操作状態 */
  private controlState = CONTROL_STATE.NONE;

  // 視線方向と鉛直線のなす角度
  private minPolarAngle = (0 / 180.0) * Math.PI;
  private maxPolarAngle = (180 / 180.0) * Math.PI;

  /** ズーム開始位置 */
  private dollyStart: THREE.Vector2 = new THREE.Vector2();

  /** ズーム終了位置 */
  private dollyEnd: THREE.Vector2 = new THREE.Vector2();

  /** ズーム操作のスクリーン移動量 */
  private dollyDelta: THREE.Vector2 = new THREE.Vector2();

  /** 回転開始位置 */
  private rotateStart: THREE.Vector2 = new THREE.Vector2();

  /** 回転終了位置 */
  private rotateEnd: THREE.Vector2 = new THREE.Vector2();

  /** 回転操作のスクリーン移動量 */
  private rotateDelta: THREE.Vector2 = new THREE.Vector2();

  /** 回転操作の3D移動量 */
  private rotateOffset: THREE.Spherical = new THREE.Spherical();

  /** パン開始位置 */
  private panStart: THREE.Vector2 = new THREE.Vector2();

  /** パン終了位置 */
  private panEnd: THREE.Vector2 = new THREE.Vector2();

  /** パン操作のスクリーン移動量 */
  private panDelta: THREE.Vector2 = new THREE.Vector2();

  /** パン操作の3D移動量 */
  private panOffset: THREE.Vector3 = new THREE.Vector3();

  /** ズーム操作の3Dスケール */
  private screenScale: number = 1;

  /** 視点移動状態 */
  private eyeMoving: boolean = false;

  /** ズーム状態 */
  private zooming: boolean = false;

  /** ズーム操作終了設定のタイマID */
  private zoomingEndTimerId: number = -1;

  /** マウスダウンイベントハンドラ */
  private mouseDownEvent: (event: MouseEvent) => void;

  /** マウスムーブイベントハンドラ */
  private mouseMoveEvent: ((event: MouseEvent) => void) | undefined = undefined;

  /** マウスアップイベントハンドラ */
  private mouseUpEvent: ((event: MouseEvent) => void) | undefined = undefined;

  /** マウスホイールイベントハンドラ */
  private mouseWheelEvent: (event: WheelEvent) => void;

  /** キーダウンイベントハンドラ */
  private keyDownEvent: (event: KeyboardEvent) => void;

  /**
   * コンストラクタ
   * @param camera 3D空間のカメラオブジェクト
   * @param domElement レンダラーのキャンバス要素
   * @param yAxisUp Y軸Z軸上方向設定(true：Y軸上方向、false：Z軸上方向)
   */
  constructor(camera: ViewCamera, domElement: HTMLElement, yAxisUp: boolean) {
    super();

    this.camera = camera;
    this.domElement = domElement;

    // 注視点設定
    this.target.set(0.0, 0.0, 0.0);

    if (yAxisUp) {
      this.up = new THREE.Vector3(0.0, 1.0, 0.0);
    } else {
      this.up = new THREE.Vector3(0.0, 0.0, 1.0);
    }

    // イベント処理バインド
    this.mouseDownEvent = this.onMouseDown.bind(this);
    this.mouseWheelEvent = this.onMouseWheel.bind(this);
    this.keyDownEvent = this.onKeyDown.bind(this);

    // マウスダウンイベント
    this.domElement.addEventListener('mousedown', this.mouseDownEvent);
    // マウスホイールイベント
    this.domElement.addEventListener('wheel', this.mouseWheelEvent);
    // キーダウンイベント
    window.addEventListener('keydown', this.keyDownEvent);

    // 設定値反映
    this.enabled = COPCConf.conf.EYE_MOVE_ENABLED;
    this.rotateKeyCode = {
      up: COPCConf.conf.KEY_ROTATE_UP.toUpperCase(),
      left: COPCConf.conf.KEY_ROTATE_LEFT.toUpperCase(),
      right: COPCConf.conf.KEY_ROTATE_RIGHT.toUpperCase(),
      down: COPCConf.conf.KEY_ROTATE_DOWN.toUpperCase(),
    };
    this.panKeyCode = {
      up: COPCConf.conf.KEY_PAN_UP.toUpperCase(),
      left: COPCConf.conf.KEY_PAN_LEFT.toUpperCase(),
      right: COPCConf.conf.KEY_PAN_RIGHT.toUpperCase(),
      down: COPCConf.conf.KEY_PAN_DOWN.toUpperCase(),
    };
    const buttonCodeMap: Map<string, number> = new Map();
    buttonCodeMap.set(COPCConf.conf.MOUSE_BUTTON_ROTATE, CONTROL_NO.ROTATE);
    buttonCodeMap.set(COPCConf.conf.MOUSE_BUTTON_ZOOM, CONTROL_NO.DOLLY);
    buttonCodeMap.set(COPCConf.conf.MOUSE_BUTTON_PAN, CONTROL_NO.PAN);
    this.mouseButtonCode = {
      left: buttonCodeMap.get('LEFT')!,
      middle: buttonCodeMap.get('MIDDLE')!,
      right: buttonCodeMap.get('RIGHT')!,
    };
  }

  /**
   * 3D空間のカメラ制御オブジェクトに設定ファイルの定義を反映する。
   */
  public applyConfig(): void {
    this.enabled = COPCConf.conf.EYE_MOVE_ENABLED;
    this.rotateKeyCode = {
      up: COPCConf.conf.KEY_ROTATE_UP.toUpperCase(),
      left: COPCConf.conf.KEY_ROTATE_LEFT.toUpperCase(),
      right: COPCConf.conf.KEY_ROTATE_RIGHT.toUpperCase(),
      down: COPCConf.conf.KEY_ROTATE_DOWN.toUpperCase(),
    };
    this.panKeyCode = {
      up: COPCConf.conf.KEY_PAN_UP.toUpperCase(),
      left: COPCConf.conf.KEY_PAN_LEFT.toUpperCase(),
      right: COPCConf.conf.KEY_PAN_RIGHT.toUpperCase(),
      down: COPCConf.conf.KEY_PAN_DOWN.toUpperCase(),
    };
    const buttonCodeMap: Map<string, number> = new Map();
    buttonCodeMap.set(COPCConf.conf.MOUSE_BUTTON_ROTATE, CONTROL_NO.ROTATE);
    buttonCodeMap.set(COPCConf.conf.MOUSE_BUTTON_ZOOM, CONTROL_NO.DOLLY);
    buttonCodeMap.set(COPCConf.conf.MOUSE_BUTTON_PAN, CONTROL_NO.PAN);
    this.mouseButtonCode = {
      left: buttonCodeMap.get('LEFT')!,
      middle: buttonCodeMap.get('MIDDLE')!,
      right: buttonCodeMap.get('RIGHT')!,
    };
  }

  /**
   * 視点操作の移動量に応じて、カメラの視点や注視点の位置を更新する
   */
  public update(): void {
    // カメラ位置取得
    const position = this.camera.get().position;

    // 視点位置から注視点位置までのオフセット算出
    let offset = position.clone().sub(this.target);

    // minDistanceをカメラのnearに設定する
    const minDistance = this.camera.getNearFrustum() * 1.0001;

    // 視点から注視点までの距離が0の時の処理
    if (offset.length() === 0) {
      offset.set(0.0, -minDistance, 0.0);
    }

    // マウス移動前の視線のY軸に対する角度
    let phi = Math.acos(this.up.dot(offset) / (this.up.length() * offset.length()));

    let axis = new THREE.Vector3();
    if (phi < EPS || phi > Math.PI - EPS) {
      // 視点位置が注視点の上方または下方にある場合、X軸方向とする
      axis.set(1.0, 0.0, 0.0);
    } else {
      // その他の場合(通常時)
      // 外積(upとoffsetに垂直な単位ベクトル)
      axis.crossVectors(this.up, offset).normalize();
    }

    // マウス移動後のY軸基準の緯度方向角度を算出
    phi += this.rotateOffset.phi;

    // restrict phi to be between desired limits
    phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, phi));

    // restrict phi to be between 2*EPS and PI-2*EPS
    phi = Math.max(2.0 * EPS, Math.min(Math.PI - 2.0 * EPS, phi));

    let radius = offset.length() * this.screenScale;

    // restrict radius to be between desired limits
    radius = Math.max(minDistance, radius);

    // move target to panned location
    this.target.add(this.panOffset);

    axis = ViewUtil.rotateVector(axis, this.up, this.rotateOffset.theta);

    const vec = this.up.clone().normalize();
    vec.multiplyScalar(radius);

    offset = ViewUtil.rotateVector(vec, axis, phi);

    this.camera.get().position.copy(this.target.clone().add(offset));

    // カメラを注視点位置に向ける
    this.camera.get().lookAt(this.target);

    // 初期化
    this.rotateOffset.set(0, 0, 0);
    this.screenScale = 1;
    this.panOffset.set(0, 0, 0);

    // イベント通知
    if (this.lastPosition.distanceTo(this.camera.get().position) > 0 || this.lastTarget.distanceTo(this.target) > 0) {
      const event: THREE.BaseEvent<'change'> = {
        type: 'change',
      };
      this.dispatchEvent(event);
      this.lastPosition.copy(this.camera.get().position);
      this.lastTarget.copy(this.target);
    }
  }

  /**
   * 登録したイベントやタイマ処理を削除する
   */
  public clear(): void {
    // タイマー処理破棄
    window.clearTimeout(this.zoomingEndTimerId);

    // イベントリスナーを削除
    this.domElement.removeEventListener('mousedown', this.mouseDownEvent);
    this.domElement.removeEventListener('wheel', this.mouseWheelEvent);
    window.removeEventListener('keydown', this.keyDownEvent);
    if (this.mouseMoveEvent) {
      this.domElement.removeEventListener('mousemove', this.mouseMoveEvent);
    }
    if (this.mouseUpEvent) {
      this.domElement.removeEventListener('mouseup', this.mouseUpEvent);
      this.domElement.removeEventListener('mouseout', this.mouseUpEvent);
    }
    Logging.debug(LOG_CONF.DEBUG_RELEASE_CAMERA_RESOURCE);
  }

  /**
   * 押下したマウスボタンに応じた操作(回転・ズーム・パン)の開始位置を保持する
   * @param event マウスイベント
   */
  onMouseDown(event: MouseEvent): void {
    Logging.trace(LOG_CONF.TRACE_VIEW_CONTROL_MOUSE_DOWN, event.clientX.toString(), event.clientY.toString());

    // イベント無効の場合処理終了;
    if (!this.enabled) {
      return;
    }

    event.preventDefault();

    // 操作対象取得
    let mouseAction = -1;
    switch (event.button) {
      case MOUSE_EVENT_CODE.BUTTON_LEFT:
        mouseAction = this.mouseButtonCode.left;
        break;
      case MOUSE_EVENT_CODE.BUTTON_CENTER:
        mouseAction = this.mouseButtonCode.middle;
        break;
      case MOUSE_EVENT_CODE.BUTTON_RIGHT:
        mouseAction = this.mouseButtonCode.right;
        break;
      default:
        mouseAction = -1;
        break;
    }

    // 操作対象に応じた処理
    switch (mouseAction) {
      case CONTROL_NO.ROTATE:
        // 注視点を中心に視点回転
        this.controlState = CONTROL_STATE.ROTATE;
        this.rotateStart.set(event.clientX, event.clientY);
        break;
      case CONTROL_NO.DOLLY:
        // シーンを拡大縮小
        this.controlState = CONTROL_STATE.DOLLY;
        this.dollyStart.set(event.clientX, event.clientY);
        break;
      case CONTROL_NO.PAN:
        // シーンを平行移動
        this.controlState = CONTROL_STATE.PAN;
        this.panStart.set(event.clientX, event.clientY);
        break;
      default:
        this.controlState = CONTROL_STATE.NONE;
        break;
    }

    // 正常処理の場合視点移動中のためイベント登録
    if (this.controlState !== CONTROL_STATE.NONE) {
      this.eyeMoving = true;

      // イベント登録
      this.mouseMoveEvent = this.onMouseMove.bind(this);
      this.mouseUpEvent = this.onMouseUp.bind(this);
      this.domElement.addEventListener('mousemove', this.mouseMoveEvent, false);
      this.domElement.addEventListener('mouseup', this.mouseUpEvent, false);
      this.domElement.addEventListener('mouseout', this.mouseUpEvent, false);
    }
  }

  /**
   * 実行中の操作状態(回転・ズーム・パン)に応じて操作の移動量を算出し、見た目を更新する
   * @param event マウスイベント
   */
  private onMouseMove(event: MouseEvent): void {
    Logging.trace(LOG_CONF.TRACE_VIEW_CONTROL_MOUSE_MOVE, event.clientX.toString(), event.clientY.toString());

    // イベント無効の場合処理終了
    if (!this.enabled) {
      return;
    }

    event.preventDefault();

    switch (this.controlState) {
      case CONTROL_STATE.ROTATE:
        // マウス左ボタンでドラッグしている場合、注視点を中心に視点回転する。
        this.rotateEnd.set(event.clientX, event.clientY);
        this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart);

        // rotating across whole screen goes 360 degrees around
        this.rotateLeft((2 * Math.PI * this.rotateDelta.x) / this.domElement.clientHeight);
        // rotating up and down along whole screen attempts to go 360, but limited to 180
        this.rotateUp((2 * Math.PI * this.rotateDelta.y) / this.domElement.clientHeight);

        this.rotateStart.copy(this.rotateEnd);
        break;
      case CONTROL_STATE.DOLLY:
        // マウス中ボタンでドラッグしている場合、シーンを拡大縮小する。
        this.dollyEnd.set(event.clientX, event.clientY);
        this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);
        if (this.dollyDelta.y > 0) {
          // マウスを下に動かせば、シーン縮小
          this.dollyIn();
        } else if (this.dollyDelta.y < 0) {
          // マウスを上に動かせば、シーン拡大
          this.dollyOut();
        }
        // 移動量（dollyDelta.y）が0の場合は、拡大縮小しない。マウスを左右に移動したときに、拡大してしまうため。

        this.dollyStart.copy(this.dollyEnd);
        break;
      case CONTROL_STATE.PAN:
        // マウス右ボタンでドラッグしている場合、シーンを平行移動する。
        this.panEnd.set(event.clientX, event.clientY);
        this.panDelta.subVectors(this.panEnd, this.panStart);
        this.panSet(this.panDelta);
        this.panStart.copy(this.panEnd);
        break;
      default:
        // CONTROL_STATE.NONEの場合は何もしない
        break;
    }

    // 状態の更新
    this.update();
  }

  /**
   * マウスダウン時に登録したイベントを削除し、操作状態を非操作中にする
   * @param event マウスイベント
   */
  private onMouseUp(event: MouseEvent): void {
    Logging.trace(LOG_CONF.TRACE_VIEW_CONTROL_MOUSE_UP, event.clientX.toString(), event.clientY.toString());

    // イベントリスナーを削除
    if (this.mouseMoveEvent) {
      this.domElement.removeEventListener('mousemove', this.mouseMoveEvent);
    }
    if (this.mouseUpEvent) {
      this.domElement.removeEventListener('mouseup', this.mouseUpEvent);
      this.domElement.removeEventListener('mouseout', this.mouseUpEvent);
    }

    // 視点移動状態設定
    this.eyeMoving = false;

    // マウス操作状態を非操作中に設定
    this.controlState = CONTROL_STATE.NONE;
  }

  /**
   * マウスホイールの移動量を算出し、ズーム操作の見た目を更新する。
   * @param event マウスホイールイベント
   */
  private onMouseWheel(event: WheelEvent): void {
    Logging.trace(LOG_CONF.TRACE_VIEW_CONTROL_MOUSE_WHEEL, event.deltaY.toString());

    // ズームが無効の場合処理終了
    if (!this.enabled) {
      return;
    }

    // 移動量
    if (event.deltaY < 0) {
      // マウス中ボタンを上にスクロールすれば、シーン拡大
      this.dollyOut();
    } else {
      // マウス中ボタンを下にスクロールすれば、シーン縮小
      this.dollyIn();
    }

    this.update();

    // ズーム中のフラグをON
    window.clearTimeout(this.zoomingEndTimerId);
    this.zooming = true;
    this.zoomingEndTimerId = window.setTimeout(() => {
      this.zooming = false;
    }, ZOOM_INTERVAL_TIME);
  }

  /**
   * 押下したキーに応じた操作(回転・パン)の移動量を算出し、見た目を更新する
   * @param event キーボードイベント
   */
  private onKeyDown(event: KeyboardEvent): void {
    Logging.trace(LOG_CONF.TRACE_VIEW_CONTROL_KEY_DOWN, event.key);

    // イベント無効の場合処理終了;
    if (!this.enabled) {
      return;
    }

    // テキストを入力する際は、視点・注視点の移動をしない
    const activeElement = document.activeElement;
    if (activeElement?.localName === 'textarea' || activeElement?.localName === 'input') {
      return;
    }

    // 入力キー
    const key = event.key.toUpperCase();
    let needsUpdate = false;

    // 視点移動
    switch (key) {
      case this.rotateKeyCode.up:
        this.rotateUp((2 * Math.PI * KEY_ROTATION_SPEED) / this.domElement.clientHeight);
        needsUpdate = true;
        break;
      case this.rotateKeyCode.down:
        this.rotateUp(-(2 * Math.PI * KEY_ROTATION_SPEED) / this.domElement.clientHeight);
        needsUpdate = true;
        break;
      case this.rotateKeyCode.left:
        this.rotateLeft((2 * Math.PI * KEY_ROTATION_SPEED) / this.domElement.clientHeight);
        needsUpdate = true;
        break;
      case this.rotateKeyCode.right:
        this.rotateLeft(-(2 * Math.PI * KEY_ROTATION_SPEED) / this.domElement.clientHeight);
        needsUpdate = true;
        break;
      default:
        // 設定外のキーでは視点移動を行わない
        break;
    }
    // 視点注視点移動
    switch (key) {
      case this.panKeyCode.up:
        this.panUp(KEY_PAN_SPEED);
        needsUpdate = true;
        break;
      case this.panKeyCode.down:
        this.panUp(-KEY_PAN_SPEED);
        needsUpdate = true;
        break;
      case this.panKeyCode.left:
        this.panLeft(KEY_PAN_SPEED);
        needsUpdate = true;
        break;
      case this.panKeyCode.right:
        this.panLeft(-KEY_PAN_SPEED);
        needsUpdate = true;
        break;
      default:
        // 設定外のキーでは視点注視点移動を行わない
        break;
    }

    // 状態の更新
    if (needsUpdate) {
      event.preventDefault();
      this.update();
    }
  }

  /**
   * ズーム操作の拡大状態を設定する
   * @returns ズーム比率
   */
  private getZoomScale(): number {
    // Three.jsではズーム速度が可変であるが、固定値で処理する。
    return Math.pow(0.95, 1.0);
  }

  /**
   * ズーム操作の拡大状態を設定する
   */
  private dollyOut(): void {
    const dollyScale: number = this.getZoomScale();
    this.screenScale *= dollyScale;
  }

  /**
   * ズーム操作の縮小状態を設定する
   */
  private dollyIn(): void {
    const dollyScale: number = this.getZoomScale();
    this.screenScale /= dollyScale;
  }

  /**
   * パン操作の3D空間での左右方向の移動量を設定する
   * パン操作が左方向の場合は負数、右方向の場合は正数を設定する
   * @param distance パン操作の左右方向の移動量
   */
  private panLeft(distance: number): void {
    const panOffset: THREE.Vector3 = new THREE.Vector3();
    const matrix: THREE.Matrix4Tuple = this.camera.getMatrixElem();

    panOffset.set(matrix[0], matrix[1], matrix[2]);
    panOffset.multiplyScalar(-distance);

    this.panOffset.add(panOffset);
  }

  /**
   * パン操作の3D空間での上下方向の移動量を設定する
   * パン操作が上方向の場合は負数、下方向の場合は正数を設定する
   * @param distance パン操作の上下方向の移動量
   */
  private panUp(distance: number): void {
    const panOffset = new THREE.Vector3();
    const matrix = this.camera.getMatrixElem();
    // get Y column of matrix
    panOffset.set(matrix[4], matrix[5], matrix[6]);
    panOffset.multiplyScalar(distance);

    this.panOffset.add(panOffset);
  }

  /**
   * パン操作の3D空間での移動量を設定する
   * @param delta スクリーン上でのマウス移動量
   */
  private panSet(delta: THREE.Vector2): void {
    const position = this.camera.get().position;
    const offset = position.clone().sub(this.target);
    let targetDistance = offset.length();

    // half of the fov is center to top of screen
    const fov = this.camera.getFov();
    targetDistance *= Math.tan(((fov / 2) * Math.PI) / 180.0);
    // we actually don't use screenWidth, since perspective camera is fixed to screen height
    this.panLeft((2 * delta.x * targetDistance) / this.domElement.clientHeight);
    this.panUp((2 * delta.y * targetDistance) / this.domElement.clientHeight);
  }

  /**
   * 回転操作の3D空間での左右方向の移動量を設定する
   * 注視点を中心に回転させる左右方向の画角をセットする
   * 左方向への画角(radian) 負の値で右方向へ画角を変更する
   * @param angle 回転操作の左右方向の移動量
   */
  private rotateLeft(angle: number): void {
    this.rotateOffset.theta -= angle;
  }

  /**
   * 回転操作の3D空間での上下方向の移動量を設定する
   * 注視点を中心に回転させる上下方向の画角をセットする
   * 上方向への画角(radian) 負の値で下方向へ画角を変更する
   * @param angle 回転操作の上下方向の移動量
   */
  private rotateUp(angle: number): void {
    this.rotateOffset.phi -= angle;
  }

  /**
   * マウスやキーボードによる視点移動を有効にする
   */
  public setEyeMoveEnabled(): void {
    this.enabled = true;
    Logging.debug(LOG_CONF.DEBUG_ENABLE_EYE_MOVE);
  }

  /**
   * マウスやキーボードによる視点移動を無効にする
   */
  public setEyeMoveDisabled(): void {
    this.enabled = false;
    Logging.debug(LOG_CONF.DEBUG_DISABLE_EYE_MOVE);
  }

  /**
   * 視点移動状態を取得する
   * @returns 視点移動状態(true：視点移動中、false：視点停止中)
   */
  public isEyeMoving(): boolean {
    return this.eyeMoving;
  }

  /**
   * ズーム状態を取得する
   * @returns ズーム状態(true：ズーム中、false：ズーム停止中)
   */
  public isZooming(): boolean {
    return this.zooming;
  }

  /**
   * 注視点座標を指定した座標に設定する
   * @param focus 設定する注視点座標
   */
  public setFocus(focus: THREE.Vector3): void {
    // コントローラーのターゲット設定
    this.target.set(focus.x, focus.y, focus.z);

    // カメラの注視点座標設定
    this.camera.get().lookAt(focus);
    Logging.trace(LOG_CONF.TRACE_SET_FOCUS_POSITION, focus.x.toString(), focus.y.toString(), focus.z.toString());
  }

  /**
   * 現在の注視点座標を取得する
   */
  public getFocus(): THREE.Vector3 {
    return this.target.clone();
  }

  /**
   * 視点座標を設定した座標に設定する
   * @param eye 設定する視点座標
   */
  public setEye(eye: THREE.Vector3): void {
    this.camera.get().position.copy(eye);
    Logging.trace(LOG_CONF.TRACE_SET_EYE_POSITION, eye.x.toString(), eye.y.toString(), eye.z.toString());
  }

  /**
   * 現在の視点座標を取得する
   */
  public getEye(): THREE.Vector3 {
    return this.camera.get().position.clone();
  }
}
