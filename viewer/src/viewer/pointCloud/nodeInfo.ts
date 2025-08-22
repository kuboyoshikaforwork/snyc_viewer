/**
 * @fileoverview COPCの各ノードを管理するクラスの定義
 * @author Kota Kubota(SEQ)
 * @created 2025/05/16
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import * as THREE from 'three';
import {ViewCamera} from '../three/viewCamera';
import {COPCScene} from '../copc/copcScene';
import {CopcInfo, LasHeader} from './copcInfo';
import {PointDef} from './pointDef';
import {POINT_DATA_VIEW_SIZE} from '../util/constant';
import {Logging} from '../log/logging';
import {LOG_CONF} from '../log/logConf';
import {IndexedDbUtil} from '../util/indexedDbUtil';

/** 点群ロード状態 */
export const LOAD_STATE = {
  NOLOADED: -1, // 未ロード
  LOADING: 0, // ロード中
  LOADED: 1, // ロード完
};

/**
 * ノードの情報を管理するクラス
 */
export class NodeInfo {
  /** ノードのキー */
  private key: string = '';
  /** COPCデータ管理オブジェクト */
  private copc: CopcInfo;
  /** 3D空間の点群表示シーンオブジェクト */
  private scene: COPCScene;

  /** ノードの深さ */
  private depth: number = 0;
  /** ノードのOctree構造での位置 */
  private idx: THREE.Vector3 = new THREE.Vector3();

  /** ノードの3D中心座標 */
  private center: THREE.Vector3 = new THREE.Vector3();

  /** ノードの最小座標 */
  private nodeMin: THREE.Vector3 = new THREE.Vector3();
  /** ノードの最大座標 */
  private nodeMax: THREE.Vector3 = new THREE.Vector3();
  /** ノードがビューエリア内に含まれているか */
  private isInViewArea: boolean = false;

  /** ノードのオブジェクト */
  private nodeBox: THREE.Mesh | undefined = undefined;

  /** 点群オブジェクト */
  private pointObject: THREE.Points | undefined = undefined;

  // ロード状態(ロード中：true、false：非ロード中)
  public loading: boolean = false;

  /** ノードが持つ点数 */
  private pointNum: number = -1;

  /** 親ノード */
  private parent: NodeInfo | undefined = undefined;
  /** 子ノード */
  private children: (NodeInfo | undefined)[] = new Array(8);

  /** 間引き表示時の優先度(値が大きいほど優先度が高い) */
  private priority: number = Number.MIN_SAFE_INTEGER;

  /**
   * コンストラクタ
   * @param key ノードのキー
   * @param copc COPCのデータを管理するオブジェクト
   * @param scene 3D空間の点群表示シーンオブジェクト
   */
  constructor(key: string, copc: CopcInfo, scene: COPCScene) {
    this.key = key;
    this.copc = copc;
    this.scene = scene;

    // ノード位置情報設定
    const tmp: string[] = this.key.split('-');
    this.depth = Number(tmp[0]);
    this.idx.set(Number(tmp[1]), Number(tmp[2]), Number(tmp[3]));

    // 深さの負数を初期値に設定
    this.priority = -(this.depth + 1);

    // ノードがもつ点数
    this.pointNum = this.copc.getNodePointNum(this.key);

    // ノード情報設定
    const nodeCount: number = Math.pow(2, this.depth);
    const cubeSize: number = this.copc.getCubeSize();
    const cubeCenter: THREE.Vector3 = this.copc.getCubeCenter();
    const nodeBoxSize: number = cubeSize / nodeCount;
    const halfSize: number = nodeBoxSize / 2;

    // 対象深さのノード(0,0,0)の中心座標
    const base: THREE.Vector3 = new THREE.Vector3(
      cubeCenter.x - (nodeCount / 2) * nodeBoxSize + nodeBoxSize / 2,
      cubeCenter.y - (nodeCount / 2) * nodeBoxSize + nodeBoxSize / 2,
      cubeCenter.z - (nodeCount / 2) * nodeBoxSize + nodeBoxSize / 2,
    );

    // ノード3次元情報設定
    this.center.set(
      base.x + nodeBoxSize * this.idx.x,
      base.y + nodeBoxSize * this.idx.y,
      base.z + nodeBoxSize * this.idx.z,
    );
    this.nodeMin.set(this.center.x - halfSize, this.center.y - halfSize, this.center.z - halfSize);
    this.nodeMax.set(this.center.x + halfSize, this.center.y + halfSize, this.center.z + halfSize);

    // ノードオブジェクトをシーンに追加
    this.addNodeObject(this.center, nodeBoxSize, this.depth);
  }

  /**
   * ノードのキーを取得する
   * @returns ノードのキー
   */
  public getKey(): string {
    return this.key;
  }

  /**
   * ノードの深さを取得する
   * @returns 深さ
   */
  public getDepth(): number {
    return this.depth;
  }

  /**
   * ノードのOctree構造の位置情報を取得する
   * @returns 位置情報
   */
  public getXYZ(): THREE.Vector3 {
    return this.idx;
  }

  /**
   * ノードが持つ点群の点数を取得する
   * @returns 点数
   */
  public getPointNum(): number {
    return this.pointNum;
  }

  /**
   * 指定した3D座標からノードの3D中心座標までの距離を取得する
   * @param position 3D座標
   * @returns 距離
   */
  public getDistanceToCenter(position: THREE.Vector3): number {
    return position.distanceTo(this.center);
  }

  /**
   * ノードが表示対象であるか取得する。
   * 点群オブジェクトが表示対象かつ生成済かつビューエリア内のノードが対象
   * @returns 表示対象有無(true:表示対象、false:表示対象外)
   */
  public isDisplayTarget(): boolean {
    // シーンに点群オブジェクトがない場合は対象外
    if (!this.pointObject) {
      return false;
    }

    // ビューエリア外は対象外
    if (!this.isInViewArea) {
      return false;
    }

    // 優先度負数は対象外
    if (this.priority < 0) {
      return false;
    }

    return true;
  }

  /**
   * 点群のロード状態を取得する(シーンにオブジェクトがある状態をロード済とする)
   * @returns 点群ロード状態(-1:未ロード、0:ロード中、1:ロード完)
   */
  public getPointLoadState(): number {
    // 点群オブジェクトがある場合はロード済
    if (this.pointObject) {
      return LOAD_STATE.LOADED;
    }

    // 点群オブジェクトがない場合
    if (this.loading) {
      // ロード中
      return LOAD_STATE.LOADING;
    } else {
      // 未ロード
      return LOAD_STATE.NOLOADED;
    }
  }

  /**
   * 点群データがIndexedDBに格納されているか否か取得する
   * @returns 格納状態(true：格納済、false：未格納)
   */
  public async isDataStoredIndexedDB(): Promise<boolean> {
    const stored: boolean = await IndexedDbUtil.isDataStored(this.copc.getFilePath(), this.key);
    return stored;
  }

  /**
   * 生成したノードのオブジェクトと点群のオブジェクトを削除する
   */
  public clear(): void {
    this.removeNodeObject();
    this.removePointObject();

    Logging.debug(LOG_CONF.DEBUG_RELEASE_NODE_RESOURCE);
  }

  /**
   * ノードのメッシュオブジェクトを生成し、シーンに追加する
   * @param position オブジェクトを表示する3D座標
   * @param size ノードのサイズ
   * @param depth ノードの深さ
   */
  private addNodeObject(position: THREE.Vector3, size: number, depth: number): void {
    const geometry: THREE.BoxGeometry = new THREE.BoxGeometry(size, size, size);
    geometry.setAttribute('depth', new THREE.Int32BufferAttribute([depth], 1));
    const material: THREE.MeshBasicMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });

    this.nodeBox = new THREE.Mesh(geometry, material);
    this.nodeBox.position.set(position.x, position.y, position.z);
    this.nodeBox.visible = false;

    this.scene.addNodeScene(this.nodeBox);
  }

  /**
   * ノードのメッシュオブジェクトをシーンから削除する。
   */
  private removeNodeObject(): void {
    if (this.nodeBox) {
      this.scene.removeNodeScene(this.nodeBox);
      this.nodeBox = undefined;
    }
  }

  /**
   * 点群データから点群のオブジェクトを生成し、シーンに追加する。
   * @param pointData 点群データ
   * @param pointDef 点群の定義情報
   */
  public addPointObject(pointData: DataView, pointDef: PointDef): void {
    const geometry: THREE.BufferGeometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const intensities: number[] = [];
    const colors: number[] = [];
    const lutIndex: number[] = [];

    const length: number = pointData.byteLength / POINT_DATA_VIEW_SIZE;
    let offset: number = 0;
    for (let i = 0; i < length; i++) {
      offset = i * POINT_DATA_VIEW_SIZE;

      // position設定
      const X: number = pointData.getFloat64(offset + 0);
      const Y: number = pointData.getFloat64(offset + 8);
      const Z: number = pointData.getFloat64(offset + 16);
      positions.push(X, Y, Z);

      // intensity設定
      const intensity: number = pointData.getUint16(offset + 24);
      intensities.push(intensity);

      // color設定
      const R: number = pointData.getInt32(offset + 49);
      const G: number = pointData.getInt32(offset + 53);
      const B: number = pointData.getInt32(offset + 57);
      if (R !== -1 && G !== -1 && B !== -1) {
        colors.push(R, G, B);
      } else {
        colors.push(intensity, intensity, intensity);
      }

      // index設定
      const index1: number = 0 <= pointData.getInt32(offset + 65) ? pointData.getInt32(offset + 65) : 0;
      const index2: number = 0 <= pointData.getInt32(offset + 69) ? pointData.getInt32(offset + 69) : 0;
      const index3: number = 0 <= pointData.getInt32(offset + 73) ? pointData.getInt32(offset + 73) : 0;
      lutIndex.push(index1, index2, index3);
    }

    // attribute設定
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('intensity', new THREE.Int32BufferAttribute(intensities, 1));
    geometry.setAttribute('color', new THREE.Uint16BufferAttribute(colors, 3));
    geometry.setAttribute('lutIndex', new THREE.Uint16BufferAttribute(lutIndex, 3));

    // オブジェクト生成
    this.pointObject = new THREE.Points(geometry, pointDef.getMaterial());
    this.pointObject.visible = false;

    this.scene.addPointsScene(this.pointObject);
  }

  /**
   * 点群オブジェクトをシーンから削除する。
   */
  public removePointObject(): void {
    if (this.pointObject) {
      this.scene.removePointsScene(this.pointObject);
      this.pointObject = undefined;
    }
  }

  /**
   * ノードがもつ点群データを取得する
   * @param worker 点群データロードワーカー
   * @param eye 視点位置(未定義の場合IndexedDBへのデータ追加無)
   * @param posInfos 点群位置一覧(未定義の場合IndexedDBへのデータ追加無)
   * @param addIndexedDB IndexedDBへのデータ追加有無(未定義の場合追加しない)
   * @returns 点群データのバイナリデータ(取得失敗の場合未定義値)
   */
  public loadPointData(worker: Worker, eye?: number[], posInfos?: Map<string, number[]>, addIndexedDB?: boolean): void {
    // ロード中に設定
    this.copc.loadPointData(this.key, worker, eye, posInfos, addIndexedDB);
  }

  /**
   * ノードオブジェクトが一部でもビューエリアの範囲内(スクリーン上)に存在するか判定する
   * @param camera カメラオブジェクト
   */
  public calcExistInViewArea(camera: ViewCamera): void {
    if (this.nodeBox) {
      this.isInViewArea = camera.isBbExistInView(this.nodeBox);
    } else {
      this.isInViewArea = false;
    }
  }

  /**
   * ノードボックスが画面内に入っているかを取得する。
   * @returns ビューエリア内の存在状態(true: 画面内、false: 画面外)
   */
  public isExistInViewArea(): boolean {
    return this.isInViewArea;
  }

  /**
   *  点群データの表示制御をする。
   * @param visible 点群データの表示状態
   */
  public setPointObjectVisible(visible: boolean): void {
    if (this.pointObject) {
      this.pointObject.visible = visible;
    }
  }

  /**
   * 親ノードを設定する。
   * @param nodeInfo 親ノード
   */
  public setParent(nodeInfo: NodeInfo | undefined): void {
    this.parent = nodeInfo;
  }

  /**
   * 親ノードを取得する。
   * @returns 親ノード
   */
  public getParent(): NodeInfo | undefined {
    return this.parent;
  }

  /**
   * 子ノードを設定する。
   * @param idx 子ノードのインデックス番号
   * @param nodeInfo 子ノード
   */
  public setChild(idx: number, nodeInfo: NodeInfo | undefined): void {
    this.children[idx] = nodeInfo;
  }

  /**
   * 子ノードを取得する。
   * @returns 子ノード
   */
  public getChildren(): (NodeInfo | undefined)[] {
    return this.children;
  }

  /**
   * 優先度を設定する。
   * @param priority 表示優先度
   */
  public setPriority(priority: number): void {
    this.priority = priority;
  }

  /**
   * 優先度を取得する。
   * @returns 表示優先度
   */
  public getPriority(): number {
    return this.priority;
  }

  /**
   * 親ノードの優先度を更新する。
   */
  public overWriteParentPriority(): void {
    if (undefined === this.parent) {
      return;
    }

    // 値が大きいほど優先度が高い
    // 子ノードより親ノードの優先度の方が大きなるように更新
    const parentPriority: number = this.parent.getPriority();
    if (parentPriority === Number.MAX_SAFE_INTEGER || parentPriority < this.priority) {
      this.parent.setPriority(this.priority);
      this.parent.overWriteParentPriority();
    }
  }

  /**
   * 指定した3D空間の矩形範囲内にノードオブジェクトが一部でも存在するか取得する。
   * @param min 3D空間の最小位置
   * @param max 3D空間の最大位置
   * @returns 存在状態(true:範囲内、false:範囲外)
   */
  public isExistIn3DArea(min: THREE.Vector3, max: THREE.Vector3): boolean {
    const isIntersect: boolean =
      this.nodeMin.x <= max.x &&
      this.nodeMax.x >= min.x &&
      this.nodeMin.y <= max.y &&
      this.nodeMax.y >= min.y &&
      this.nodeMin.z <= max.z &&
      this.nodeMax.z >= min.z;

    return isIntersect;
  }

  /**
   * 当該ノードと子ノードを対象に指定した矩形範囲に少しでも存在するノード一覧を取得する
   * @param min 最小位置
   * @param max 最大位置
   * @param nodeInfoList 内部存在ノード一覧
   */
  public getNodesInShape(min: THREE.Vector3, max: THREE.Vector3, nodeInfoList: NodeInfo[]): void {
    if (this.isExistIn3DArea(min, max)) {
      // 対象ノードが指定した範囲内に存在 → 子ノードも含まれるため子ノード確認
      for (const node of this.children) {
        if (node) {
          node.getNodesInShape(min, max, nodeInfoList);
        }
      }
      nodeInfoList.push(this);
    }
  }

  /**
   * 引数の内外判定処理で内部に存在する点座標一覧を取得する。
   * @param matrix 座標移動変換行列
   * @param checkInOut 内外判定関数
   * @returns 点座標一覧
   */
  public getPointCoordInShape(
    matrix: THREE.Matrix4,
    checkInOut: (position: THREE.Vector4) => boolean,
  ): THREE.Vector3[] {
    const insideCoords: THREE.Vector3[] = [];
    const lasHeader: LasHeader | undefined = this.copc.getLasHeader();
    // 点データの内外判定
    if (this.pointObject && lasHeader) {
      const scale = lasHeader.scale;
      const positions = this.pointObject.geometry.getAttribute('position');
      const length = this.pointObject.geometry.getAttribute('position').count;
      for (let i = 0; i < length; i++) {
        const position = new THREE.Vector4(positions.getX(i), positions.getY(i), positions.getZ(i), 1.0);
        const clipPosition = position.applyMatrix4(matrix);
        const ret = checkInOut(clipPosition);
        if (ret) {
          // データサイズにより発生する値の誤差を解消するためのスケール変換処理
          const x = Math.round(positions.getX(i) / scale[0]) * scale[0];
          const y = Math.round(positions.getY(i) / scale[1]) * scale[1];
          const z = Math.round(positions.getZ(i) / scale[2]) * scale[2];
          insideCoords.push(new THREE.Vector3(x, y, z));
        }
      }
    }

    return insideCoords;
  }
}
