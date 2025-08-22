/**
 * @fileoverview LASダウンロード実行クラスの定義
 * @author Masaaki Takeuchi(MESW)
 * @created 2025/05/23
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import * as THREE from 'three';
import * as COPC from 'copc';
import {BYTE_SIZE, POINT_DATA_ITEM, POINT_DATA_VIEW_OFFSET, POINT_DATA_VIEW_SIZE} from '../util/constant';
import {LasHeader} from './copcInfo';
import {NodeInfo} from './nodeInfo';
import {Logging} from '../log/logging';
import {LOG_CONF} from '../log/logConf';
import {COPCUtil} from '../util/copcUtil';
import {PointSet} from './pointSet';
import {SelectionParameter} from './pointMeasure';

/**
 * @interface ダウンロード処理情報
 */
export interface DownloadStatus {
  filePath: string;
  result: number;
  progress: number;
}

/**
 * @interface 点選択情報
 */
interface SelectedInfo {
  nodeInfoList: NodeInfo[];
  selectedPointCount: number[];
  totalPointCount: number;
  min: THREE.Vector3;
  max: THREE.Vector3;
}

/** ダウンロード処理状態 */
const DOWNLOAD_STATUS = {
  FAILED: -1, // 実行失敗
  WAITED: 0, // 実行待ち
  PROCESSING: 1, // 実行中
  COMPLETED: 2, // 実行完了
};

/** ダウンロードLASファイルの定義 */
const DONWLOAD_LAS_FOR_SELECT = {
  FILE_SOURCE_ID: 0,
  FILE_SIGNATURE: 'LASF',
  FILE_NAME: 'select-point.las',
  PROJECT_ID: '00000000-0000-0000-0000000000000000',
  SYSTEM_IDENTIFIER: '',
  GENERATING_SOFTWARE: '',
};

/** LAS点データレコード長 */
const LAS_POINT_DATA_RECORD_LENGTH = {
  PDRF6: 30,
  PDRF7: 36,
  PDRF8: 38,
};
Object.freeze(LAS_POINT_DATA_RECORD_LENGTH);

/** LAS形式定義情報 */
const LAS_FORMAT = {
  HEADER_SIZE: 375,
};
Object.freeze(LAS_FORMAT);

/** LAS可変長レコード情報 */
const LAS_VLR = {
  HEADER_SIZE: 54,
  COPC_META_USER_ID: 'copc',
  COPC_META_RECORD_ID: 1,
  WKT_USER_ID: 'LASF_Projection',
  WKT_RECORD_ID: 2112,
  EXTRA_BYTES_USER_ID: 'LASF_Spec',
  EXTRA_BYTES_RECORD_ID: 4,
  EXTRA_BYTES_CONTENT_SIZE: 192,
};
Object.freeze(LAS_VLR);

/**
 * LASダウンロード実行クラス
 */
export class LasDownload {
  /** データロード用ワーカー */
  private worker: Worker;

  /**
   * コンストラクタ
   */
  constructor() {
    // データロード用ワーカー生成
    this.worker = new Worker(new URL('../../assets/viewer/dataWorker', import.meta.url), {type: 'module'});
  }

  /**
   * LASダウンロード処理を終了する。ワーカーのオブジェクトを破棄する。
   */
  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
    }
  }

  /**
   * 点のレコード長を取得する。
   * @param pdrf 点データレコードフォーマット
   * @param extraBytesList 拡張データ項目
   * @returns 点のレコード長
   */
  private getPointDataRecordLength(pdrf: number, extraBytesList: COPC.Las.ExtraBytes[]): number {
    let pointDataRecordLength: number = 0;

    // 点データレコードフォーマットによるデータ長設定
    switch (pdrf) {
      case 6:
        pointDataRecordLength += LAS_POINT_DATA_RECORD_LENGTH.PDRF6;
        break;
      case 7:
        pointDataRecordLength += LAS_POINT_DATA_RECORD_LENGTH.PDRF7;
        break;
      case 8:
        pointDataRecordLength += LAS_POINT_DATA_RECORD_LENGTH.PDRF8;
        break;
      default:
        pointDataRecordLength = 0;
        break;
    }

    // 拡張データ項目によるデータ長設定
    for (const extraBytes of extraBytesList) {
      pointDataRecordLength += extraBytes.length;
    }

    return pointDataRecordLength;
  }

  /**
   * 複数のLASヘッダ部の情報を単一のLASヘッダ部に変換する
   * @param lasHeaders 複数のLASヘッダ情報
   * @param pointCount 点数
   * @param min 最小位置
   * @param max 最大位置
   * @param extraBytesList 拡張データ項目
   * @returns 単一のLASヘッダ情報
   */
  private MultiLasHeader2UnitLasHeader(
    lasHeaders: LasHeader[],
    pointCount: number,
    min: THREE.Vector3,
    max: THREE.Vector3,
    extraBytesList: COPC.Las.ExtraBytes[],
  ): LasHeader {
    // ファイル生成日取得関数定義
    const getFileCreationDayOfYear = (): number => {
      // 現在の日付と年初の日付の差をミリ秒で計算
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const diffInMillis = now.getTime() - startOfYear.getTime();
      // ミリ秒を日数に変換
      const dayOfYear = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
      return dayOfYear;
    };

    // 複数ファイルのデータマージ
    let pointDataRecordFormat = 0;
    const scale = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
    for (let i = 0; i < lasHeaders.length; i++) {
      pointDataRecordFormat = Math.max(pointDataRecordFormat, lasHeaders[i].pointDataRecordFormat);
      scale[0] = Math.min(scale[0], lasHeaders[i].scale[0]);
      scale[1] = Math.min(scale[1], lasHeaders[i].scale[1]);
      scale[2] = Math.min(scale[2], lasHeaders[i].scale[2]);
    }

    // 点のレコード長を算出
    const pointDataRecordLength: number = this.getPointDataRecordLength(pointDataRecordFormat, extraBytesList);

    // 拡張データ項目情報反映
    let pointDataOffset = LAS_FORMAT.HEADER_SIZE;
    let vlrCount = 0;
    if (0 < extraBytesList.length) {
      vlrCount = 1;
      // 拡張データ項目のサイズ反映
      pointDataOffset += LAS_VLR.HEADER_SIZE;
      pointDataOffset += extraBytesList.length * LAS_VLR.EXTRA_BYTES_CONTENT_SIZE;
    }

    // 拡張可変長レコード関連
    const evlrOffset = pointDataOffset + pointCount * pointDataRecordLength;

    // 単一のLASヘッダ情報生成
    const header: LasHeader = {
      fileSignature: lasHeaders[0].fileSignature,
      fileSourceId: DONWLOAD_LAS_FOR_SELECT.FILE_SOURCE_ID,
      globalEncoding: lasHeaders[0].globalEncoding,
      projectId: DONWLOAD_LAS_FOR_SELECT.PROJECT_ID,
      majorVersion: lasHeaders[0].majorVersion,
      minorVersion: lasHeaders[0].minorVersion,
      systemIdentifier: DONWLOAD_LAS_FOR_SELECT.SYSTEM_IDENTIFIER,
      generatingSoftware: DONWLOAD_LAS_FOR_SELECT.GENERATING_SOFTWARE,
      fileCreationDayOfYear: getFileCreationDayOfYear(),
      fileCreationYear: new Date().getFullYear(),
      headerLength: lasHeaders[0].headerLength,
      pointDataOffset: pointDataOffset,
      vlrCount: vlrCount,
      pointDataRecordFormat: pointDataRecordFormat,
      pointDataRecordLength: pointDataRecordLength,
      legacyPointCount: pointCount,
      legacyPointCountByReturn: new Array(5).fill(0),
      scale: [scale[0], scale[1], scale[2]],
      offset: [0, 0, 0],
      max: [max.x, max.y, max.z],
      min: [min.x, min.y, min.z],
      waveformDataOffset: 0,
      evlrOffset: evlrOffset,
      evlrCount: 0,
      pointCount: pointCount,
      pointCountByReturn: new Array(15).fill(0),
    };

    return header;
  }

  /**
   * 選択されている点の情報を取得する
   * @param pointSetList 点群データ管理オブジェクトの一覧
   * @param parameter オブジェクトのパラメータ情報
   * @returns 選択情報
   */
  private getSelectedInfo(pointSetList: PointSet[], parameter: SelectionParameter): SelectedInfo {
    // 矩形の最小最大位置(矩形と重なるノードを処理の対象とする)
    const position: THREE.Vector3 = parameter.position;
    const size: THREE.Vector3 = parameter.size;
    const boxMin = new THREE.Vector3(position.x - size.x / 2, position.y - size.y / 2, position.z - size.z / 2);
    const boxMax = new THREE.Vector3(position.x + size.x / 2, position.y + size.y / 2, position.z + size.z / 2);

    // 矩形内部に存在するノードの一覧を取得
    const nodeInfoList: NodeInfo[] = [];
    for (const pointSet of pointSetList) {
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

    // 選択中の情報を取得
    const selectedPointCount: number[] = [];
    let totalPointCount: number = 0;
    const min = new THREE.Vector3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    const max = new THREE.Vector3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
    for (const nodeInfo of nodeInfoList) {
      const coords = nodeInfo.getPointCoordInShape(parameter.matrix, parameter.checkInOut);
      selectedPointCount.push(coords.length);
      totalPointCount += coords.length;
      for (const coord of coords) {
        min.min(coord);
        max.max(coord);
      }
    }

    // 結果設定
    const selectedInfo: SelectedInfo = {
      nodeInfoList: nodeInfoList,
      selectedPointCount: selectedPointCount,
      totalPointCount: totalPointCount,
      min: min,
      max: max,
    };

    return selectedInfo;
  }

  /**
   * 選択された点のバイナリデータ(内部データ管理形式)を取得する
   * @param pointDatas 点群データのバイナリデータ(内部データ管理形式)
   * @param pointCount 選択中点数
   * @param matrix オブジェクトの移動行列の逆行列
   * @param checkInOut 座標の内外判定用処理(position: 判定座標)
   * @returns 選択点のバイナリデータ(内部データ管理形式)
   */
  private getBinarySelectedData(
    pointDatas: DataView,
    pointCount: number,
    matrix: THREE.Matrix4,
    checkInOut: (position: THREE.Vector4) => boolean,
  ): DataView {
    // データ領域確保
    const dataBuffer: ArrayBuffer = new ArrayBuffer(POINT_DATA_VIEW_SIZE * pointCount);
    const selectedDataView = new DataView(dataBuffer);

    // 判定対象点数
    const length = pointDatas.byteLength / POINT_DATA_VIEW_SIZE;

    // 内外判定処理
    let inOffset = 0;
    let outOffset = 0;
    for (let i = 0; i < length; i++) {
      inOffset = i * POINT_DATA_VIEW_SIZE;

      const X = pointDatas.getFloat64(inOffset + 0);
      const Y = pointDatas.getFloat64(inOffset + 8);
      const Z = pointDatas.getFloat64(inOffset + 16);
      const tmp = new THREE.Float32BufferAttribute([X, Y, Z], 3);
      const position = new THREE.Vector4(tmp.getX(0), tmp.getY(0), tmp.getZ(0), 1.0);

      // 座標変換
      const clipPosition = position.applyMatrix4(matrix);
      const ret = checkInOut(clipPosition);
      if (ret) {
        for (let j = 0; j < POINT_DATA_VIEW_SIZE; j++) {
          selectedDataView.setInt8(outOffset, pointDatas.getInt8(inOffset + j));
          outOffset++;
        }
      }
    }

    return selectedDataView;
  }

  /**
   * 選択中の点群データをLAS形式のファイルでストリームダウンロードする
   * @param pointSetList 点群データ管理オブジェクトの一覧
   * @param callback ダウンロード処理状態を設定するコールバック
   * @param parameter オブジェクトのパラメータ情報
   */
  public async startForSelected(
    pointSetList: PointSet[],
    callback: (status: DownloadStatus[]) => void,
    parameter: SelectionParameter,
  ): Promise<void> {
    // ダウンロード状態の初期化
    const downloadStatus: DownloadStatus[] = [];
    const status: DownloadStatus = {
      filePath: DONWLOAD_LAS_FOR_SELECT.FILE_NAME,
      result: DOWNLOAD_STATUS.WAITED,
      progress: 0,
    };
    downloadStatus.push(status);
    const setDownloadStatus = (idx: number, result: number, progress?: number) => {
      downloadStatus[idx].result = result;
      if (undefined !== progress) {
        downloadStatus[idx].progress = progress;
      }
      callback(downloadStatus);
    };
    // 処理状態の更新(開始)
    setDownloadStatus(0, DOWNLOAD_STATUS.PROCESSING, 0);

    // バインド
    const getBinaryLasPointData = this.getBinaryLasPointData.bind(this);
    const getBinarySelectedData = this.getBinarySelectedData.bind(this);
    const worker = this.worker;

    // 選択処理の処理結果取得
    const selectedInfo: SelectedInfo = this.getSelectedInfo(pointSetList, parameter);

    // 表示中の点群のヘッダ情報取得
    const extraBytesMap: Map<string, COPC.Las.ExtraBytes> = new Map();
    const lasHeaders: LasHeader[] = [];
    for (const pointSet of pointSetList) {
      // 非表示はスキップ
      if (!pointSet.getVisibleStatus()) {
        continue;
      }
      const filePath = pointSet.getFileInfo().filePath;

      // LASヘッダ情報取得
      const lasHeader: LasHeader | undefined = pointSet.getCopc().getLasHeader();
      if (lasHeader) {
        lasHeaders.push(lasHeader);
      } else {
        Logging.error(LOG_CONF.ERROR_LAS_DOWNLOAD_HEADER, filePath);
        setDownloadStatus(0, DOWNLOAD_STATUS.FAILED);
        return;
      }

      // 拡張データ項目取得
      const extraBytesList: COPC.Las.ExtraBytes[] | undefined = pointSet.getCopc().getLasExtraBytes();
      if (extraBytesList) {
        // 複数ファイルで重複する拡張データ項目を単一化
        for (const extraBytes of extraBytesList) {
          extraBytesMap.set(extraBytes.name, extraBytes);
        }
      } else {
        Logging.error(LOG_CONF.ERROR_LAS_DOWNLOAD_EBS, filePath);
        setDownloadStatus(0, DOWNLOAD_STATUS.FAILED);
        return;
      }
    }

    // 複数のLASヘッダ情報を単一のLASヘッダ情報に変換
    const lasHeader: LasHeader = this.MultiLasHeader2UnitLasHeader(
      lasHeaders,
      selectedInfo.totalPointCount,
      selectedInfo.min,
      selectedInfo.max,
      Array.from(extraBytesMap.values()),
    );

    // LASヘッダ部のバイナリデータ取得
    const headerView = this.getBinaryLasHeader(lasHeader);

    // 可変長レコードの拡張データ項目のバイナリデータ取得
    let extraBytesView: DataView | undefined = undefined;
    if (0 < extraBytesMap.size) {
      extraBytesView = this.getBinaryExtraBytes(Array.from(extraBytesMap.values()));
    }

    Logging.info(LOG_CONF.INFO_LAS_DOWNLOAD_SELECT_START);

    // ストリーム処理定義
    const targetNodeInfoList = selectedInfo.nodeInfoList;
    const stream = new ReadableStream({
      start(controller) {
        // データエンキュー処理定義
        function push(nodeIdx: number) {
          // 初回実行(ヘッダ部＋可変長レコード部追加)
          if (nodeIdx === 0) {
            controller.enqueue(headerView);
            if (extraBytesView) {
              controller.enqueue(extraBytesView);
            }
          }

          // 点データ追加完了
          if (targetNodeInfoList.length <= nodeIdx) {
            setDownloadStatus(0, DOWNLOAD_STATUS.PROCESSING, 100);
            controller.close();
            return;
          }

          // 点データ追加
          const pointCount = selectedInfo.selectedPointCount[nodeIdx];
          const target: NodeInfo = targetNodeInfoList[nodeIdx];
          target.loading = true;
          target.loadPointData(worker);

          // WebWorkerからの正常メッセージ受信時の処理
          worker.onmessage = (event: MessageEvent<ArrayBuffer>) => {
            target.loading = false;

            const pointDataView = new DataView(event.data);
            if (pointDataView.byteLength !== 0) {
              if (0 < pointCount) {
                const selectedDataView = getBinarySelectedData(
                  pointDataView,
                  pointCount,
                  parameter.matrix,
                  parameter.checkInOut,
                );
                const view = getBinaryLasPointData(selectedDataView, lasHeader, Array.from(extraBytesMap.values()));
                controller.enqueue(view);
                Logging.trace(LOG_CONF.TRACE_LAS_DOWNLOAD_ADD_DATA, target.getKey());
              }
            } else {
              Logging.error(LOG_CONF.ERROR_LAS_DOWNLOAD_LOAD_DATA);
              controller.error();
            }

            // 次ノードの処理呼び出し
            push(nodeIdx + 1);
          };
          // WebWorkerからの異常メッセージ受信時の処理
          worker.onmessageerror = () => {
            target.loading = false;
            Logging.error(LOG_CONF.ERROR_LAS_DOWNLOAD_LOAD_DATA);
            controller.error();
          };
          // WebWorker側エラー発生時の処理
          worker.onerror = () => {
            target.loading = false;
            Logging.error(LOG_CONF.ERROR_LAS_DOWNLOAD_LOAD_DATA);
            controller.error();
          };

          // 処理状態の更新
          const progress = COPCUtil.roundPrecision((nodeIdx / targetNodeInfoList.length) * 100, 0);
          setDownloadStatus(0, DOWNLOAD_STATUS.PROCESSING, progress);
        }

        // 0番目のノードの処理から開始
        push(0);
      },
      type: 'bytes',
    });

    // ストリーム処理開始
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    let failed = false;
    let done = false;
    while (!done) {
      try {
        let value;
        ({done, value} = await reader.read());
        if (value) {
          chunks.push(value);
        }
      } catch {
        // エラーが発生した場合、ループを終了する
        setDownloadStatus(0, DOWNLOAD_STATUS.FAILED);
        done = true;
        failed = true;
      }
    }

    // 処理に成功した場合ダウンロード処理
    if (!failed) {
      // ストリームをBlobに変換
      const blob = new Blob(chunks, {type: 'text/plain;charset=utf-8'});

      // Blobをダウンロードリンクとして作成
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = DONWLOAD_LAS_FOR_SELECT.FILE_NAME;
      document.body.appendChild(link);
      link.click();
    }

    // 処理完了状態に設定
    setDownloadStatus(0, DOWNLOAD_STATUS.COMPLETED, 100);
  }

  /**
   * 指定した点群データをLAS形式のファイルでストリームダウンロードする
   * @param pointSetList 点群データ管理オブジェクトの一覧
   * @param callback ダウンロード処理状態を設定するコールバック
   */
  public async startForFile(pointSetList: PointSet[], callback: (status: DownloadStatus[]) => void): Promise<void> {
    // ダウンロード状態の初期化
    const downloadStatus: DownloadStatus[] = [];
    for (let i = 0; i < pointSetList.length; i++) {
      const filePath: string = pointSetList[i].getFileInfo().filePath;
      const status: DownloadStatus = {filePath: filePath, result: DOWNLOAD_STATUS.WAITED, progress: 0};
      downloadStatus.push(status);
    }
    const setDownloadStatus = (idx: number, result: number, progress?: number) => {
      downloadStatus[idx].result = result;
      if (undefined !== progress) {
        downloadStatus[idx].progress = progress;
      }
      callback(downloadStatus);
    };

    // バインド
    const getBinaryLasPointData = this.getBinaryLasPointData.bind(this);
    const worker = this.worker;

    for (let targetIdx = 0; targetIdx < pointSetList.length; targetIdx++) {
      const pointSet = pointSetList[targetIdx];
      const filePath = pointSet.getFileInfo().filePath;

      Logging.info(LOG_CONF.INFO_LAS_DOWNLOAD_FILE_START, filePath);
      setDownloadStatus(targetIdx, DOWNLOAD_STATUS.PROCESSING, 0);

      // 点群データのノード一覧取得
      const nodeInfoList = pointSet.getNodeInfoList();

      // ヘッダ情報取得
      const lasHeader: LasHeader | undefined = pointSet.getCopc().getLasHeader();
      if (!lasHeader) {
        Logging.error(LOG_CONF.ERROR_LAS_DOWNLOAD_HEADER, filePath);
        setDownloadStatus(targetIdx, DOWNLOAD_STATUS.FAILED);
        continue;
      }
      // ヘッダ部をLAS形式用に更新
      lasHeader.evlrOffset = lasHeader.pointDataOffset + lasHeader.pointDataRecordLength * lasHeader.pointCount;

      // ヘッダ部のバイナリデータ取得
      const headerView = this.getBinaryLasHeader(lasHeader);

      // 可変長レコード部のバイナリデータ取得
      const vlrsView: DataView | undefined = await pointSet.getCopc().loadBinaryVlrs(false);
      if (!vlrsView) {
        Logging.error(LOG_CONF.ERROR_LAS_DOWNLOAD_VLR, filePath, '0');
        setDownloadStatus(targetIdx, DOWNLOAD_STATUS.FAILED);
        continue;
      }
      const evlrsView: DataView | undefined = await pointSet.getCopc().loadBinaryVlrs(true);
      if (!evlrsView) {
        Logging.error(LOG_CONF.ERROR_LAS_DOWNLOAD_VLR, filePath, '1');
        setDownloadStatus(targetIdx, DOWNLOAD_STATUS.FAILED);
        continue;
      }

      // 拡張データ項目取得
      const extraBytesList: COPC.Las.ExtraBytes[] | undefined = pointSet.getCopc().getLasExtraBytes();
      if (!extraBytesList) {
        Logging.error(LOG_CONF.ERROR_LAS_DOWNLOAD_EBS, filePath);
        setDownloadStatus(targetIdx, DOWNLOAD_STATUS.FAILED);
        continue;
      }

      // ストリーム処理定義
      const stream = new ReadableStream({
        start(controller) {
          // データエンキュー処理定義
          function push(nodeIdx: number) {
            // 初回実行(ヘッダ部＋可変長レコード部追加)
            if (nodeIdx === 0) {
              controller.enqueue(headerView);
              controller.enqueue(vlrsView!);
            }

            // 点データ追加完了
            if (nodeInfoList.length <= nodeIdx) {
              // 拡張可変長レコード部追加
              controller.enqueue(evlrsView!);
              setDownloadStatus(targetIdx, DOWNLOAD_STATUS.PROCESSING, 100);
              controller.close();
              return;
            }

            // 点データ追加
            const target: NodeInfo = nodeInfoList[nodeIdx];
            target.loading = true;
            target.loadPointData(worker);

            // WebWorkerからの正常メッセージ受信時の処理
            worker.onmessage = (event: MessageEvent<ArrayBuffer>) => {
              target.loading = false;

              const pointDataView = new DataView(event.data);
              if (pointDataView.byteLength !== 0) {
                const view = getBinaryLasPointData(pointDataView, lasHeader!, extraBytesList!);
                controller.enqueue(view);
                Logging.trace(LOG_CONF.TRACE_LAS_DOWNLOAD_ADD_DATA, target.getKey());
              } else {
                Logging.error(LOG_CONF.ERROR_LAS_DOWNLOAD_LOAD_DATA);
                controller.error();
              }

              // 次ノードの処理呼び出し
              push(nodeIdx + 1);
            };
            // WebWorkerからの異常メッセージ受信時の処理
            worker.onmessageerror = () => {
              target.loading = false;
              Logging.error(LOG_CONF.ERROR_LAS_DOWNLOAD_LOAD_DATA);
              controller.error();
            };
            // WebWorker側エラー発生時の処理
            worker.onerror = () => {
              target.loading = false;
              Logging.error(LOG_CONF.ERROR_LAS_DOWNLOAD_LOAD_DATA);
              controller.error();
            };

            // 処理状態の更新
            const progress: number = COPCUtil.roundPrecision((nodeIdx / nodeInfoList.length) * 100, 0);
            setDownloadStatus(targetIdx, DOWNLOAD_STATUS.PROCESSING, progress);
          }

          // 0番目のノードの処理から開始
          push(0);
        },
        type: 'bytes',
      });

      // ストリーム処理開始
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];

      let failed = false;
      let done = false;
      while (!done) {
        try {
          let value;
          ({done, value} = await reader.read());
          if (value) {
            chunks.push(value);
          }
        } catch {
          // エラーが発生した場合、ループを終了する
          setDownloadStatus(targetIdx, DOWNLOAD_STATUS.FAILED);
          done = true;
          failed = true;
        }
      }

      // 処理に失敗した場合次ダウンロード処理へ
      if (failed) {
        continue;
      }

      // ストリームをBlobに変換
      const blob = new Blob(chunks, {type: 'text/plain;charset=utf-8'});

      // ファイル名設定
      const splitPath = filePath.split('/');
      const fileName = splitPath[splitPath.length - 1].split('.');
      const lasFile = fileName[0] + '.las';

      // Blobをダウンロードリンクとして作成
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = lasFile;
      document.body.appendChild(link);
      link.click();
    }
  }

  /**
   * LAS形式のヘッダ部のバイナリデータを取得する
   * @param lasHeader LAS形式のヘッダ情報
   * @returns LAS形式のヘッダ部のバイナリデータ
   */
  private getBinaryLasHeader(lasHeader: LasHeader): DataView {
    const buffer = new ArrayBuffer(LAS_FORMAT.HEADER_SIZE);
    const view = new DataView(buffer);

    // バイトオフセット
    let offset = 0;

    // File Signature (char[4])
    for (let i = 0; i < 4; i++) {
      view.setUint8(offset, lasHeader.fileSignature.charCodeAt(i));
      offset += BYTE_SIZE.UINT8;
    }

    // File Source ID (unsigned short)
    view.setUint16(offset, lasHeader.fileSourceId, true);
    offset += BYTE_SIZE.UINT16;
    // Global Encoding (unsigned short)
    view.setUint16(offset, lasHeader.globalEncoding, true);
    offset += BYTE_SIZE.UINT16;

    // Project ID
    const projectId = lasHeader.projectId.split('-');
    // Project ID - GUID Data 1 (unsigned long)
    view.setUint32(offset, parseInt(projectId[0], 16), true);
    offset += BYTE_SIZE.UINT32;
    // Project ID - GUID Data 2 (unsigned short)
    view.setUint16(offset, parseInt(projectId[1], 16), true);
    offset += BYTE_SIZE.UINT16;
    // Project ID - GUID Data 3 (unsigned short)
    view.setUint16(offset, parseInt(projectId[2], 16), true);
    offset += BYTE_SIZE.UINT16;
    // Project ID - GUID Data 4 (unsigned char[8])
    const guidData4: number = parseInt(projectId[3], 16);
    view.setBigUint64(offset, BigInt(guidData4), true);
    offset += BYTE_SIZE.BIG_UINT64;

    // Version Major (unsigned char)
    view.setUint8(offset, lasHeader.majorVersion);
    offset += BYTE_SIZE.UINT8;
    // Version Minor (unsigned char)
    view.setUint8(offset, lasHeader.minorVersion);
    offset += BYTE_SIZE.UINT8;

    // System Identifier (char[32])
    for (let i = 0; i < 32; i++) {
      view.setUint8(offset, lasHeader.systemIdentifier.charCodeAt(i));
      offset += BYTE_SIZE.UINT8;
    }
    // Generating Software (char[32])
    for (let i = 0; i < 32; i++) {
      view.setUint8(offset, lasHeader.generatingSoftware.charCodeAt(i));
      offset += BYTE_SIZE.UINT8;
    }

    // File Creation Day of Year (unsigned short)
    view.setUint16(offset, lasHeader.fileCreationDayOfYear, true);
    offset += BYTE_SIZE.UINT16;
    // File Creation Year (unsigned short)
    view.setUint16(offset, lasHeader.fileCreationYear, true);
    offset += BYTE_SIZE.UINT16;

    // Header Size (unsigned short)
    view.setUint16(offset, lasHeader.headerLength, true);
    offset += BYTE_SIZE.UINT16;
    // Offset to Point Data (unsigned long)
    view.setUint32(offset, lasHeader.pointDataOffset, true);
    offset += BYTE_SIZE.UINT32;

    // Number of Variable Length Records (unsigned long)
    view.setUint32(offset, lasHeader.vlrCount, true);
    offset += BYTE_SIZE.UINT32;

    // Point Data Record Format (unsigned char)
    view.setUint8(offset, lasHeader.pointDataRecordFormat);
    offset += BYTE_SIZE.UINT8;
    // Point Data Record Length (unsigned short)
    view.setUint16(offset, lasHeader.pointDataRecordLength, true);
    offset += BYTE_SIZE.UINT16;

    // Legacy Number of Point Records (unsigned long)
    view.setUint32(offset, lasHeader.legacyPointCount, true);
    offset += BYTE_SIZE.UINT32;
    // Legacy Number of Point by Return (unsigned long[5])
    for (let i = 0; i < 5; i++) {
      view.setUint32(offset, lasHeader.legacyPointCountByReturn[i], true);
      offset += BYTE_SIZE.UINT32;
    }

    // X Scale Factor (double)
    view.setFloat64(offset, lasHeader.scale[0], true);
    offset += BYTE_SIZE.FLOAT64;
    // Y Scale Factor (double)
    view.setFloat64(offset, lasHeader.scale[1], true);
    offset += BYTE_SIZE.FLOAT64;
    // Z Scale Factor (double)
    view.setFloat64(offset, lasHeader.scale[2], true);
    offset += BYTE_SIZE.FLOAT64;
    // X Offset (double)
    view.setFloat64(offset, lasHeader.offset[0], true);
    offset += BYTE_SIZE.FLOAT64;
    // Y Offset (double)
    view.setFloat64(offset, lasHeader.offset[1], true);
    offset += BYTE_SIZE.FLOAT64;
    // Z Offset (double)
    view.setFloat64(offset, lasHeader.offset[2], true);
    offset += BYTE_SIZE.FLOAT64;

    // Max X (double)
    view.setFloat64(offset, lasHeader.max[0], true);
    offset += BYTE_SIZE.FLOAT64;
    // Min X (double)
    view.setFloat64(offset, lasHeader.min[0], true);
    offset += BYTE_SIZE.FLOAT64;
    // Max Y (double)
    view.setFloat64(offset, lasHeader.max[1], true);
    offset += BYTE_SIZE.FLOAT64;
    // Min Y (double)
    view.setFloat64(offset, lasHeader.min[1], true);
    offset += BYTE_SIZE.FLOAT64;
    // Max Z (double)
    view.setFloat64(offset, lasHeader.max[2], true);
    offset += BYTE_SIZE.FLOAT64;
    // Min Z (double)
    view.setFloat64(offset, lasHeader.min[2], true);
    offset += BYTE_SIZE.FLOAT64;

    // Start of Waveform Data Packet Record (unsigned long long)
    view.setBigUint64(offset, BigInt(lasHeader.waveformDataOffset), true);
    offset += BYTE_SIZE.BIG_UINT64;

    // Start of First Extended Variable Length Record (unsigned long long)
    view.setBigUint64(offset, BigInt(lasHeader.evlrOffset), true);
    offset += BYTE_SIZE.BIG_UINT64;
    // Number of Extended Variable Length Records (unsigned long)
    view.setUint32(offset, lasHeader.evlrCount, true);
    offset += BYTE_SIZE.UINT32;

    // Number of Point Records (unsigned long long)
    view.setBigUint64(offset, BigInt(lasHeader.pointCount), true);
    offset += BYTE_SIZE.BIG_UINT64;
    // Number of Points by Return (unsigned long long[15])
    for (let i = 0; i < 15; i++) {
      const pointCountByReturn = lasHeader.pointCountByReturn[i];
      view.setBigUint64(offset, BigInt(pointCountByReturn), true);
      offset += BYTE_SIZE.BIG_UINT64;
    }

    return view;
  }

  /**
   * 指定したヘッダ情報をもつ1つの可変長レコードのバイナリデータ(データ部は空)を生成する
   * @param userId ユーザID
   * @param recordId レコードID
   * @param description 説明内容
   * @param contentSize データ部のサイズ
   * @returns 可変長レコードのバイナリデータ
   */
  private getBinaryVlr(userId: string, recordId: number, description: string, contentSize: number): DataView {
    // 可変長レコードの領域確保
    const vlrSize = LAS_VLR.HEADER_SIZE + contentSize;
    const vlrBuffer = new ArrayBuffer(vlrSize);
    const vlrView = new DataView(vlrBuffer);

    // Reserved
    vlrView.setUint16(0, 0, true);

    // User ID
    for (let i = 0; i < userId.length; i++) {
      vlrView.setUint8(2 + i, userId.charCodeAt(i));
    }

    // Record ID
    vlrView.setUint16(18, recordId, true);

    // Record Length After Header
    vlrView.setUint16(20, contentSize, true);

    // Description
    for (let i = 0; i < description.length; i++) {
      vlrView.setUint8(22 + i, description.charCodeAt(i));
    }

    return vlrView;
  }

  /**
   * 拡張データ項目の型定義に応じて拡張データ項目のデータタイプを取得する
   * @param extraBytes 拡張データ項目
   * @returns 拡張データ項目のデータタイプ(0～10) 0:undocumented extra bytes
   */
  private getExtraBytesDataType(extraBytes: COPC.Las.ExtraBytes): number {
    if (!extraBytes.type) {
      return 0;
    }

    let dataType = 0;
    if (extraBytes.type === 'unsigned') {
      if (extraBytes.length === 1) {
        dataType = 1;
      } else if (extraBytes.length === 2) {
        dataType = 3;
      } else if (extraBytes.length === 4) {
        dataType = 5;
      } else if (extraBytes.length === 8) {
        dataType = 7;
      }
    } else if (extraBytes.type === 'signed') {
      if (extraBytes.length === 1) {
        dataType = 2;
      } else if (extraBytes.length === 2) {
        dataType = 4;
      } else if (extraBytes.length === 4) {
        dataType = 6;
      } else if (extraBytes.length === 8) {
        dataType = 8;
      }
    } else if (extraBytes.type === 'float') {
      if (extraBytes.length === 4) {
        dataType = 9;
      } else if (extraBytes.length === 8) {
        dataType = 10;
      }
    }

    return dataType;
  }

  /**
   * 拡張データ項目の定義有無に応じて拡張データ項目のオプション値を取得する
   * @param extraBytes 拡張データ項目
   * @returns 拡張データ項目のオプション数値
   */
  private getExtraBytesOptions(extraBytes: COPC.Las.ExtraBytes): number {
    let v = 0;
    if (undefined !== extraBytes.nodata) v |= 1 << 0;
    if (undefined !== extraBytes.min) v |= 1 << 1;
    if (undefined !== extraBytes.max) v |= 1 << 2;
    if (undefined !== extraBytes.scale) v |= 1 << 3;
    if (undefined !== extraBytes.offset) v |= 1 << 4;

    return v;
  }

  /**
   * 拡張データ項目のバイナリデータを生成する
   * @param extraBytesList 拡張データ項目
   * @returns 拡張データ項目のバイナリデータ
   */
  private getBinaryExtraBytes(extraBytesList: COPC.Las.ExtraBytes[]): DataView {
    // 可変長レコードの拡張データ項目のヘッダ部を設定
    const ebsView = this.getBinaryVlr(
      LAS_VLR.EXTRA_BYTES_USER_ID,
      LAS_VLR.EXTRA_BYTES_RECORD_ID,
      '',
      LAS_VLR.EXTRA_BYTES_CONTENT_SIZE * extraBytesList.length,
    );

    // タイプ別のデータ設定定義
    const setAnyType = (type: string | undefined, offset: number, value: number) => {
      if (type === 'signed') {
        ebsView.setBigInt64(offset, BigInt(value), true);
      } else if (type === 'unsigned') {
        ebsView.setBigUint64(offset, BigInt(value), true);
      } else if (type === 'float') {
        ebsView.setFloat64(offset, value, true);
      }
    };

    for (let i = 0; i < extraBytesList.length; i++) {
      let offset = LAS_VLR.HEADER_SIZE + LAS_VLR.EXTRA_BYTES_CONTENT_SIZE * i;
      const eb = extraBytesList[i];

      // reserved (unsigned char[2])
      ebsView.setUint16(offset, 0, true);
      offset += BYTE_SIZE.UINT16;

      // data type (unsigned char)
      const dataType = this.getExtraBytesDataType(eb);
      ebsView.setUint8(offset, dataType);
      offset += BYTE_SIZE.UINT8;

      if (dataType === 0) {
        // options (unsigned char)
        ebsView.setUint8(offset, eb.length);
        offset += BYTE_SIZE.UINT8;

        // name (unsigned char[32])
        for (let i = 0; i < 32; i++) {
          ebsView.setUint8(offset, eb.name.charCodeAt(i));
          offset += BYTE_SIZE.UINT8;
        }

        // SKIP
        offset += BYTE_SIZE.UINT8 * 126;

        // description (unsigned char[32])
        for (let i = 0; i < 32; i++) {
          ebsView.setUint8(offset, eb.description.charCodeAt(i));
          offset += BYTE_SIZE.UINT8;
        }
      } else {
        // options (unsigned char)
        const options = this.getExtraBytesOptions(eb);
        ebsView.setUint8(offset, options);
        offset += BYTE_SIZE.UINT8;

        // name (unsigned char[32])
        for (let i = 0; i < 32; i++) {
          ebsView.setUint8(offset, eb.name.charCodeAt(i));
          offset += BYTE_SIZE.UINT8;
        }

        // unused (unsigned char[4])
        offset += BYTE_SIZE.UINT8 * 4;

        // no_data (any type)
        if (undefined !== eb.nodata) {
          setAnyType(eb.type, offset, eb.nodata);
        }
        offset += BYTE_SIZE.FLOAT64;

        // deprecated1 (unsigned char[16])
        offset += BYTE_SIZE.UINT8 * 16;

        // min (any type)
        if (undefined !== eb.min) {
          setAnyType(eb.type, offset, eb.min);
        }
        offset += BYTE_SIZE.FLOAT64;

        // deprecated2 (unsigned char[16])
        offset += BYTE_SIZE.UINT8 * 16;

        // max (any type)
        if (undefined !== eb.max) {
          setAnyType(eb.type, offset, eb.max);
        }
        offset += BYTE_SIZE.FLOAT64;

        // deprecated3 (unsigned char[16])
        offset += BYTE_SIZE.UINT8 * 16;

        // scale (double)
        if (undefined !== eb.scale) {
          ebsView.setFloat64(offset, eb.scale, true);
        }
        offset += BYTE_SIZE.FLOAT64;

        // deprecated4 (unsigned char[16])
        offset += BYTE_SIZE.UINT8 * 16;

        // offset (double)
        if (undefined !== eb.offset) {
          ebsView.setFloat64(offset, eb.offset, true);
        }
        offset += BYTE_SIZE.FLOAT64;

        // deprecated5 (unsigned char[16])
        offset += BYTE_SIZE.UINT8 * 16;

        // description (unsigned char[32])
        for (let i = 0; i < 32; i++) {
          ebsView.setUint8(offset, eb.description.charCodeAt(i));
          offset += BYTE_SIZE.UINT8;
        }
      }
    }

    return ebsView;
  }

  /**
   * LAS形式の点群データ部のバイナリデータに拡張データ項目の値を設定する
   * @param view LAS形式の点群データ部のバイナリデータ
   * @param offset データ設定オフセット位置
   * @param data 設定データ
   * @param extraBytes 拡張データ項目
   * @returns データ設定後オフセット位置
   */
  private setExtraBytesData(view: DataView, offset: number, data: number, extraBytes: COPC.Las.ExtraBytes): number {
    if (extraBytes.type === 'signed') {
      if (extraBytes.length === 1) {
        view.setInt8(offset, data);
        offset += BYTE_SIZE.INT8;
      } else if (extraBytes.length === 2) {
        view.setInt16(offset, data, true);
        offset += BYTE_SIZE.INT16;
      } else if (extraBytes.length === 4) {
        view.setInt32(offset, data, true);
        offset += BYTE_SIZE.INT32;
      } else if (extraBytes.length === 8) {
        view.setBigInt64(offset, BigInt(data), true);
        offset += BYTE_SIZE.BIG_INT64;
      }
    } else if (extraBytes.type === 'unsigned') {
      if (extraBytes.length === 1) {
        view.setUint8(offset, data);
        offset += BYTE_SIZE.UINT8;
      } else if (extraBytes.length === 2) {
        view.setUint16(offset, data, true);
        offset += BYTE_SIZE.UINT16;
      } else if (extraBytes.length === 4) {
        view.setUint32(offset, data, true);
        offset += BYTE_SIZE.UINT32;
      } else if (extraBytes.length === 8) {
        view.setBigUint64(offset, BigInt(data), true);
        offset += BYTE_SIZE.BIG_UINT64;
      }
    } else if (extraBytes.type === 'float') {
      if (extraBytes.length === 4) {
        view.setFloat32(offset, data, true);
        offset += BYTE_SIZE.FLOAT32;
      } else if (extraBytes.length === 8) {
        view.setFloat64(offset, data, true);
        offset += BYTE_SIZE.FLOAT64;
      }
    }

    return offset;
  }

  /**
   * LAS形式の点群データ部のバイナリデータを取得する
   * @param pointDatas 点群データのバイナリデータ(内部データ管理形式)
   * @param lasHeader LAS形式のヘッダ情報
   * @param extraBytesList 拡張データ項目
   * @returns LAS形式の点群データ部のバイナリデータ
   */
  private getBinaryLasPointData(
    pointDatas: DataView,
    lasHeader: LasHeader,
    extraBytesList: COPC.Las.ExtraBytes[],
  ): DataView {
    // データ領域確保
    const pointNum = pointDatas.byteLength / POINT_DATA_VIEW_SIZE;
    const structSize = lasHeader.pointDataRecordLength * pointNum;
    const buffer = new ArrayBuffer(structSize);
    const view = new DataView(buffer);

    // 点座標のスケールオフセット適用処理
    const apply = (v: number, scale: number = 1, offset: number = 0) => (v - offset) / scale;

    // データを設定
    let inOffset = 0;
    let outOffset = 0;
    for (let i = 0; i < pointNum; i++) {
      inOffset = i * POINT_DATA_VIEW_SIZE;

      // XYZ座標 (long)
      const X = apply(
        pointDatas.getFloat64(inOffset + POINT_DATA_VIEW_OFFSET.X),
        lasHeader.scale[0],
        lasHeader.offset[0],
      );
      view.setInt32(outOffset, X, true);
      outOffset += BYTE_SIZE.INT32;
      const Y = apply(
        pointDatas.getFloat64(inOffset + POINT_DATA_VIEW_OFFSET.Y),
        lasHeader.scale[1],
        lasHeader.offset[1],
      );
      view.setInt32(outOffset, Y, true);
      outOffset += BYTE_SIZE.INT32;
      const Z = apply(
        pointDatas.getFloat64(inOffset + POINT_DATA_VIEW_OFFSET.Z),
        lasHeader.scale[2],
        lasHeader.offset[2],
      );
      view.setInt32(outOffset, Z, true);
      outOffset += BYTE_SIZE.INT32;

      // Intensity (unsigned short)
      view.setUint16(outOffset, pointDatas.getUint16(inOffset + POINT_DATA_VIEW_OFFSET.INTENSITY), true);
      outOffset += BYTE_SIZE.UINT16;

      // Return Number (4 bits (bits 0-3))
      // Number of Returns (Given Pulse) (4 bits (bits 4-7), 4)
      const numberOfReturns = pointDatas.getUint8(inOffset + POINT_DATA_VIEW_OFFSET.NUMBER_OF_RETURNS) << 4;
      const retNum = numberOfReturns | pointDatas.getUint8(inOffset + POINT_DATA_VIEW_OFFSET.RETURN_NUMBER);
      view.setUint8(outOffset, retNum);
      outOffset += BYTE_SIZE.UINT8;

      // Classification Flags (4 bits (bits 0-3))
      const classificationFlags =
        (pointDatas.getUint8(inOffset + POINT_DATA_VIEW_OFFSET.OVERLAP) << 3) |
        (pointDatas.getUint8(inOffset + POINT_DATA_VIEW_OFFSET.WITHHELD) << 2) |
        (pointDatas.getUint8(inOffset + POINT_DATA_VIEW_OFFSET.KEY_POINT) << 1) |
        (pointDatas.getUint8(inOffset + POINT_DATA_VIEW_OFFSET.SYNTHETIC) << 0);

      // Scanner Channel (2 bits (bits 4-5))
      // Scan Direction Flag (1 bit (bit 6))
      // Edge of Flight Line (1 bit (bit 7))
      const bitData =
        (pointDatas.getUint8(inOffset + POINT_DATA_VIEW_OFFSET.EDGE_OF_FLIGHT_LINE) << 7) |
        (pointDatas.getUint8(inOffset + POINT_DATA_VIEW_OFFSET.SCAN_DIRECTION_FLAG) << 6) |
        (pointDatas.getUint8(inOffset + POINT_DATA_VIEW_OFFSET.SCANNER_CHANNEL) << 4) |
        classificationFlags;
      view.setUint8(outOffset, bitData);
      outOffset += BYTE_SIZE.UINT8;

      // Classification (unsigned char)
      view.setUint8(outOffset, pointDatas.getUint8(inOffset + POINT_DATA_VIEW_OFFSET.CLASSIFICATION));
      outOffset += BYTE_SIZE.UINT8;

      // User Data (unsigned char)
      view.setUint8(outOffset, pointDatas.getUint8(inOffset + POINT_DATA_VIEW_OFFSET.USER_DATA));
      outOffset += BYTE_SIZE.UINT8;

      // Scan Angle (short)
      view.setInt16(outOffset, pointDatas.getInt16(inOffset + POINT_DATA_VIEW_OFFSET.SCAN_ANGLE), true);
      outOffset += BYTE_SIZE.INT16;

      // Point Source ID (unsigned short)
      view.setUint16(outOffset, pointDatas.getUint16(inOffset + POINT_DATA_VIEW_OFFSET.POINT_SOURCE_ID), true);
      outOffset += BYTE_SIZE.UINT16;

      // GPS Time (double)
      view.setFloat64(outOffset, pointDatas.getFloat64(inOffset + POINT_DATA_VIEW_OFFSET.GPS_TIME), true);
      outOffset += BYTE_SIZE.FLOAT64;

      if (7 <= lasHeader.pointDataRecordFormat) {
        // Point Data Record Formatが7以上
        // Red (unsigned short)
        view.setUint16(outOffset, pointDatas.getInt32(inOffset + POINT_DATA_VIEW_OFFSET.RED), true);
        outOffset += BYTE_SIZE.UINT16;
        // Green (unsigned short)
        view.setUint16(outOffset, pointDatas.getInt32(inOffset + POINT_DATA_VIEW_OFFSET.GREEN), true);
        outOffset += BYTE_SIZE.UINT16;
        // Blue (unsigned short)
        view.setUint16(outOffset, pointDatas.getInt32(inOffset + POINT_DATA_VIEW_OFFSET.BLUE), true);
        outOffset += BYTE_SIZE.UINT16;
      }
      if (8 <= lasHeader.pointDataRecordFormat) {
        // NIR (unsigned short)
        view.setUint16(outOffset, pointDatas.getInt32(inOffset + POINT_DATA_VIEW_OFFSET.NIR), true);
        outOffset += BYTE_SIZE.UINT16;
      }

      // 拡張データ項目
      for (const extraBytes of extraBytesList) {
        // 設定データ取得
        let setData = 0;
        switch (extraBytes.name) {
          case POINT_DATA_ITEM.INDEX1: {
            const value = pointDatas.getInt32(inOffset + POINT_DATA_VIEW_OFFSET.INDEX1);
            setData = 0 <= value ? value : 0;
            break;
          }
          case POINT_DATA_ITEM.INDEX2: {
            const value = pointDatas.getInt32(inOffset + POINT_DATA_VIEW_OFFSET.INDEX2);
            setData = 0 <= value ? value : 0;
            break;
          }
          case POINT_DATA_ITEM.INDEX3: {
            const value = pointDatas.getInt32(inOffset + POINT_DATA_VIEW_OFFSET.INDEX3);
            setData = 0 <= value ? value : 0;
            break;
          }
          default:
            setData = 0;
            break;
        }

        // データ設定
        outOffset = this.setExtraBytesData(view, outOffset, setData, extraBytes);
      }
    }

    return view;
  }
}
