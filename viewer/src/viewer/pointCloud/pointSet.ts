/**
 * @fileoverview 1ファイルの点群を管理するクラスの定義
 * @author Kota Kubota(SEQ)
 * @created 2025/05/23
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import * as THREE from 'three';

import {CopcData, CopcInfo} from './copcInfo';
import {LOAD_STATE, NodeInfo} from './nodeInfo';
import {COPCScene} from '../copc/copcScene';
import {COPCUtil} from '../util/copcUtil';
import {Logging} from '../log/logging';
import {LOG_CONF} from '../log/logConf';

/**
 * @interface ファイル情報
 */
export interface FileInfo {
  filePath: string;
  pointNum: number;
  loadRate: number;
}

/**
 * 1ファイルの点群を管理するクラス
 */
export class PointSet {
  /** 点群のファイルパス */
  private filePath: string;

  /** 3D空間の点群表示シーンオブジェクト */
  private scene: COPCScene;

  /** COPCのデータを管理するオブジェクト */
  private copc: CopcInfo;

  /** ノードのキーの一覧 */
  private nodeKeyList: string[] = [];
  /** 点群データがもつノードオブジェクトのマップ */
  private nodeInfoMap: Map<string, NodeInfo> = new Map();

  /** 点群データの点数 */
  private pointNum: number = 0;
  /** 点群データの最小位置 */
  private min: THREE.Vector3 = new THREE.Vector3();
  /** 点群データの最大位置 */
  private max: THREE.Vector3 = new THREE.Vector3();
  /** 点群データの中心位置 */
  private center: THREE.Vector3 = new THREE.Vector3();
  /** 点群データの最大深さ */
  private maxDepth: number = 0;

  /** 点群データの表示状態 */
  private visible: boolean = false;

  /**
   * コンストラクタ
   * @param serverUrl 点群データを取得するサーバのURL
   * @param filePath ロードする点群のファイルパス
   * @param scene 3D空間の点群表示シーンオブジェクト
   * @param accessToken ユーザのアクセストークン
   */
  constructor(serverUrl: string, filePath: string, scene: COPCScene, accessToken: string) {
    const url: string = serverUrl + '/copc/' + filePath;
    this.filePath = filePath;
    this.copc = new CopcInfo(url, filePath, accessToken);
    this.scene = scene;
  }

  /**
   * COPCデータ管理オブジェクトを取得する。
   * @returns COPCデータ管理オブジェクト
   */
  public getCopc(): CopcInfo {
    return this.copc;
  }

  /**
   * 点群データの点数を取得する。
   * @returns 点群データの点数
   */
  public getPointNum(): number {
    return this.pointNum;
  }

  /**
   * 点群データが存在する矩形領域の最小位置を取得する。
   * @returns 最小位置
   */
  public getMin(): THREE.Vector3 {
    return this.min.clone();
  }

  /**
   * 点群データが存在する矩形領域の最大位置を取得する。
   * @returns 最大位置
   */
  public getMax(): THREE.Vector3 {
    return this.max.clone();
  }

  /**
   * 点群データが存在する矩形領域の中心位置を取得する。
   * @returns 中心位置
   */
  public getCenter(): THREE.Vector3 {
    return this.center.clone();
  }

  /**
   * 点群データの最大深さを取得する。
   * @returns 最大深さ
   */
  public getMaxDepth(): number {
    return this.maxDepth;
  }

  /**
   * ルートノードを取得する。
   * @returns ルートノード
   */
  public getRootNode(): NodeInfo | undefined {
    return this.nodeInfoMap.get('0-0-0-0');
  }

  /**
   * 点群ファイルの情報を取得する。
   * @returns 点群ファイル情報
   */
  public getFileInfo(): FileInfo {
    // ダウンロード割合算出
    let loadRate: number = 0;
    if (this.pointNum !== 0) {
      let total = 0;
      for (const nodeInfo of this.nodeInfoMap.values()) {
        if (nodeInfo.getPointLoadState() === LOAD_STATE.LOADED) {
          total += nodeInfo.getPointNum();
        }
      }
      loadRate = COPCUtil.roundPrecision((total / this.pointNum) * 100, 0);
    }
    const fileInfo: FileInfo = {
      filePath: this.filePath,
      pointNum: this.pointNum,
      loadRate: loadRate,
    };
    return fileInfo;
  }

  /**
   * 点群のロード処理を終了し、点群データを削除する。
   */
  public clear(): void {
    // 点群ロード処理の破棄
    this.copc.clear();

    // ノードオブジェクトの破棄
    for (const [key, nodeInfo] of this.nodeInfoMap) {
      nodeInfo.clear();
      this.nodeInfoMap.delete(key);
    }

    Logging.debug(LOG_CONF.DEBUG_RELEASE_POINT_CLOUD_RESOURCE);
  }

  /**
   * サーバから点群データのヘッダ情報を取得する
   * @throws サーバからの点群データの取得異常
   */
  public async load(): Promise<void> {
    // COPCヘッダ情報取得
    const copcHeader: CopcData = await this.copc.loadCopcHeader();
    this.nodeKeyList = copcHeader.nodeKeyList;
    this.pointNum = copcHeader.pointNum;
    this.min.set(copcHeader.min.x, copcHeader.min.y, copcHeader.min.z);
    this.max.set(copcHeader.max.x, copcHeader.max.y, copcHeader.max.z);
    this.center = this.min.clone().add(this.max).divideScalar(2.0);
    this.maxDepth = copcHeader.maxDepth;

    // ノード生成
    for (const nodeKey of this.nodeKeyList) {
      const nodeInfo: NodeInfo = new NodeInfo(nodeKey, this.copc, this.scene);
      this.nodeInfoMap.set(nodeKey, nodeInfo);
    }

    // ノードの親子関係を設定
    this.setNodeRelation();
  }

  /**
   * 点群データがもつノードオブジェクトの親子関係を設定する。
   */
  public setNodeRelation(): void {
    for (const nodeInfo of this.nodeInfoMap.values()) {
      const depth: number = nodeInfo.getDepth();
      const idx: THREE.Vector3 = nodeInfo.getXYZ();

      // 親の設定
      const parentKey: string =
        depth - 1 + '-' + Math.floor(idx.x / 2) + '-' + Math.floor(idx.y / 2) + '-' + Math.floor(idx.z / 2);
      nodeInfo.setParent(this.nodeInfoMap.get(parentKey));

      // 子の設定
      for (let i = 0; i < 8; i++) {
        const x = (i >> 2) & 1;
        const y = (i >> 1) & 1;
        const z = (i >> 0) & 1;
        const childx = idx.x * 2 + x;
        const childy = idx.y * 2 + y;
        const childz = idx.z * 2 + z;
        const childKey = depth + 1 + '-' + childx + '-' + childy + '-' + childz;
        nodeInfo.setChild(i, this.nodeInfoMap.get(childKey));
      }
    }
  }

  /**
   * 指定した深さまでのノードの点群を表示状態にする。負数を設定した場合、すべての点群を非表示にする。
   * @param depth 表示対象の深さ
   */
  public setVisibleDepth(depth: number): void {
    for (const nodeInfo of this.nodeInfoMap.values()) {
      if (nodeInfo.isDisplayTarget() && nodeInfo.getDepth() <= depth) {
        nodeInfo.setPointObjectVisible(true);
      } else {
        nodeInfo.setPointObjectVisible(false);
      }
    }
  }

  /**
   * 点群データ全体の表示状態を設定する。
   * @param visible 表示状態
   */
  public setVisibleStatus(visible: boolean): void {
    this.visible = visible;
  }

  /**
   * 点群データ全体の表示状態を取得する。
   * @returns 表示状態(true: 表示中、false: 非表示)
   */
  public getVisibleStatus(): boolean {
    return this.visible;
  }

  /**
   * ノードオブジェクト一覧を取得する。
   * @returns ノードオブジェクト一覧
   */
  public getNodeInfoList(): NodeInfo[] {
    const nodeInfoList = [];
    for (const nodeInfo of this.nodeInfoMap.values()) {
      nodeInfoList.push(nodeInfo);
    }
    return nodeInfoList;
  }
}
