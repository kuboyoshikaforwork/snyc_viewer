/**
 * @fileoverview 3D空間のビューアを提供するクラスの定義
 * @author Kota Kubota(SEQ)
 * @created 2025/05/22
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import * as THREE from 'three';
import {Intersection, Object3D} from 'three';

import Stats from 'three/examples/jsm/libs/stats.module.js';

import {ViewCamera} from './three/viewCamera';
import {COPCControls} from './copc/copcControls';
import {ViewRenderer} from './three/viewRenderer';
import {COPCScene} from './copc/copcScene';

import {LOAD_STATE, NodeInfo} from './pointCloud/nodeInfo';
import {FileInfo, PointSet} from './pointCloud/pointSet';
import {FOR_DEBUG, MOUSE_EVENT_CODE} from './util/constant';

import {MultiViewerControl} from './multiViewerControl';
import {PointDef} from './pointCloud/pointDef';
import {PointMeasure} from './pointCloud/pointMeasure';
import {COPCConf} from './conf/copcConf';
import {Logging} from './log/logging';
import {LOG_CONF} from './log/logConf';
import {IndexedDbUtil} from './util/indexedDbUtil';

/** 表示最大点数初期値値 */
const INITIAL_VIEW_MAX_POINT = 3 * 1000 * 1000;
/** シーン内最大点数初期値 */
const INITIAL_SCENE_MAX_POINT = 120 * 1000 * 1000;

/** 静的表示時FPS */
const STATIC_BASE_FPS = 30;
/** 動的表示時FPS */
const DYNAMIC_BASE_FPS = 15;
/** FPS履歴格納配列サイズ */
const HISTORY_ARRAY_SIZE = 10;

/** 間引き表示モード(0: 動的間引き, 1: 広域間引き, 2: 深さ指定間引き) */
export const LOD_MODE = {
  DYNAMIC: 0,
  WIDE_AREA: 1,
  DEPTH: 2,
};
Object.freeze(LOD_MODE);

/** 視点・注視点自動調整時の設定値 */
const AUTO_FOCUS_PARAM = {
  X_DIR: 0.0,
  Y_DIR: -1.0,
  Z_DIR: 0.15,
  OFFSET: 0.8,
};
Object.freeze(AUTO_FOCUS_PARAM);

/**
 * 3D空間のビューアを提供するクラス。
 */
export class COPCViewer {
  /** 3D空間を表示するHTML要素 */
  private container: HTMLElement;
  /** サーバのURL */
  private serverUrl: string;

  /** 3D空間のレンダラーオブジェクト */
  private renderer: ViewRenderer;
  /** 3D空間の点群表示シーンオブジェクト */
  private scene: COPCScene;
  /** 3D空間のカメラオブジェクト */
  private camera: ViewCamera;
  /** 3D空間の点群表示カメラ制御オブジェクト */
  private controls: COPCControls;

  /** 点群定義オブジェクト */
  private pointDef: PointDef;

  /** 点群データ計測オブジェクト */
  public pointMeasure: PointMeasure;

  /** ロード対象点群データ一覧(key: 点群データファイルパス、value: 点群データ管理オブジェクト) */
  private pointSetMap: Map<string, PointSet> = new Map();

  /** 定周期アニメーション処理リクエストID */
  private animationFrameId: number = 0;

  /** ロード処理のタイマID */
  private loadTimerIdMap: Map<Worker, number> = new Map();
  // ロード対象ファイルパス一覧(ロード失敗含む)
  private targetFilePathList: Set<string> = new Set();
  /** ロード対象ノード一覧 */
  private loadNodeList: NodeInfo[] = [];

  /** 静的表示時の最大表示点数 */
  private staticViewMaxPointNum: number = INITIAL_VIEW_MAX_POINT;
  /** 動的表示時の最大表示点数 */
  private dynamicViewMaxPointNum: number = INITIAL_VIEW_MAX_POINT * 2;
  /** シーン最大点数 */
  private sceneMaxPointNum: number = INITIAL_SCENE_MAX_POINT;

  /** 瞬時処理点数履歴 */
  private viewPointHistory: number[] = [];
  /** 平均処理点数履歴 */
  private viewPointAvgHistory: number[] = [];
  /** FPS履歴格納配列 */
  private fpsHistory: number[] = [];
  /** アニメーション処理の前回実行時刻 */
  private prevTime: number = performance.now();

  /** 間引き方式 */
  private lodMode: number = LOD_MODE.WIDE_AREA;
  /** 深さ指定間引き表示の深さ */
  private viewCopcDepth: number = 1;
  /** 表示状態 */
  private viewStatus: number = LOD_MODE.WIDE_AREA;

  /** オブジェクトクリック時のコールバック関数 */
  private objClickedCallback: ((id: number) => void) | undefined = undefined;

  /** 2画面分割表示制御オブジェクト */
  private sync: MultiViewerControl | null = null;
  /** 前回視点座標 */
  private eye: THREE.Vector3 = new THREE.Vector3();
  /** 前回注視点座標 */
  private focus: THREE.Vector3 = new THREE.Vector3();

  // イベントハンドラ
  /** ウィンドウリサイズイベントハンドラ */
  private windowResizeEvent: () => void;
  /** コンテキストメニュー表示イベントハンドラ */
  private contextMenuEvent: (event: MouseEvent) => void;
  /** マウスダブルクリックイベントハンドラ */
  private dblClickEvent: (event: MouseEvent) => void;
  /** マウスダウンイベントハンドラ */
  private mouseDownEvent: (event: MouseEvent) => void;
  /** マウスムーブイベントハンドラ */
  private mouseMoveEvent: (event: MouseEvent) => void;
  /** マウスアップイベントハンドラ */
  private mouseUpEvent: (event: MouseEvent) => void;

  // イベントターゲット
  private eventTarget: EventTarget;

  /** データロード用ワーカー */
  private workers: Worker[] = [];

  // デバッグ定義
  /** 統計ウィンドウ表示有無 */
  private viewStats: boolean = true;
  /** 統計ウィンドウオブジェクト */
  private stats: Stats | undefined = undefined;

  /**
   * コンストラクタ
   * @param container 3D空間を表示するHTML要素
   * @param url 点群データを取得するサーバのURL
   * @param yAxisUp Y軸Z軸上方向設定(true：Y軸上方向、false：Z軸上方向)
   * @param conf 設定ファイルのJSON形式データ(省略した場合はデフォルト値で起動)
   */
  constructor(container: HTMLElement, url: string, yAxisUp: boolean, conf?: object) {
    this.container = container;
    this.serverUrl = url;

    // 設定反映
    if (conf) {
      COPCConf.set(conf);
      Logging.setLogLevel(COPCConf.conf.LOG_LEVEL);
    }

    // Three.js要素 初期化
    this.camera = new ViewCamera(this.container, yAxisUp);
    this.renderer = new ViewRenderer(this.container);
    this.scene = new COPCScene(this.camera, this.renderer);
    this.controls = new COPCControls(this.camera, this.renderer.get().domElement, yAxisUp);

    // 点群定義
    this.pointDef = new PointDef(this.container);

    // 点群データ計測
    this.pointMeasure = new PointMeasure(
      this.scene,
      this.camera,
      this.controls,
      this.pointDef,
      this.pointSetMap,
      this.renderer.get().domElement,
      yAxisUp,
    );

    // イベント処理バインド
    this.windowResizeEvent = this.onWindowResizeEvent.bind(this);
    this.contextMenuEvent = this.onContextMenuEvent.bind(this);
    this.dblClickEvent = this.onDblClickEvent.bind(this);
    this.mouseDownEvent = this.onMouseDownEvent.bind(this);
    this.mouseMoveEvent = this.onMouseMoveEvent.bind(this);
    this.mouseUpEvent = this.onMouseUpEvent.bind(this);

    // コンテキストメニュー抑制
    this.container.addEventListener('contextmenu', this.contextMenuEvent);
    // ダブルクリック時処理登録
    this.container.addEventListener('dblclick', this.dblClickEvent);
    // マウスダウン時処理登録
    this.container.addEventListener('mousedown', this.mouseDownEvent);
    // ウィンドウリサイズ時処理登録
    window.addEventListener('resize', this.windowResizeEvent);

    // イベント処理用定義
    this.eventTarget = new EventTarget();

    // FPS表示
    if (this.viewStats && FOR_DEBUG) {
      this.stats = new Stats();
      this.stats.dom.style.position = 'absolute';
      this.stats.dom.style.top = '0px';
      document.body.appendChild(this.stats.dom);
    }

    // ワーカー処理生成開始
    this.startWorkerProc();

    // 設定値反映
    this.lodMode = COPCConf.conf.LOD_MODE;
    this.viewCopcDepth = COPCConf.conf.LOD_DEPTH;

    // アニメーション処理開始
    this.animation();
  }

  /**
   * 点群データのロード処理を行うワーカーを生成し、処理を開始する
   */
  private startWorkerProc(): void {
    // ワーカー生成
    for (let i = 0; i < COPCConf.conf.DATA_LOAD_WORKER_NUM; i++) {
      const worker: Worker = new Worker(new URL('../assets/viewer/dataWorker', import.meta.url), {type: 'module'});
      this.workers.push(worker);
      this.loadTimerIdMap.set(worker, 0);
    }

    // 点データのロード開始
    for (const worker of this.workers) {
      this.loadPoint(worker).catch((error: unknown) => {
        // 通常発生しない
        if (error instanceof Error) {
          Logging.error(LOG_CONF.ERROR_UNKNOWN, 'constructor', error.name);
        } else {
          Logging.error(LOG_CONF.ERROR_UNKNOWN, 'constructor', String(error));
        }
      });
    }
  }

  /**
   * 点群データのロード処理を行うワーカーを破棄する
   */
  private stopWorkerProc(): void {
    // ロード処理停止
    for (const timerId of this.loadTimerIdMap.values()) {
      clearTimeout(timerId);
    }

    // ワーカー破棄
    for (const worker of this.workers) {
      this.loadTimerIdMap.delete(worker);
      worker.terminate();
    }
    this.workers = [];

    // ロード処理強制終了によってノードがロード状態のままとなるのを回避
    for (const nodeInfo of this.loadNodeList) {
      nodeInfo.loading = false;
    }
  }

  /**
   * 設定ファイル更新
   * @param conf 設定ファイルのJSON形式のデータ
   */
  public setConfig(conf: object): void {
    // 入力値を設定
    COPCConf.set(conf);

    // 共通処理反映
    Logging.setLogLevel(COPCConf.conf.LOG_LEVEL);

    // 各種クラス定義反映
    this.camera.applyConfig();
    this.scene.applyConfig();
    this.controls.applyConfig();
    this.pointDef.applyConfig();
    this.pointMeasure.applyConfig();
    this.applyConfig();
    if (this.sync) {
      this.sync.applyConfig();
    }

    // 設定ファイル反映完了のイベント通知
    const event = new CustomEvent('conf-change');
    this.eventTarget.dispatchEvent(event);

    Logging.info(LOG_CONF.INFO_SET_CONFIG);
  }

  /**
   * 設定ファイル反映完了のイベントターゲットオブジェクトを取得する。
   * @returns イベントターゲット
   */
  public getEventTarget(): EventTarget {
    return this.eventTarget;
  }

  /**
   * 3D空間のビューアオブジェクトに設定ファイルの定義を反映する。
   */
  public applyConfig(): void {
    this.lodMode = COPCConf.conf.LOD_MODE;
    this.viewCopcDepth = COPCConf.conf.LOD_DEPTH;

    // ワーカーを破棄して、再生成する
    this.stopWorkerProc();
    this.startWorkerProc();
  }

  /**
   * カメラとレンダラーの状態をウィンドウサイズによって更新する。
   */
  private onWindowResizeEvent(): void {
    Logging.trace(
      LOG_CONF.TRACE_WINDOW_RESIZE,
      this.container.clientWidth.toString(),
      this.container.clientHeight.toString(),
    );
    this.camera.update();
    this.renderer.resize();
    this.pointDef.updatePointScale();
  }

  /**
   * コンテキストメニュー表示イベント
   * @param event マウスイベント
   */
  private onContextMenuEvent(event: MouseEvent): void {
    event.preventDefault();
  }

  /**
   * ダブルクリックしたマウス位置を注視点の位置に設定する。
   * @param event マウスイベント
   */
  private onDblClickEvent(event: MouseEvent): void {
    Logging.trace(LOG_CONF.TRACE_MOUSE_DOUBLE_CLICK, event.clientX.toString(), event.clientY.toString());
    // ダブルクリック注視点移動無効時は終了
    if (!this.controls.isDblclickFocusMoveEnabled()) {
      return;
    }

    // ダブルクリックしたマウス位置の光線上の点の座標取得
    const focus = this.pointMeasure.getRayPointPosition(event.clientX, event.clientY);
    if (focus) {
      // 注視点移動前の[注視点-カメラ位置]の方向ベクトルを維持した状態で注視点を移動
      const offset = new THREE.Vector3().subVectors(focus, this.controls.getFocus());
      this.controls.setEye(this.controls.getEye().add(offset));
      this.controls.setFocus(focus);
    }
  }

  /**
   * コントロールキー押下状態の場合、可視状態のオブジェクトのオブジェクトIDを取得する。
   * @param event マウスイベント
   */
  private onMouseDownEvent(event: MouseEvent): void {
    Logging.trace(LOG_CONF.TRACE_MOUSE_DOWN, event.clientX.toString(), event.clientY.toString());
    // Shift + Ctrl キーの場合は終了
    if (event.shiftKey && event.ctrlKey) {
      return;
    }

    // マウス左ボタン以外の場合は終了
    if (event.button !== MOUSE_EVENT_CODE.BUTTON_LEFT) {
      return;
    }

    // Ctrlキー押下状態
    if (event.ctrlKey) {
      Logging.trace(LOG_CONF.TRACE_MOUSE_DOWN_CTRL);
      if (this.objClickedCallback) {
        // オブジェクトIDの取得
        const intersects = this.scene.getIntersectObjects(new THREE.Vector2(event.clientX, event.clientY));
        let id: number = -1;
        for (const intersect of intersects) {
          id = this.scene.isSelectableObject(intersect.object);
          if (0 < id) {
            Logging.info(LOG_CONF.INFO_GET_OBJ_ID, id.toString());
            break;
          }
        }
        this.objClickedCallback(id);
      }
    }

    // shiftキー押下状態
    if (event.shiftKey) {
      Logging.trace(LOG_CONF.TRACE_MOUSE_DOWN_SHIFT);
      // クリック位置の点取得
      const position = this.pointMeasure.getRayPointPosition(event.clientX, event.clientY);
      if (position) {
        // マウスダウン時の処理
        this.pointMeasure.pointMeasureProcStart(position);

        // ビュー移動無効化
        this.controls.setEyeMoveDisabled();

        // イベント処理登録
        this.container.addEventListener('mousemove', this.mouseMoveEvent);
        this.container.addEventListener('mouseup', this.mouseUpEvent);
      }
    }
  }

  /**
   * マウスムーブのイベント発生時の処理を行う。
   * @param event マウスイベント
   */
  private onMouseMoveEvent(event: MouseEvent): void {
    Logging.trace(LOG_CONF.TRACE_MOUSE_MOVE, event.clientX.toString(), event.clientY.toString());
    // マウス位置の点取得
    this.pointMeasure.pointMeasureProcNow(event);
  }

  /**
   * カメラ操作を有効化し、マウスダウン時に登録したイベントリスナーを削除する。
   * @param event マウスイベント
   */
  private onMouseUpEvent(event: MouseEvent): void {
    Logging.trace(LOG_CONF.TRACE_MOUSE_UP, event.clientX.toString(), event.clientY.toString());
    // マウス左ボタン以外の場合は終了
    if (event.button !== MOUSE_EVENT_CODE.BUTTON_LEFT) {
      return;
    }

    // 点群データ計測処理のマウスアップ時の処理
    this.pointMeasure.pointMeasureProcEnd();

    // ビュー移動有効化
    this.controls.setEyeMoveEnabled();

    // イベントリスナーを削除
    this.container.removeEventListener('mousemove', this.mouseMoveEvent);
    this.container.removeEventListener('mouseup', this.mouseUpEvent);
  }

  // オブジェクトクリック時のコールバック関数設定
  public setObjClickedCallback(callback: (id: number) => void) {
    this.objClickedCallback = callback;
  }

  /**
   * 指定した点群データをWebサーバからロードしてブラウザのメモリ上に読み込む。
   * @param filePathList ロードする点群のファイルパス
   * @param accessToken ユーザのアクセストークン
   * @throws 点群データのサーバからの取得異常
   */
  public async load(filePathList: string[], accessToken: string): Promise<void> {
    // ロード失敗ファイルパスリスト
    const loadFailedPathList: string[] = [];

    // 点群のヘッダ情報ロード
    for (const filePath of filePathList) {
      // 点群データオブジェクト生成済の場合スキップ
      if (this.pointSetMap.has(filePath)) {
        continue;
      }
      Logging.info(LOG_CONF.INFO_LOAD_POINT_CLOUD, filePath);

      // ロード対象のファイルパス保持
      this.targetFilePathList.add(filePath);

      // 点群データオブジェクト生成
      const pointSet: PointSet = new PointSet(this.serverUrl, filePath, this.scene, accessToken);

      try {
        // 点群情報ロード
        await pointSet.load();

        // ロード完了済を保持
        this.pointSetMap.set(filePath, pointSet);
      } catch (error: unknown) {
        // ロードに失敗したファイルパス情報保持
        // ロードが成功するファイルはロードする
        loadFailedPathList.push(filePath);
        if (error instanceof Error) {
          Logging.error(LOG_CONF.ERROR_LOAD_COPC_HEADER, filePath, error.message);
        } else {
          Logging.error(LOG_CONF.ERROR_UNKNOWN, this.load.name, String(error));
        }
      }
    }

    // ロード対象一覧の更新
    this.loadNodeList = [];
    for (const pointSet of this.pointSetMap.values()) {
      const list: NodeInfo[] = pointSet.getNodeInfoList();
      this.loadNodeList.push(...list);
    }

    // 1ファイルでもロードに失敗した場合は例外スロー
    if (0 < loadFailedPathList.length) {
      const message: string = Logging.getMessage(LOG_CONF.ERROR_LOAD_COPC_HEADER.message, [
        loadFailedPathList.join(','),
      ]);
      throw new Error(message);
    }
  }

  /**
   * 引数で指定した点群データをブラウザのメモリ上から破棄する。
   * @param filePathList アンロードする点群のファイルパスリスト(省略時は全ファイル対象)
   */
  public unload(filePathList?: string[]): void {
    // アンロード対象のファイルパス取得
    let unloadFilePathList: string[] = [];
    if (filePathList) {
      // 指定の点群データを対象
      unloadFilePathList = filePathList;
    } else {
      // すべての点群データを対象
      unloadFilePathList = Array.from(this.targetFilePathList);
    }

    // アンロード処理
    for (const filePath of unloadFilePathList) {
      Logging.info(LOG_CONF.INFO_UNLOAD_POINT_CLOUD, filePath);
      // オブジェクト破棄
      const pointSet = this.pointSetMap.get(filePath);
      if (pointSet) {
        pointSet.clear();
        this.pointSetMap.delete(filePath);
      }

      // アンロード対象のファイルパス破棄
      this.targetFilePathList.delete(filePath);

      // IndexedDB削除
      IndexedDbUtil.deleteDb(filePath).catch(() => {
        Logging.warn(LOG_CONF.WARN_UNLOAD_INDEXEDDB_DELETE, filePath);
      });
    }

    // ロード対象一覧の更新
    this.loadNodeList = [];
    for (const pointSet of this.pointSetMap.values()) {
      const list = pointSet.getNodeInfoList();
      this.loadNodeList.push(...list);
    }
  }

  /**
   * 点群データを取得し、点群オブジェクトを生成する
   * @param worker 点群データロードワーカー
   */
  public async loadPoint(worker: Worker): Promise<void> {
    let target: NodeInfo | undefined = undefined;
    let addFlag: boolean = false;
    let scenePointNum: number = 0;

    // シーン最大点数(2画面分割の場合半数)
    let sceneMaxPointNum: number = this.sceneMaxPointNum;
    if (this.sync) {
      sceneMaxPointNum = this.sceneMaxPointNum / 2;
    }

    // 次ロード処理の呼び出し定義
    const nextLoad = () => {
      const timerId = setTimeout(() => {
        this.loadPoint(worker).catch((error: unknown) => {
          if (error instanceof Error) {
            Logging.error(LOG_CONF.ERROR_UNKNOWN, this.loadPoint.name, error.name);
          } else {
            Logging.error(LOG_CONF.ERROR_UNKNOWN, this.loadPoint.name, String(error));
          }
        });
      });
      this.loadTimerIdMap.set(worker, timerId);
    };

    // LASファイルダウンロード中はロード処理継続しない
    if (this.pointMeasure.isLasDownloading()) {
      nextLoad();
      return;
    }

    // ロード対象のノード取得
    for (const nodeInfo of this.loadNodeList) {
      // ソート順のノードに対してシーンに格納できる最大点数閾値を基準にする対象を選択
      scenePointNum += nodeInfo.getPointNum();
      const loadState: number = nodeInfo.getPointLoadState();
      if (scenePointNum < sceneMaxPointNum) {
        // 当該ノードまでの総点数がシーン内最大点数未満
        if (loadState === LOAD_STATE.NOLOADED) {
          // 対象ノードが未ロード状態
          if (!target) {
            // ロード対象未確定
            target = nodeInfo;
            addFlag = true;
          }
        }
      } else {
        // 当該ノードまでの総点数シーン内最大点数以上
        if (loadState === LOAD_STATE.LOADED) {
          // 対象ノードがロード済状態(オブジェクト生成済)
          nodeInfo.removePointObject();
        } else if (loadState === LOAD_STATE.NOLOADED) {
          // 対象ノードが未ロード状態
          if (!target) {
            // ロード対象未確定
            const dataStored: boolean = await nodeInfo.isDataStoredIndexedDB();
            if (!dataStored) {
              // IndexedDBに未格納
              target = nodeInfo;
            }
          }
        }
      }
    }

    // 位置情報設定
    const posInfos: Map<string, number[]> = new Map();
    for (const pointSet of this.pointSetMap.values()) {
      posInfos.set(pointSet.getFileInfo().filePath, pointSet.getCenter().toArray());
    }

    // 点群オブジェクト追加処理
    if (target) {
      const eye: number[] = this.controls.getEye().toArray();
      target.loading = true;
      target.loadPointData(worker, eye, posInfos, !addFlag);

      // WebWorkerからの正常メッセージ受信時の処理
      worker.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        target.loading = false;
        if (!this.pointMeasure.isLasDownloading()) {
          const pointDataView = new DataView(event.data);
          if (pointDataView.byteLength !== 0 && addFlag) {
            target.addPointObject(pointDataView, this.pointDef);
          }
        }
        nextLoad();
      };
      // WebWorkerからの異常メッセージ受信時の処理
      worker.onmessageerror = () => {
        target.loading = false;
        Logging.warn(LOG_CONF.ERROR_MAIN_WORKER_ON_MESSAGE);
        nextLoad();
      };
      // WebWorker側エラー発生時の処理
      worker.onerror = () => {
        target.loading = false;
        Logging.warn(LOG_CONF.ERROR_SUB_WORKER_INTERNAL);
        nextLoad();
      };
    } else {
      nextLoad();
    }
  }

  /**
   * 引数で指定した点群データを3D空間上に表示する。
   * @param filePathList 表示する点群のファイルパスリスト
   * @throws 点群データ未ロード状態
   */
  public display(filePathList: string[]): void {
    // 表示失敗ファイルパスリスト
    const displayFailedPathList: string[] = [];

    // 表示処理
    for (const filePath of filePathList) {
      const pointSet = this.pointSetMap.get(filePath);
      if (pointSet) {
        // 点群ロード済のため表示対象
        Logging.info(LOG_CONF.INFO_DISP_POINT_CLOUD, filePath);
        pointSet.setVisibleStatus(true);
      } else {
        // 表示に失敗したファイルパス情報保持(表示に成功するファイルは表示する)
        Logging.error(LOG_CONF.ERROR_DISPLAY_UNLOAD_DATA, filePath);
        displayFailedPathList.push(filePath);
      }
    }

    // 非表示点群の状態を更新
    this.updateInvisiblePointState();

    // 1ファイルでも表示に失敗した場合は例外スロー
    if (0 < displayFailedPathList.length) {
      const message: string = Logging.getMessage(LOG_CONF.ERROR_DISPLAY_UNLOAD_DATA.message, [
        displayFailedPathList.join(','),
      ]);
      throw new Error(message);
    }
  }

  /**
   * 引数で指定した点群データを3D空間上で非表示にする。
   * @param filePathList 非表示にする点群のファイルパスリスト
   */
  public undisplay(filePathList?: string[]): void {
    // 非表示対象のファイルパス取得
    let undisplayFilePathList: string[] = [];
    if (filePathList) {
      // 指定の点群データを対象
      undisplayFilePathList = filePathList;
    } else {
      // すべての点群データを対象
      undisplayFilePathList = Array.from(this.targetFilePathList);
    }

    // 非表示処理
    for (const filePath of undisplayFilePathList) {
      const pointSet = this.pointSetMap.get(filePath);
      if (pointSet) {
        Logging.info(LOG_CONF.INFO_HIDE_POINT_CLOUD, filePath);
        pointSet.setVisibleStatus(false);
      }
    }

    // 非表示点群の状態を更新
    this.updateInvisiblePointState();
  }

  /**
   * 画面連動独立制御オブジェクト設定
   * @param sync 2画面分割表示制御オブジェクト
   */
  public setSync(sync: MultiViewerControl | null): void {
    // オブジェクト設定
    this.sync = sync;
  }

  /**
   * 3D空間の点群表示シーンオブジェクトを取得する。
   * @returns 3D空間の点群表示シーンオブジェクト
   */
  public getScene(): COPCScene {
    return this.scene;
  }

  /**
   * ビュー（注視点位置、視点位置）を制御するオブジェクトを取得する。
   * @returns 点群定義のオブジェクト
   */
  public getControls(): COPCControls {
    return this.controls;
  }

  /**
   * 点群データ計測をするオブジェクトを取得する。
   * @returns 点群データ計測のオブジェクト
   */
  public getMeasure(): PointMeasure {
    return this.pointMeasure;
  }

  /**
   * 点群定義のオブジェクトを取得する。
   * @returns 点群定義のオブジェクト
   */
  public getPointDef(): PointDef {
    return this.pointDef;
  }

  /**
   * 表示中の点群データを削除し、リソースの解放を実行する。
   * COPCViewerのインスタンスを削除する場合は必ず実行すること
   */
  public clear(): void {
    Logging.info(LOG_CONF.INFO_END_VIEWER);

    // ワーカー処理終了
    this.stopWorkerProc();

    // アニメーション処理終了
    window.cancelAnimationFrame(this.animationFrameId);

    // 点群データ削除
    for (const [filePath, pointSet] of this.pointSetMap) {
      pointSet.clear();
      this.pointSetMap.delete(filePath);

      // IndexedDB削除
      IndexedDbUtil.deleteDb(filePath).catch(() => {
        Logging.warn(LOG_CONF.WARN_UNLOAD_INDEXEDDB_DELETE, filePath);
      });
    }

    // 点群データ計測処理終了
    this.pointMeasure.clear();

    // コントローラー破棄
    this.controls.clear();

    // シーン破棄
    this.scene.clear();

    // レンダラー破棄
    this.renderer.clear();

    // イベント処理破棄
    window.removeEventListener('resize', this.windowResizeEvent);
    this.container.removeEventListener('contextmenu', this.contextMenuEvent);
    this.container.removeEventListener('dblclick', this.dblClickEvent);
    this.container.removeEventListener('mousedown', this.mouseDownEvent);
    this.container.removeEventListener('mousemove', this.mouseMoveEvent);
    this.container.removeEventListener('mouseup', this.mouseUpEvent);

    if (this.stats) {
      document.body.removeChild(this.stats.dom);
    }

    Logging.debug(LOG_CONF.DEBUG_RELEASE_VIEWER_RESOURCE);
  }

  /**
   * ビューア上に表示している点群のファイル一覧と各ファイルのロード進捗状況を取得する。
   * ロードに失敗している場合はダウンロード割合に-1を設定する
   * @returns 点群ファイル情報
   */
  public getPCInfo(): FileInfo[] {
    const fileInfos: FileInfo[] = [];
    for (const filePath of this.targetFilePathList) {
      const pointSet = this.pointSetMap.get(filePath);
      if (pointSet) {
        // 点群オブジェクトがある場合
        const fileInfo: FileInfo = pointSet.getFileInfo();
        fileInfos.push(fileInfo);
      } else {
        // 点群オブジェクトがない場合
        const fileInfo: FileInfo = {
          filePath: filePath,
          pointNum: 0,
          loadRate: -1,
        };
        fileInfos.push(fileInfo);
      }
    }

    return fileInfos;
  }

  /**
   * 指定した点群が視野内におさまるように視点・注視点位置を自動調整する。
   * @param filePathList 対象の点群のファイルパス
   */
  public autoFocus(filePathList: string[]): void {
    // 視点自動設定対象の点群位置取得
    const min: THREE.Vector3 = new THREE.Vector3(
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
    );
    const max: THREE.Vector3 = new THREE.Vector3(
      Number.MIN_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
    );
    if (0 < filePathList.length) {
      for (const filePath of filePathList) {
        // 指定した点群を対象
        const pointSet = this.pointSetMap.get(filePath);
        if (pointSet) {
          min.min(pointSet.getMin());
          max.max(pointSet.getMax());
        }
      }
    } else {
      for (const pointSet of this.pointSetMap.values()) {
        // 表示中の点群を対象
        if (pointSet.getVisibleStatus()) {
          min.min(pointSet.getMin());
          max.max(pointSet.getMax());
        }
      }
    }

    // すべての点群を囲む矩形の中心
    const focus = max.clone().add(min).divideScalar(2.0);

    // 表示している点群領域の対角線の長さ
    const diagonal = max.clone().sub(min).length();

    // カメラの視野角
    const fovRad = THREE.MathUtils.degToRad(this.camera.getFov());

    // カメラの距離を計算
    const distance = (diagonal / 2) * (1 / Math.tan(fovRad / 2)) * AUTO_FOCUS_PARAM.OFFSET;

    // 視点位置算出
    const direction = new THREE.Vector3(AUTO_FOCUS_PARAM.X_DIR, AUTO_FOCUS_PARAM.Y_DIR, AUTO_FOCUS_PARAM.Z_DIR);
    const eye = focus.clone().add(direction.multiplyScalar(distance));

    // 注視点位置変更
    this.controls.setFocus(focus);

    // カメラ位置変更
    this.controls.setEye(eye);
  }

  /**
   * 表示最大点数の更新処理
   */
  private updateViewPointNum(): void {
    // 現在時刻取得
    const time: number = performance.now();

    // 視点移動時は履歴破棄⇒移動完了後に蓄積開始
    if (this.controls.isEyeMoving() || this.controls.isZooming()) {
      this.prevTime = time;
      this.viewPointHistory = [];
      this.fpsHistory = [];
      this.viewPointAvgHistory = [];
      return;
    }

    // 描画点数保持
    this.viewPointHistory.push(this.renderer.getRenderingInfo().points);

    // 前回処理から一定時間経過
    if (time >= this.prevTime + 1000) {
      const frames: number = this.viewPointHistory.length;
      const viewPointSum: number = this.viewPointHistory.reduce((a, b) => a + b, 0);

      // FPS算出
      const fps: number = (frames * 1000) / (time - this.prevTime);

      // 履歴情報更新定義
      const historyUpdate = (histroy: number[], value: number) => {
        if (HISTORY_ARRAY_SIZE <= histroy.length) {
          histroy.shift();
        }
        histroy.push(value);
      };

      // FPS情報保持
      historyUpdate(this.fpsHistory, fps);

      // 平均処理点数保持
      const avgPointNum: number = viewPointSum / frames;
      historyUpdate(this.viewPointAvgHistory, avgPointNum);

      // FPS情報履歴の標準偏差算出
      const length = this.fpsHistory.length;
      const mean = this.fpsHistory.reduce((sum, value) => sum + value, 0) / length;
      const variance = this.fpsHistory.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / length;
      const std: number = Math.sqrt(variance);

      // FPS情報履歴の標準偏差による変化判定
      if (std < 1.5 && fps < 50 && HISTORY_ARRAY_SIZE <= this.fpsHistory.length) {
        // 標準偏差閾値未満(FPSの変動率が小さい) && FPSが低い
        // 表示点数が少ない場合やマシンスペック高い場合の60FPSから点数算出すると誤った点数になる
        const avgViewPointNum: number =
          this.viewPointAvgHistory.reduce((sum, value) => sum + value, 0) / this.viewPointAvgHistory.length;
        const avgFps: number = this.fpsHistory.reduce((sum, value) => sum + value, 0) / this.fpsHistory.length;

        // 点数丸め処理
        const roundPointNum = (value: number) => {
          const factor: number = Math.pow(10, 6);
          return Math.round(value / factor) * factor;
        };

        // 間引き方式に応じて処理
        if (this.viewStatus === LOD_MODE.DYNAMIC) {
          const viewPointNum: number = roundPointNum(avgViewPointNum * (avgFps / DYNAMIC_BASE_FPS));
          if (viewPointNum !== this.dynamicViewMaxPointNum) {
            Logging.debug(LOG_CONF.DEBUG_DYNAMIC_VIEW_POINT_NUM, viewPointNum.toString());
            this.dynamicViewMaxPointNum = viewPointNum;
          }
        } else {
          const viewPointNum: number = roundPointNum(avgViewPointNum * (avgFps / STATIC_BASE_FPS));
          if (viewPointNum !== this.staticViewMaxPointNum) {
            Logging.debug(LOG_CONF.DEBUG_STATIC_VIEW_POINT_NUM, viewPointNum.toString());
            this.staticViewMaxPointNum = viewPointNum;
          }
        }
      }

      // FPS算出用変数初期化
      this.prevTime = time;
      this.viewPointHistory = [];
    }
  }

  /**
   * 3D空間の定周期描画処理を実行する。処理完了後に本処理をrequestAnimationFrameに登録する。
   */
  public animation(): void {
    Logging.trace(LOG_CONF.TRACE_START_ANIMATION);

    // 連動・独立制御
    if (this.sync) {
      // 現在の視点・注視点を保持
      const controlEye: THREE.Vector3 = this.controls.getEye();
      const controlFocus: THREE.Vector3 = this.controls.getFocus();

      // 視点・注視点に変化があれば連動
      if (this.eye.distanceTo(controlEye) > 0 || this.focus.distanceTo(controlFocus) > 0) {
        this.sync.update(this);
      }

      // 現在の視点・注視点を格納
      this.eye.copy(controlEye);
      this.focus.copy(controlFocus);
    }

    // 最大表示点数更新
    this.updateViewPointNum();

    // 視点注視点更新
    this.controls.update();

    // シーン更新
    this.scene.update(this.container);

    // 範囲選択処理
    this.pointMeasure.updateRangeSelectionView();

    // 点群間引き表示
    this.lodAnimation();

    // FPS表示更新
    if (this.stats) {
      this.stats.update();
    }

    // 次回処理の呼び出し
    this.animationFrameId = window.requestAnimationFrame(() => {
      this.animation();
    });
  }

  /************************************************************************************/
  // 間引き表示
  /************************************************************************************/

  /**
   * 間引き表示の方式を設定する。
   * @param mode 間引き表示方式(0: 動的間引き、1: 広域間引き、2: 深さ指定間引き)
   * @throws 設定可能方式以外の数値を設定
   */
  public setLodMode(mode: number): void {
    // 間引き方式変更時に表示最大点数パラメータ初期化
    this.fpsHistory = [];
    this.viewPointAvgHistory = [];

    // 間引き方式一覧
    const modes: number[] = Object.values(LOD_MODE);
    if (FOR_DEBUG) {
      // デバッグ処理時は指定深さ間引き処理を許容
      modes.push(-1);
    }
    // 間引き方式設定
    if (modes.includes(mode)) {
      this.lodMode = mode;
      Logging.info(LOG_CONF.INFO_SET_LOD_MODE, mode.toString());
    } else {
      const message = Logging.error(LOG_CONF.ERROR_LOD_MODE, mode.toString());
      throw new Error(message);
    }
  }

  /**
   * 選択中の間引き表示の方式を取得する。
   * @returns 間引き表示方式(0: 動的間引き、1: 広域間引き、2: 深さ指定間引き)
   */
  public getLodMode(): number {
    return this.lodMode;
  }

  /**
   * 間引き表示の深さ指定間引きのCOPCのノード深さを設定する。
   * @param depth 表示するCOPCのノード深さ
   * @throws 負数を設定
   */
  public setLodCopcDepth(depth: number): void {
    if (depth >= 0) {
      this.viewCopcDepth = depth;
      Logging.info(LOG_CONF.INFO_SET_LOD_DEPTH, depth.toString());
    } else {
      const message = Logging.error(LOG_CONF.ERROR_LOD_DEPTH, depth.toString());
      throw new Error(message);
    }
  }

  /**
   * 選択中の間引き表示の深さ指定間引きのCOPCのノード深さを取得する。
   * @returns COPCのノード深さ
   */
  public getLodCopcDepth(): number {
    return this.viewCopcDepth;
  }

  /**
   * 選択中の間引き表示で点群の表示状態を更新する
   */
  private lodAnimation(): void {
    // 表示対象点群のノード一覧取得
    let maxDepth: number = 0;
    const nodeInfoList: NodeInfo[] = [];
    for (const pointSet of this.pointSetMap.values()) {
      if (pointSet.getVisibleStatus()) {
        // 最大深さ
        maxDepth = Math.max(maxDepth, pointSet.getMaxDepth());

        // ノード一覧
        const list: NodeInfo[] = pointSet.getNodeInfoList();
        nodeInfoList.push(...list);
      }
    }

    // 各ノードのビューエリア内の存在状態(視野内か否か)を更新
    // 計算量削減のために事前更新して内部で結果を保持しておく
    for (const nodeInfo of nodeInfoList) {
      nodeInfo.calcExistInViewArea(this.camera);
    }

    // 設定に応じた間引き表示
    switch (this.lodMode) {
      case -1: {
        // デバッグ処理用
        // 間引きなし表示(指定した深さまでの点群を表示)
        this.viewStatus = -1;
        this.setPointVisibleUntilDepth(this.viewCopcDepth);
        break;
      }
      case LOD_MODE.DYNAMIC: {
        // 動的間引き表示
        Logging.trace(LOG_CONF.TRACE_DYNAMIC_LOD);
        if (this.controls.isEyeMoving() || this.controls.isZooming()) {
          // 視点移動中やズーム操作⇒広域間引き表示
          this.setVisibleSameDepth(nodeInfoList, maxDepth);
        } else {
          // 視点停止中 → 動的間引き表示
          this.lodDynamic(nodeInfoList, maxDepth);
        }
        break;
      }
      case LOD_MODE.WIDE_AREA: {
        // 広域間引き表示
        Logging.trace(LOG_CONF.TRACE_WIDE_LOD);
        this.setVisibleSameDepth(nodeInfoList, maxDepth);
        break;
      }
      case LOD_MODE.DEPTH: {
        // 深さ指定間引き表示
        Logging.trace(LOG_CONF.TRACE_DEPTH_LOD);
        this.lodDepth(nodeInfoList);
        break;
      }
      default:
        // 異常値の場合は広域間引き表示で処理
        Logging.error(LOG_CONF.ERROR_LOD_MODE, this.lodMode.toString());
        this.setVisibleSameDepth(nodeInfoList, maxDepth);
        break;
    }
  }

  /**
   * 非表示点群の状態を更新(非表示化と優先度更新)する
   */
  private updateInvisiblePointState(): void {
    // 非表示になった点群のオブジェクト自体を非表示化
    for (const pointSet of this.pointSetMap.values()) {
      if (!pointSet.getVisibleStatus()) {
        pointSet.setVisibleDepth(-1);
      }
    }

    // 非表示対象のノードの優先度を更新しておく
    for (const pointSet of this.pointSetMap.values()) {
      if (pointSet.getVisibleStatus()) {
        continue;
      }

      // 非表示のノードは優先度を深さを考慮した負数に設定
      const nodeInfoList: NodeInfo[] = pointSet.getNodeInfoList();
      for (const nodeInfo of nodeInfoList) {
        const depth: number = nodeInfo.getDepth();
        nodeInfo.setPriority(-(depth + 1));
      }
    }
  }

  /**
   * ノードの表示優先度でノード一覧を降順(値が大きいほど優先度が高く)にソート(挿入ソート)する。
   * @param nodeInfoList ソート対象のノード一覧
   * @returns ソート結果のノード一覧
   */
  private sortNodeInfoByPriority(nodeInfoList: NodeInfo[]): NodeInfo[] {
    for (let i = 1; i < nodeInfoList.length; i++) {
      const current: NodeInfo = nodeInfoList[i];
      let j: number = i - 1;
      while (j >= 0 && nodeInfoList[j].getPriority() < current.getPriority()) {
        nodeInfoList[j + 1] = nodeInfoList[j];
        j--;
      }
      nodeInfoList[j + 1] = current;
    }
    return nodeInfoList;
  }

  /**
   * 指定した深さまでの点群を表示する
   * @param depth 表示深さ
   */
  private setPointVisibleUntilDepth(depth: number): void {
    for (const pointSet of this.pointSetMap.values()) {
      if (pointSet.getVisibleStatus()) {
        pointSet.setVisibleDepth(depth);
      } else {
        pointSet.setVisibleDepth(-1);
      }
    }
  }

  /**
   * 点群を広域間引きで表示する。
   * @param nodeInfoList 表示対象のノード一覧
   * @param maxDepth 最大深さ
   */
  private setVisibleSameDepth(nodeInfoList: NodeInfo[], maxDepth: number): void {
    this.viewStatus = LOD_MODE.WIDE_AREA;

    // 表示最大点数設定
    let staticViewMaxPointNum: number = this.staticViewMaxPointNum;
    if (this.sync) {
      staticViewMaxPointNum = this.staticViewMaxPointNum / 2;
    }

    // 各深さでの点数算出
    const pointNumEachDepth: number[] = new Array(maxDepth + 1).fill(0);
    for (const nodeInfo of nodeInfoList) {
      if (nodeInfo.isDisplayTarget()) {
        pointNumEachDepth[nodeInfo.getDepth()] += nodeInfo.getPointNum();
      }
    }

    // 表示最大点数を超過しない深さを算出
    let showDepth: number = 0;
    let pointNum: number = 0;
    for (let depth = 0; depth <= maxDepth; depth++) {
      if (staticViewMaxPointNum < pointNum + pointNumEachDepth[depth]) {
        break;
      }
      showDepth = depth;
      pointNum += pointNumEachDepth[depth];
    }

    // 指定した深さで表示
    Logging.trace(LOG_CONF.TRACE_SAME_DEPTH_DISP, showDepth.toString());
    this.setPointVisibleUntilDepth(showDepth);

    // 優先度算出
    // 同じ深さにおいては距離が大きいほど優先度を低くする
    // 逆数とすることで値が大きいほど優先度を高く、値が0に近いほど優先度を低くする
    const eye: THREE.Vector3 = this.controls.getEye();
    for (const nodeInfo of nodeInfoList) {
      const depth: number = nodeInfo.getDepth();
      const dist: number = nodeInfo.getDistanceToCenter(eye);
      const priority: number = 1 / (depth + dist / (1.0 + dist));
      nodeInfo.setPriority(priority);
    }
    // 優先度でソート
    this.loadNodeList = this.sortNodeInfoByPriority(this.loadNodeList);
  }

  /**
   * ビューエリア内の点群が狭い範囲の表示のみ(表示点数が閾値以下)であるか判定する
   * @param nodeInfoList 表示対象のノード一覧
   * @returns 表示範囲の状態(true：狭範囲の点群表示、false：広範囲の点群表示)
   */
  private isViewNarrowRange(nodeInfoList: NodeInfo[]): boolean {
    // 表示最大点数設定(2画面分割の場合半数)
    let dynamicViewMaxPointNum: number = this.dynamicViewMaxPointNum;
    if (this.sync) {
      dynamicViewMaxPointNum = this.dynamicViewMaxPointNum / 2;
    }

    // 表示対象の合計点数算出
    let pointNum: number = 0;
    for (const nodeInfo of nodeInfoList) {
      if (nodeInfo.isDisplayTarget()) {
        // 表示対象(視野内ノード&&オブジェクト存在)
        pointNum += nodeInfo.getPointNum();
      }
    }

    if (dynamicViewMaxPointNum < pointNum) {
      return false;
    } else {
      return true;
    }
  }

  /**
   * 視点位置周辺の最大深さを取得する
   * @param intersections 視線上ノードオブジェクト一覧
   * @returns 視点位置周辺の最大深さ
   */
  private getMaxDepthAroundView(intersections: Intersection<Object3D>[]): number {
    let maxDepth: number = 0;
    for (const intersection of intersections) {
      // 最初のノードから一定距離(0.5m)以上ずれたら探索終了
      // 各ノードは隣接しているため少しでも離れたらノードの位置が大きくずれたことなるため
      if (0.5 < intersection.distance - intersections[0].distance) {
        break;
      }

      // 最大深さ取得
      const object: THREE.Mesh = intersection.object as THREE.Mesh;
      const depth: number = object.geometry.getAttribute('depth').getX(0);
      if (maxDepth < depth) {
        maxDepth = depth;
      }
    }

    return maxDepth;
  }

  /**
   * ビューエリア内の点群が視点から遠い位置にあるか判定する
   * @param intersections 視線上ノードオブジェクト一覧
   * @returns 点群表示位置(true：点群位置が遠い、false：点群位置が近い)
   */
  private isFarFromPoints(intersections: Intersection<Object3D>[]): boolean {
    // 点群全体位置算出
    const pcMinPos = new THREE.Vector3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    const pcMaxPos = new THREE.Vector3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
    for (const pointSet of this.pointSetMap.values()) {
      if (pointSet.getVisibleStatus()) {
        pcMinPos.min(pointSet.getMin());
        pcMaxPos.max(pointSet.getMax());
      }
    }
    // 点群サイズの最大値算出
    const pcSize: THREE.Vector3 = pcMaxPos.clone().sub(pcMinPos);
    const cubeSize: number = Math.max(pcSize.x, Math.max(pcSize.y, pcSize.z));

    // 視点が点群全体を囲む矩形内部に存在するか否か判定
    const box: THREE.Box3 = new THREE.Box3(pcMinPos, pcMaxPos);
    const isInside: boolean = box.containsPoint(this.controls.getEye());

    let isFar: boolean = false;
    if (!isInside) {
      // 視点が点群を囲む矩形外部に存在
      // 最初に衝突したノードのオブジェクトが一定距離以上(点群全体サイズの半分)
      // 離れている場合に視点が点群から離れていると判定
      if (cubeSize / 2 < intersections[0].distance) {
        isFar = true;
      }
    }

    return isFar;
  }

  /**
   * 視点に近い領域ほど深さの深いノードを表示状態にし、視点から遠ざかるにつれて深さの浅いノードのみを表示状態にする。
   * @param nodeInfoList 表示対象のノード一覧
   * @param maxDepth 最大深さ
   * @param aroundDepth 視点周辺の深さ
   */
  private setVisibleGradation(nodeInfoList: NodeInfo[], maxDepth: number, aroundDepth: number): void {
    // 表示最大点数設定(2画面分割の場合半数)
    let dynamicViewMaxPointNum: number = this.dynamicViewMaxPointNum;
    if (this.sync) {
      dynamicViewMaxPointNum = this.dynamicViewMaxPointNum / 2;
    }

    // 視点周辺の深さを比零化
    if (aroundDepth === 0) {
      aroundDepth = 1.0;
    }

    // 係数算出用の基準距離算出
    let baseDistance: number = 0;
    for (const pointSet of this.pointSetMap.values()) {
      if (pointSet.getVisibleStatus()) {
        const pointSize: THREE.Vector3 = pointSet.getMax().sub(pointSet.getMin());
        const size: number = Math.max(pointSize.x, pointSize.y, pointSize.z);
        const nodeCount: number = Math.pow(2, pointSet.getMaxDepth());
        const maxSize: number = size / nodeCount;
        baseDistance = Math.max(baseDistance, maxSize);
      }
    }

    // 視点位置の点群密度(周辺深さ)に応じて係数決定
    // 視点周辺の点群密度が高いほど係数を大きくする
    // 最大深さのノードサイズ複数分係数を大きくする
    const coef: number = (maxDepth / aroundDepth) * (baseDistance * 2.5);
    const eye: THREE.Vector3 = this.controls.getEye();

    // 視点位置と各ノード中心座標の距離を優先度に設定
    for (const nodeInfo of nodeInfoList) {
      // 視点とノード距離に応じてべき指数決定
      // 視点からのノード位置が大きくなるほど指数値を大きくする
      const exp: number = nodeInfo.getDistanceToCenter(eye) / coef;

      // 優先度算出
      // 深さ + 深さに依存した重み(上記計算式より視点から離れるほど数値が大きくなる。1より大きくなる)
      // 逆数とすることで上記の重みの値が小さい(視点から近い)ほど優先度を高く、値が大きい(視点から遠い)ほど優先度を低くする
      const priority: number = 1.0 / (nodeInfo.getDepth() + Math.pow(1.0 + nodeInfo.getDepth() / 10, exp));
      nodeInfo.setPriority(priority);
    }

    // 優先度でソート
    this.loadNodeList = this.sortNodeInfoByPriority(this.loadNodeList);

    // 表示制御
    let counter: number = 0;
    let visiblePointNum: number = 0;
    for (counter = 0; counter < this.loadNodeList.length; counter++) {
      const nodeInfo: NodeInfo = this.loadNodeList[counter];

      // 非表示対象の点群は非表示設定
      if (!nodeInfo.isDisplayTarget()) {
        nodeInfo.setPointObjectVisible(false);
        continue;
      }

      // 表示したら表示最大点数を超過する場合表示設定終了
      if (dynamicViewMaxPointNum < visiblePointNum + nodeInfo.getPointNum()) {
        break;
      }

      // 表示設定
      nodeInfo.setPointObjectVisible(true);
      visiblePointNum += nodeInfo.getPointNum();
    }

    // 表示最大点数を超過した点群は非表示設定
    for (let i = counter; i < this.loadNodeList.length; i++) {
      this.loadNodeList[i].setPointObjectVisible(false);
    }
  }

  /**
   * 点群を動的間引きで表示する。
   * @param nodeInfoList 表示対象のノード一覧
   * @param maxDepth 最大深さ
   */
  private lodDynamic(nodeInfoList: NodeInfo[], maxDepth: number): void {
    this.viewStatus = LOD_MODE.DYNAMIC;

    // 視線方向ベクトル上に存在するノードオブジェクト取得
    const center = new THREE.Vector2(this.container.clientWidth / 2.0, this.container.clientHeight / 2.0);
    const intersectNodeBoxes: Intersection<Object3D>[] = this.scene.getIntersectNodes(center);

    // 注視点ノードがみつかった場合
    if (0 < intersectNodeBoxes.length) {
      // 視点が点群から離れている場合広域間引き表示
      const isFarFromPoints: boolean = this.isFarFromPoints(intersectNodeBoxes);
      if (isFarFromPoints) {
        this.setVisibleSameDepth(nodeInfoList, maxDepth);
        return;
      }

      // 見ている範囲が狭い(視野内の点数が少ない)場合全点表示
      const viewOnlyNeighbor: boolean = this.isViewNarrowRange(nodeInfoList);
      if (viewOnlyNeighbor) {
        Logging.trace(LOG_CONF.TRACE_ALL_POINTS_DISP);
        this.setPointVisibleUntilDepth(maxDepth);
        return;
      }

      // 奥行方向に見ている場合奥行き表示
      Logging.trace(LOG_CONF.TRACE_GRADATION_DISP);
      const maxDepthAroundView: number = this.getMaxDepthAroundView(intersectNodeBoxes);
      this.setVisibleGradation(nodeInfoList, maxDepth, maxDepthAroundView);
    } else {
      // 視線上にノードオブジェクトがない場合広域間引き表示
      this.setVisibleSameDepth(nodeInfoList, maxDepth);
      return;
    }
  }

  /**
   * 点群を深さ指定間引きで表示する。
   * @param nodeInfoList 表示対象のノード一覧
   */
  private lodDepth(nodeInfoList: NodeInfo[]): void {
    this.viewStatus = LOD_MODE.DEPTH;

    // 表示最大点数設定(2画面分割の場合半数)
    let staticViewMaxPointNum: number = this.staticViewMaxPointNum;
    if (this.sync) {
      staticViewMaxPointNum = this.staticViewMaxPointNum / 2;
    }

    // 優先度算出
    // 注視点と各ノード中心座標の距離を優先度に設定
    // 逆数とすることで値が大きいほど優先度を高く、値が0に近いほど優先度を低くする
    const focus: THREE.Vector3 = this.controls.getFocus();
    for (const nodeInfo of nodeInfoList) {
      const dist: number = nodeInfo.getDistanceToCenter(focus);
      nodeInfo.setPriority(1.0 / (dist + 1.0));
    }
    // 親ノードの優先度は子ノードの優先度で更新
    for (const nodeInfo of nodeInfoList) {
      nodeInfo.overWriteParentPriority();
    }

    // 優先度でソート
    this.loadNodeList = this.sortNodeInfoByPriority(this.loadNodeList);

    // 表示制御
    let counter: number = 0;
    let visiblePointNum: number = 0;
    for (counter = 0; counter < this.loadNodeList.length; counter++) {
      const nodeInfo: NodeInfo = this.loadNodeList[counter];

      // 非表示対象の点群は非表示設定
      if (!nodeInfo.isDisplayTarget()) {
        nodeInfo.setPointObjectVisible(false);
        continue;
      }

      // 指定深さを超過する点群は非表示設定
      if (this.viewCopcDepth < nodeInfo.getDepth()) {
        nodeInfo.setPointObjectVisible(false);
        continue;
      }

      // 表示したら表示最大点数を超過する場合表示設定終了
      if (staticViewMaxPointNum < visiblePointNum + nodeInfo.getPointNum()) {
        break;
      }

      // 表示設定
      nodeInfo.setPointObjectVisible(true);
      visiblePointNum += nodeInfo.getPointNum();
    }

    // 表示最大点数を超過した点群は非表示設定
    for (let i = counter; i < this.loadNodeList.length; i++) {
      this.loadNodeList[i].setPointObjectVisible(false);
    }
  }
}
