/**
 * @fileoverview COPCのデータを管理するクラスの定義
 * @author Masaaki Takeuchi(MESW)
 * @created 2025/05/23
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import * as THREE from 'three';
import * as COPC from 'copc';
import {Logging} from '../log/logging';
import {LOG_CONF} from '../log/logConf';

/**
 * @interface LASヘッダ(legacy要素への対応)
 */
export interface LasHeader {
  fileSignature: 'LASF';
  fileSourceId: number;
  globalEncoding: number;
  projectId: string;
  majorVersion: number;
  minorVersion: number;
  systemIdentifier: string;
  generatingSoftware: string;
  fileCreationDayOfYear: number;
  fileCreationYear: number;
  headerLength: number;
  pointDataOffset: number;
  vlrCount: number;
  pointDataRecordFormat: number;
  pointDataRecordLength: number;
  legacyPointCount: number;
  legacyPointCountByReturn: number[];
  scale: COPC.Point;
  offset: COPC.Point;
  min: COPC.Point;
  max: COPC.Point;
  waveformDataOffset: number;
  evlrOffset: number;
  evlrCount: number;
  pointCount: number;
  pointCountByReturn: number[];
}

/**
 * @interface COPCヘッダ情報(LasHeaderへの対応)
 */
export interface CopcHeader {
  header: LasHeader; // LASヘッダ
  vlrs: COPC.Las.Vlr[]; // LAS可変長レコード
  info: COPC.Info; // COPC情報
  eb: COPC.Las.ExtraBytes[]; // 拡張データ項目
  wkt?: string; // 座標参照系情報
}

/**
 * @interface COPCデータの情報
 */
export interface CopcData {
  nodeKeyList: string[]; // ノードキーリスト
  pointNum: number; // 点数
  maxDepth: number; // 最大深さ
  min: THREE.Vector3; // 点群最小位置
  max: THREE.Vector3; // 点群最大位置
}

/**
 * @interface WebWorkerデータ授受情報
 */
export interface WorkerPostData {
  copcHeader: CopcHeader | undefined; // COPCヘッダ情報
  node: COPC.Hierarchy.Node | undefined; // ノード情報
  url: string; // 点群データのURL(ファイルパス含む)
  accessToken: string; // アクセストークン
  filePath: string; // ファイルパス
  key: string; // ノードキー
  eye?: number[]; // 視点位置
  posInfos?: Map<string, number[]>; // 各点群の中心座標
  addIndexedDB?: boolean; // IndexedDB追加フラグ
}

/**
 * COPCのデータを管理するクラス
 */
export class CopcInfo {
  /** 点群データのURL(ファイルパス含む) */
  private readonly url: string;

  /** ファイルパス */
  private readonly filePath: string;

  /** ユーザのアクセストークン */
  private readonly accessToken: string;

  /** COPCヘッダのオブジェクト */
  private copcHeader: CopcHeader | undefined = undefined;

  /** COPCの立方体の最小位置 */
  private cubeMinPos: THREE.Vector3 = new THREE.Vector3();
  /** COPCのキューブ最大位置 */
  private cubeMaxPos: THREE.Vector3 = new THREE.Vector3();
  /** COPCの立方体の中心座標 */
  private cubeCenter: THREE.Vector3 = new THREE.Vector3();
  /** COPCの立方体のサイズ */
  private cubeSize: number = 0;

  /** ノード情報管理マップ */
  private sortedNodeMap: Map<string, COPC.Hierarchy.Node> = new Map();

  /** リクエスト制御コントローラー */
  private controller: AbortController = new AbortController();

  /**
   * COPCInfoクラスのコンストラクタ
   * @param url 点群データのURL(ファイルパス含む)
   * @param filePath ファイルパス
   * @param accessToken ユーザのアクセストークン
   */
  constructor(url: string, filePath: string, accessToken: string) {
    this.url = url;
    this.filePath = filePath;
    this.accessToken = accessToken;
  }

  /**
   * ファイルパスを取得する
   * @returns ファイルパス
   */
  public getFilePath(): string {
    return this.filePath;
  }

  /**
   * 指定したノードの点数を取得する
   * @param nodeKey ノードのキー
   * @returns ノードの点数
   */
  public getNodePointNum(nodeKey: string): number {
    let pointNum = 0;
    if (this.sortedNodeMap.has(nodeKey)) {
      pointNum = this.sortedNodeMap.get(nodeKey)!.pointCount;
    }

    return pointNum;
  }

  /**
   * COPCのキューブ中心座標を取得する
   * @returns キューブ中心座標
   */
  public getCubeCenter(): THREE.Vector3 {
    return this.cubeCenter.clone();
  }

  /**
   * COPCのキューブサイズを取得する
   * @returns キューブサイズ
   */
  public getCubeSize(): number {
    return this.cubeSize;
  }

  /**
   * CopcInfoクラスが保持するオブジェクトを破棄する
   */
  public clear(): void {
    // リクエストの破棄
    this.controller.abort();
  }

  /**
   * LASのヘッダを取得する
   * @returns LASヘッダ(未取得の場合は未定義)
   */
  public getLasHeader(): LasHeader | undefined {
    if (this.copcHeader) {
      return JSON.parse(JSON.stringify(this.copcHeader.header));
    } else {
      return undefined;
    }
  }

  /**
   * LASの拡張データ項目を取得する
   * Extra Bytes:標準的なLASファイルの仕様に含まれていない追加の情報を格納するためのフィールド
   * @returns LASの拡張データ項目(未取得の場合は未定義)
   */
  public getLasExtraBytes(): COPC.Las.ExtraBytes[] | undefined {
    if (this.copcHeader) {
      return JSON.parse(JSON.stringify(this.copcHeader.eb));
    } else {
      return undefined;
    }
  }

  /**
   * LASの可変長レコードのヘッダを取得する
   * @param isExtended 拡張部であるかどうか
   * @returns LAS可変長レコードのヘッダ
   */
  private getLasVlrsHeader(isExtended: boolean): COPC.Las.Vlr[] | undefined {
    if (this.copcHeader) {
      const vlrs: COPC.Las.Vlr[] = [];
      for (const vlr of this.copcHeader.vlrs) {
        if (vlr.isExtended === isExtended) {
          vlrs.push(vlr);
        }
      }
      return JSON.parse(JSON.stringify(vlrs));
    } else {
      return undefined;
    }
  }

  /**
   * 可変長レコードのバイナリデータを取得する
   * @param isExtended 拡張部であるかどうか
   * @returns 可変長レコードのバイナリデータ(未取得の場合は未定義)
   */
  public async loadBinaryVlrs(isExtended: boolean): Promise<DataView | undefined> {
    // ロード対象の可変長レコード取得
    const loadVlrs = this.getLasVlrsHeader(isExtended);
    if (!loadVlrs) {
      return undefined;
    }

    if (this.copcHeader) {
      // リクエスト処理の生成
      const get = this.createCopcGetter(this.url, this.accessToken);

      // データ領域情報
      let copcOffset = isExtended ? this.copcHeader.header.evlrOffset : this.copcHeader.header.headerLength;
      const count = isExtended ? this.copcHeader.header.evlrCount : this.copcHeader.header.vlrCount;
      const headerLength = isExtended ? COPC.Las.Constants.evlrHeaderLength : COPC.Las.Constants.vlrHeaderLength;

      // 格納領域確保
      let vlrDataSize = 0;
      for (let i = 0; i < count; i++) {
        vlrDataSize += headerLength + loadVlrs[i].contentLength;
      }
      const binaryData = new Uint8Array(vlrDataSize);

      try {
        let binaryOffset = 0;
        for (let i = 0; i < count; i++) {
          // データサイズ(ヘッダ部＋データ部)
          const length = headerLength + loadVlrs[i].contentLength;
          const buffer = length ? await get(copcOffset, copcOffset + length) : new Uint8Array();
          copcOffset += length;

          binaryData.set(buffer, binaryOffset);
          binaryOffset += buffer.byteLength;
        }
      } catch {
        return undefined;
      }

      const dataView = new DataView(binaryData.buffer);
      return dataView;
    } else {
      return undefined;
    }
  }

  /**
   * COPCデータのヘッダ情報をロードする
   * @returns COPCデータの情報
   * @throws COPCヘッダ情報取得失敗
   */
  public async loadCopcHeader(): Promise<CopcData> {
    const nodeKeyList: string[] = [];
    const min = new THREE.Vector3();
    const max = new THREE.Vector3();
    let maxDepth = 0;
    let pointNum = 0;

    // COPCヘッダ情報取得
    this.copcHeader = await this.createCopc();
    if (this.copcHeader) {
      // ノード情報取得
      const hierarchyPage: COPC.Hierarchy.Subtree = await this.loadHierarchyPage(
        this.copcHeader.info.rootHierarchyPage,
      );
      const nodes: COPC.Hierarchy.Node.Map = hierarchyPage.nodes;
      const pages: COPC.Hierarchy.Page.Map = hierarchyPage.pages;

      // ノードからノード取得
      const nodeMap = new Map();
      for (const [key, node] of Object.entries(nodes)) {
        nodeMap.set(key, node);
      }

      // ページからノード取得
      for (const pageKey of Object.keys(pages)) {
        const subTree: COPC.Hierarchy.Subtree = await this.loadHierarchyPage(pages[pageKey]!);
        for (const [nodeKey, node] of Object.entries(subTree.nodes)) {
          nodeMap.set(nodeKey, node);
        }
      }

      // ノード一覧ソート
      this.sortedNodeMap = new Map([...nodeMap].sort());
      for (const key of this.sortedNodeMap.keys()) {
        nodeKeyList.push(key);
      }

      // LASヘッダ情報保持
      const lasHeader: LasHeader = this.copcHeader.header;
      maxDepth = Number(nodeKeyList[nodeKeyList.length - 1].split('-')[0]);
      pointNum = lasHeader.pointCount;
      min.set(lasHeader.min[0], lasHeader.min[1], lasHeader.min[2]);
      max.set(lasHeader.max[0], lasHeader.max[1], lasHeader.max[2]);

      // キューブ情報保持
      const cubeInfo = [...this.copcHeader.info.cube];
      this.cubeMinPos.set(cubeInfo[0], cubeInfo[1], cubeInfo[2]);
      this.cubeMaxPos.set(cubeInfo[3], cubeInfo[4], cubeInfo[5]);
      this.cubeCenter = this.cubeMaxPos.clone().add(this.cubeMinPos).divideScalar(2.0);
      this.cubeSize = this.cubeMaxPos.clone().sub(this.cubeMinPos).x;
    }

    const headerInfo: CopcData = {
      nodeKeyList: nodeKeyList,
      pointNum: pointNum,
      min: min,
      max: max,
      maxDepth: maxDepth,
    };

    return headerInfo;
  }

  /**
   * Webサーバから指定したノードの点群データをロードする
   * @param key ノードのキー
   * @param worker 点群データロードワーカー
   * @param eye 視点位置(未定義の場合IndexedDBへのデータ追加無)
   * @param posInfos 点群位置一覧(未定義の場合IndexedDBへのデータ追加無)
   * @param addIndexedDB IndexedDBへのデータ追加有無(未定義の場合追加しない)
   * @returns 点群データのバイナリデータ(取得失敗の場合未定義値)
   */
  public loadPointData(
    key: string,
    worker: Worker,
    eye?: number[],
    posInfos?: Map<string, number[]>,
    addIndexedDB?: boolean,
  ): void {
    Logging.debug(LOG_CONF.DEBUG_LOAD_POINT_DATA, this.filePath, key);

    // ワーカー送信用データ作成
    const postData: WorkerPostData = {
      copcHeader: this.copcHeader,
      node: this.sortedNodeMap.get(key),
      url: this.url,
      accessToken: this.accessToken,
      filePath: this.filePath,
      key: key,
      eye: eye,
      posInfos: posInfos,
      addIndexedDB: addIndexedDB,
    };

    // WebWorkerにデータ送信
    worker.postMessage(postData);
  }

  /************************************************************************************/
  // 「copc」パッケージのメソッド郡 定義開始
  // 一部の処理で改造が必要のため関連メソッドを抽出(要改造箇所以外は未編集)
  // JSDocにてパッケージ内実装からの改造箇所を記載
  /************************************************************************************/

  /**
   * LASヘッダの「Project ID」の文字列を取得する
   * 改造箇所：なし(パッケージで非exportのため流用)
   * @param buffer LASヘッダの「Project ID」のバイナリデータ
   * @returns LASヘッダの「Project ID」文字列
   * @throws GUIDバッファ長不正
   */
  private formatGuid(buffer: Uint8Array): string {
    const dv = COPC.Binary.toDataView(buffer);
    if (dv.byteLength !== 16) {
      throw new Error(`Invalid GUID buffer length: ${dv.byteLength}`);
    }
    let s = '';
    for (let i = 0; i < dv.byteLength; i += 4) {
      const c = dv.getUint32(i, true);
      s += c.toString(16).padStart(8, '0');
    }
    return [s.slice(0, 8), s.slice(8, 12), s.slice(12, 16), s.slice(16, 32)].join('-');
  }

  /**
   * 24バイトのバイナリデータのFloat64型の要素のパーサー
   * 改造箇所：なし(パッケージで非exportのため流用)
   * @param buffer 数値24バイトバイナリデータ
   * @returns Float64型の配列(要素数：3)
   * @throws タプルバッファ長不正
   */
  private parsePoint(buffer: Uint8Array): COPC.Point {
    const dv = COPC.Binary.toDataView(buffer);
    if (dv.byteLength !== 24) {
      throw new Error(`Invalid tuple buffer length: ${dv.byteLength}`);
    }
    return [dv.getFloat64(0, true), dv.getFloat64(8, true), dv.getFloat64(16, true)];
  }

  /**
   * LASヘッダの「Number of Points by Return」のパーサー
   * 改造箇所：なし(パッケージで非exportのため流用)
   * @param buffer LASヘッダの「Number of Points by Return」のバイナリデータ
   * @returns LASヘッダの「Number of Points by Return」
   */
  private parseNumberOfPointsByReturn(buffer: Uint8Array): number[] {
    const dv = COPC.Binary.toDataView(buffer);
    const bigs = [];
    for (let offset = 0; offset < 15 * 8; offset += 8) {
      bigs.push((0, COPC.getBigUint64)(dv, offset, true));
    }
    return bigs.map(v => (0, COPC.parseBigInt)(v));
  }

  /**
   * LASヘッダの「Legacy Number of Point by Return」のパーサー
   * 改造箇所：なし(パッケージで非exportのため流用)
   * @param buffer LASヘッダの「Legacy Number of Points by Return」のバイナリデータ
   * @returns LASヘッダの「Legacy Number of Points by Return」
   */
  private parseLegacyNumberOfPointsByReturn(buffer: Uint8Array): number[] {
    const dv = COPC.Binary.toDataView(buffer);
    const v = [];
    for (let offset = 0; offset < 5 * 4; offset += 4) {
      v.push(dv.getUint32(offset, true));
    }
    return v;
  }

  /**
   * LASヘッダのパーサー
   * 改造箇所：バージョン1.4のみ対応。戻り値をLasHeader(Legacy要素込み)に変更
   * @param buffer LASヘッダのバイナリデータ
   * @returns LASヘッダ情報
   * @throws LASヘッダバイトサイズ不正
   * @throws LASファイルシグネチャ不正
   * @throws LASバージョン不正
   */
  private parse(buffer: Uint8Array): LasHeader {
    // ヘッダのサイズ判定
    if (buffer.byteLength < COPC.Las.Constants.minHeaderLength) {
      throw new Error(`Invalid header: must be at least ${COPC.Las.Constants.minHeaderLength} bytes`);
    }
    // ファイルシグネチャ判定
    const dv = COPC.Binary.toDataView(buffer);
    const fileSignature = COPC.Binary.toCString(buffer.slice(0, 4));
    if (fileSignature !== 'LASF') {
      throw new Error(`Invalid file signature: ${fileSignature}`);
    }
    // バージョン判定
    const majorVersion = dv.getUint8(24);
    const minorVersion = dv.getUint8(25);
    if (!(majorVersion === 1 && minorVersion === 4)) {
      throw new Error(`Invalid version (only 1.4 supported): ${majorVersion}.${minorVersion}`);
    }

    // バイナリデータの解析
    const header: LasHeader = {
      fileSignature,
      fileSourceId: dv.getUint16(4, true),
      globalEncoding: dv.getUint16(6, true),
      projectId: this.formatGuid(buffer.slice(8, 24)),
      majorVersion,
      minorVersion,
      systemIdentifier: COPC.Binary.toCString(buffer.slice(26, 58)),
      generatingSoftware: COPC.Binary.toCString(buffer.slice(58, 90)),
      fileCreationDayOfYear: dv.getUint16(90, true),
      fileCreationYear: dv.getUint16(92, true),
      headerLength: dv.getUint16(94, true),
      pointDataOffset: dv.getUint32(96, true),
      vlrCount: dv.getUint32(100, true),
      pointDataRecordFormat: dv.getUint8(104) & 0b1111,
      pointDataRecordLength: dv.getUint16(105, true),
      legacyPointCount: dv.getUint32(107, true),
      legacyPointCountByReturn: this.parseLegacyNumberOfPointsByReturn(buffer.slice(111, 131)),
      scale: this.parsePoint(buffer.slice(131, 155)),
      offset: this.parsePoint(buffer.slice(155, 179)),
      min: [dv.getFloat64(187, true), dv.getFloat64(203, true), dv.getFloat64(219, true)],
      max: [dv.getFloat64(179, true), dv.getFloat64(195, true), dv.getFloat64(211, true)],
      waveformDataOffset: COPC.parseBigInt(COPC.getBigUint64(dv, 227, true)),
      evlrOffset: COPC.parseBigInt(COPC.getBigUint64(dv, 235, true)),
      evlrCount: dv.getUint32(243, true),
      pointCount: COPC.parseBigInt(COPC.getBigUint64(dv, 247, true)),
      pointCountByReturn: this.parseNumberOfPointsByReturn(buffer.slice(255, 375)),
    };
    return header;
  }

  /**
   * LASの可変長レコード(VLR)または拡張可変長レコード(EVLR)のヘッダ情報を取得する
   * 改造箇所：なし(パッケージで非exportのため流用)
   * @param get リクエスト処理のオブジェクト
   * @param startOffset 開始位置のオフセット
   * @param count VLRs数
   * @param isExtended 拡張可変長レコードか否か
   * @returns 可変長レコードのヘッダ情報
   * @throws HTTPリクエスト処理失敗
   * @throws 可変長レコードヘッダサイズ不正
   */
  private async doWalk(
    get: COPC.Getter,
    startOffset: number,
    count: number,
    isExtended: boolean,
  ): Promise<COPC.Las.Vlr[]> {
    const vlrs: COPC.Las.Vlr[] = [];
    let pos = startOffset;
    const length = isExtended ? COPC.Las.Constants.evlrHeaderLength : COPC.Las.Constants.vlrHeaderLength;
    for (let i = 0; i < count; ++i) {
      const buffer = length ? await get(pos, pos + length) : new Uint8Array();
      const {userId, recordId, contentLength, description} = COPC.Las.Vlr.parse(buffer, isExtended);
      vlrs.push({
        userId,
        recordId,
        contentOffset: pos + length,
        contentLength,
        description,
        isExtended,
      });
      pos += length + contentLength;
    }
    return vlrs;
  }

  /**
   * LASの可変長レコードのヘッダ情報一覧を取得する
   * 改造箇所：リクエスト処理のオブジェクトがHTTPであることを保証
   * @param get リクエスト処理のオブジェクト
   * @param header LASヘッダ
   * @returns LASの可変長レコードのヘッダ情報一覧
   */
  private async walk(get: COPC.Getter, header: LasHeader): Promise<COPC.Las.Vlr[]> {
    const vlrs = await this.doWalk(get, header.headerLength, header.vlrCount, false);
    const evlrs = await this.doWalk(get, header.evlrOffset, header.evlrCount, true);
    return [...vlrs, ...evlrs];
  }

  /**
   * COPCデータ取得用のリクエスト処理を生成する
   * 改造箇所：認証リクエストに対応(utils/getter.js/getHttpGetterの処理)
   * @param url 点群データのURL(ファイルパス含む)
   * @param accessToken ユーザのアクセストークン
   * @returns リクエスト処理のオブジェクト
   */
  private createCopcGetter(url: string, accessToken: string): COPC.Getter {
    // 通信制御用のシグナル取得
    const signal = this.controller.signal;

    // リクエスト処理オブジェクト
    return async function getRemote(begin: number, end: number): Promise<Uint8Array> {
      if (begin < 0 || end < 0 || begin > end) {
        throw new Error(`Invalid range(${begin}-${end})`);
      }
      const response = await fetch(url, {
        headers: {
          Range: `bytes=${begin}-${end - 1}`,
          Authorization: 'Bearer ' + accessToken,
        },
        signal: signal,
      });
      if (!response.ok) {
        throw new Error('Request failed');
      }

      const ab: ArrayBuffer = await response.arrayBuffer();
      return new Uint8Array(ab);
    };
  }

  /**
   * COPCのヘッダ情報のオブジェクトを取得する
   * 改造箇所：型LasHeaderやメソッド名の変更に対応(copc/copc.js/createの処理)
   * @returns COPCヘッダ情報
   * @throws COPCデータオブジェクト取得失敗
   */
  private async createCopc(): Promise<CopcHeader> {
    // リクエスト処理の生成
    const getRemote: COPC.Getter = this.createCopcGetter(this.url, this.accessToken);
    const length = 65536;
    const promise = await getRemote(0, length);
    async function get(begin: number, end: number) {
      if (end >= length) {
        return await getRemote(begin, end);
      }
      const head = await promise;
      return head.slice(begin, end);
    }

    // LASヘッダの取得
    const header: LasHeader = this.parse(await get(0, COPC.Las.Constants.minHeaderLength));

    // 可変長レコードの取得
    const vlrs = await this.walk(get, header);
    const infoVlr = COPC.Las.Vlr.find(vlrs, 'copc', 1);
    if (!infoVlr) {
      throw new Error('COPC info VLR is required');
    }

    // 可変長レコードのCOPCの情報を取得
    const info: COPC.Info = COPC.Info.parse(await COPC.Las.Vlr.fetch(get, infoVlr));

    // 座標参照系情報取得
    let wkt;
    const wktVlr = COPC.Las.Vlr.find(vlrs, 'LASF_Projection', 2112);
    if (wktVlr && wktVlr.contentLength) {
      wkt = COPC.Binary.toCString(await COPC.Las.Vlr.fetch(get, wktVlr));
      if (wkt === '') wkt = undefined;
    }

    // 拡張データ項目取得
    let eb: COPC.Las.ExtraBytes[] = [];
    const ebVlr = COPC.Las.Vlr.find(vlrs, 'LASF_Spec', 4);
    if (ebVlr) {
      eb = COPC.Las.ExtraBytes.parse(await COPC.Las.Vlr.fetch(get, ebVlr));
    }

    return {header, vlrs, info, wkt, eb};
  }

  /**
   * COPCのページに紐づく構造情報を取得する
   * 改造箇所：認証リクエストに対応に対応
   * @param page COPCのページ
   * @returns COPCのページに紐づく構造情報
   * @throws HTTPリクエスト処理失敗
   * @throws ヒエラルキーページ長不正
   * @throws ヒエラルキー点数不正
   */
  private async loadHierarchyPage(page: COPC.Hierarchy.Page): Promise<COPC.Hierarchy.Subtree> {
    const get: COPC.Getter = this.createCopcGetter(this.url, this.accessToken);
    return COPC.Hierarchy.load(get, page);
  }

  /************************************************************************************/
  // 「copc」パッケージのメソッド郡 定義終了
  /************************************************************************************/
}
