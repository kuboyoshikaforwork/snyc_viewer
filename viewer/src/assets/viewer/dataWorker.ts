/**
 * @fileoverview 点群データロード処理のワーカースレッド
 * @author Masaaki Takeuchi(MESW)
 * @created 2025/05/23
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import * as COPC from 'copc';
import {DB_ERROR, IndexedDbUtil} from '../../viewer/util/indexedDbUtil';
import {POINT_DATA_ITEM, POINT_DATA_VIEW_OFFSET, POINT_DATA_VIEW_SIZE} from '../../viewer/util/constant';
import {CopcHeader, WorkerPostData} from '../../viewer/pointCloud/copcInfo';
import {Logging} from '../../viewer/log/logging';
import {LOG_CONF} from '../../viewer/log/logConf';

/** WebWorkerオブジェクト */
const ctx: Worker = self as unknown as Worker;

/**
 * メインスレッド側からのメッセージ受信時の処理
 * Webサーバから点群データを取得し、整形した点群のバイナリデータをメインスレッドに送信する
 * @param event メッセージイベントオブジェクト
 */
ctx.onmessage = async (event: MessageEvent<WorkerPostData>) => {
  // 受け渡しデータ取得
  const {copcHeader, node, filePath, key, url, accessToken, eye, posInfos, addIndexedDB} = event.data;

  // 送信用点群バイナリデータ
  let postBuffer: ArrayBuffer | undefined = undefined;

  // データのIndexedDBの格納状態
  const dataStored = await IndexedDbUtil.isDataStored(filePath, key);

  if (dataStored) {
    // IndexedDBから点群データ取得
    try {
      const pointDataView = await IndexedDbUtil.getPointData(filePath, key);
      if (pointDataView) {
        postBuffer = pointDataView.buffer;
      }
    } catch {
      // IndexedDB側でログ出力済かつIndexedDBからデータ取得失敗時は
      // サイズ0で通知するためここでは何もしない
    }
  } else {
    // Webサーバから点群データ取得
    let pointDatas: COPC.View | undefined = undefined;

    if (copcHeader && node) {
      try {
        const buffer = await loadPointDataView(copcHeader, node, url, accessToken);
        pointDatas = COPC.Las.View.create(buffer, copcHeader.header, copcHeader.eb);
      } catch (error: unknown) {
        if (error instanceof Error) {
          // サーバから点群データ取得に失敗した場合サイズ0で通知するためここでは何もしない
          Logging.warn(LOG_CONF.WARN_GET_POINT_CLOUD_DATA, filePath, key, error.message);
        } else {
          Logging.error(LOG_CONF.ERROR_UNKNOWN, 'onmessage', String(error));
        }
      }
    } else {
      Logging.error(LOG_CONF.ERROR_COPC_HEADER_DATA_UNDEFINED);
    }

    if (pointDatas) {
      // サーバから取得したデータをバイナリデータに変換
      postBuffer = getPointArrayBuffer(pointDatas);

      // IndexedDBにデータを格納
      if (postBuffer && addIndexedDB && undefined !== eye && undefined !== posInfos) {
        try {
          await IndexedDbUtil.putPointData(filePath, key, postBuffer);
        } catch (error: unknown) {
          if (error && error instanceof DOMException && error.name === DB_ERROR.QUOTA_EXCEEDED) {
            // キャッシュ済の点群データ削除
            await deleteCachedPointData(eye, posInfos);
          }
        }
      }
    }
  }

  // メインスレッドに点群データを送信
  if (postBuffer) {
    // 点群データ取得成功
    ctx.postMessage(postBuffer, [postBuffer]);
  } else {
    // 点群データ取得失敗(サイズ0で送信)
    postBuffer = new ArrayBuffer(0);
    ctx.postMessage(postBuffer, [postBuffer]);
  }
};

/**
 * メインスレッド側からの解読不可のメッセージ受信時の処理(通常発生しない処理)
 */
ctx.onmessageerror = () => {
  Logging.error(LOG_CONF.ERROR_SUB_WORKER_ON_MESSAGE);

  // 点群データ取得失敗(サイズ0で送信)
  const arrayBuffer = new ArrayBuffer(0);
  ctx.postMessage(arrayBuffer, [arrayBuffer]);
};

/**
 * 点群位置情報や点群データの格納状態に基づいてキャッシュした点群データを破棄する
 * @param eye 視点位置
 * @param posInfos 点群位置一覧
 */
async function deleteCachedPointData(eye: number[], posInfos: Map<string, number[]>): Promise<void> {
  // IndexedDBのデータベース名称の一覧取得
  let deleted: boolean = false;
  const databases: IDBDatabaseInfo[] = await IndexedDbUtil.getDatabases();

  // 表示中以外の点群がIndexedDBに格納されている場合削除する
  for (const database of databases) {
    if (!(database.name && posInfos.has(database.name))) {
      await IndexedDbUtil.deleteDb(database.name!);
      deleted = true;
    }
  }

  // 3次元座標でない場合終了
  if (eye.length !== 3) {
    return;
  }

  if (!deleted) {
    // 削除できていない場合位置情報(視点から最も遠い点群)に応じて削除する
    let maxDist: number = Number.MIN_SAFE_INTEGER;
    let deleteTarget: string | undefined = undefined;
    for (const database of databases) {
      if (database.name && posInfos.has(database.name)) {
        const pos = posInfos.get(database.name)!;
        if (pos.length !== 3) {
          continue;
        }
        const dist = Math.sqrt(
          Math.pow(eye[0] - pos[0], 2) + Math.pow(eye[1] - pos[1], 2) + Math.pow(eye[2] - pos[2], 2),
        );
        if (maxDist < dist) {
          maxDist = dist;
          deleteTarget = database.name;
        }
      }
    }

    // 削除処理
    if (deleteTarget) {
      try {
        await IndexedDbUtil.deleteDb(deleteTarget);
      } catch {
        // 呼び出し先でログ出力済
      }
    }
  }
}

/**
 * Webサーバから点群データのバイナリデータをロードする
 * @param copc COPCのヘッダ情報
 * @param node ロード対象のノード情報
 * @param url 点群データのURL(ファイルパス含む)
 * @param accessToken ユーザのアクセストークン
 * @returns 点群データのバイナリデータ
 * @throws COPC点データ取得失敗
 */
async function loadPointDataView(
  copc: CopcHeader,
  node: COPC.Hierarchy.Node,
  url: string,
  accessToken: string,
): Promise<COPC.Binary> {
  // 圧縮点群データ取得
  const get = createCopcGetter(url, accessToken);
  const compressed = await get(node.pointDataOffset, node.pointDataOffset + node.pointDataLength);

  // 解凍処理用の情報取得
  const {pointDataRecordFormat, pointDataRecordLength}: COPC.Las.Header = copc.header;
  const {pointCount} = node;

  // 圧縮点群データをバイナリデータに解凍
  const buffer = await COPC.Las.PointData.decompressChunk(compressed, {
    pointCount,
    pointDataRecordFormat,
    pointDataRecordLength,
  });

  return buffer;
}

/**
 * COPCデータ取得用のリクエスト処理を生成する
 * @param url 点群データのURL(ファイルパス含む)
 * @param accessToken ユーザのアクセストークン
 * @returns リクエスト処理のオブジェクト
 */
function createCopcGetter(url: string, accessToken: string): COPC.Getter {
  // リクエスト処理オブジェクト
  return async function getRemote(begin: number, end: number) {
    if (begin < 0 || end < 0 || begin > end) {
      throw new Error(`リクエスト範囲異常(${url} : ${begin}-${end})`);
    }
    const response = await fetch(url, {
      headers: {
        Range: `bytes=${begin}-${end - 1}`,
        Authorization: 'Bearer ' + accessToken,
      },
    });
    if (!response.ok) {
      throw new Error(`リクエスト失敗(${url})`);
    }
    const ab = await response.arrayBuffer();
    return new Uint8Array(ab);
  };
}

/**
 * Webサーバから取得した点群データをバイナリデータで取得する
 * @param pointDatas 点群データ取得オブジェクト
 * @returns 点群のバイナリデータ(構造整形)
 * @throws 点群データ項目不整合
 */
function getPointArrayBuffer(pointDatas: COPC.View): ArrayBuffer | undefined {
  // データ領域確保
  let dataBuffer: ArrayBuffer | undefined = new ArrayBuffer(POINT_DATA_VIEW_SIZE * pointDatas.pointCount);
  const pointDataView = new DataView(dataBuffer);

  // データ項目一覧取得
  const items = Object.keys(pointDatas.dimensions);

  // キー：項目名、値：インデックス番号
  const indexs: Map<string, number> = new Map();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    indexs.set(item, i);
  }

  // 単一点データ取得用関数定義
  const getters: COPC.View.Getter[] = items.map(pointDatas.getter);
  const getUnitPointData = (index: number) => {
    return getters.map((get: (index: number) => number) => get(index));
  };

  // 必須データ項目取得用関数定義
  const getRequireValue = (data: number[], item: string) => {
    if (!indexs.has(item)) {
      throw new Error(`データ項目[${item}]未定義`);
    }
    return Number(data[indexs.get(item)!]);
  };

  // 任意データ項目取得用関数定義(存在しない場合は負数)
  const getOptionValue = (data: number[], item: string) => {
    if (indexs.has(item)) {
      return Number(data[indexs.get(item)!]);
    } else {
      return -1;
    }
  };

  try {
    let offset = 0;
    for (let i = 0; i < pointDatas.pointCount; i++) {
      // 先頭オフセット位置設定
      offset = i * POINT_DATA_VIEW_SIZE;

      // 単一点データ取得
      const data = getUnitPointData(i);

      // XYZ
      pointDataView.setFloat64(offset + POINT_DATA_VIEW_OFFSET.X, getRequireValue(data, POINT_DATA_ITEM.X));
      pointDataView.setFloat64(offset + POINT_DATA_VIEW_OFFSET.Y, getRequireValue(data, POINT_DATA_ITEM.Y));
      pointDataView.setFloat64(offset + POINT_DATA_VIEW_OFFSET.Z, getRequireValue(data, POINT_DATA_ITEM.Z));

      // Intensity
      pointDataView.setUint16(
        offset + POINT_DATA_VIEW_OFFSET.INTENSITY,
        getRequireValue(data, POINT_DATA_ITEM.INTENSITY),
      );

      // Return Number
      pointDataView.setUint8(
        offset + POINT_DATA_VIEW_OFFSET.RETURN_NUMBER,
        getRequireValue(data, POINT_DATA_ITEM.RETURN_NUMBER),
      );

      // Number of Returns
      pointDataView.setUint8(
        offset + POINT_DATA_VIEW_OFFSET.NUMBER_OF_RETURNS,
        getRequireValue(data, POINT_DATA_ITEM.NUMBER_OF_RETURNS),
      );

      // Synthetic
      pointDataView.setUint8(
        offset + POINT_DATA_VIEW_OFFSET.SYNTHETIC,
        getRequireValue(data, POINT_DATA_ITEM.SYNTHETIC),
      );
      // KeyPoint
      pointDataView.setUint8(
        offset + POINT_DATA_VIEW_OFFSET.KEY_POINT,
        getRequireValue(data, POINT_DATA_ITEM.KEY_POINT),
      );
      // Withheld
      pointDataView.setUint8(offset + POINT_DATA_VIEW_OFFSET.WITHHELD, getRequireValue(data, POINT_DATA_ITEM.WITHHELD));
      // Overlap
      pointDataView.setUint8(offset + POINT_DATA_VIEW_OFFSET.OVERLAP, getRequireValue(data, POINT_DATA_ITEM.OVERLAP));

      // Scanner Channel
      pointDataView.setUint8(
        offset + POINT_DATA_VIEW_OFFSET.SCANNER_CHANNEL,
        getRequireValue(data, POINT_DATA_ITEM.SCANNER_CHANNEL),
      );

      // Scan Direction Flag
      pointDataView.setUint8(
        offset + POINT_DATA_VIEW_OFFSET.SCAN_DIRECTION_FLAG,
        getRequireValue(data, POINT_DATA_ITEM.SCAN_DIRECTION_FLAG),
      );

      // Edge Of Flight Line
      pointDataView.setUint8(
        offset + POINT_DATA_VIEW_OFFSET.EDGE_OF_FLIGHT_LINE,
        getRequireValue(data, POINT_DATA_ITEM.EDGE_OF_FLIGHT_LINE),
      );

      // Classification
      pointDataView.setUint8(
        offset + POINT_DATA_VIEW_OFFSET.CLASSIFICATION,
        getRequireValue(data, POINT_DATA_ITEM.CLASSIFICATION),
      );

      // UserData
      pointDataView.setUint8(
        offset + POINT_DATA_VIEW_OFFSET.USER_DATA,
        getRequireValue(data, POINT_DATA_ITEM.USER_DATA),
      );

      // Scan Angle
      pointDataView.setInt16(
        offset + POINT_DATA_VIEW_OFFSET.SCAN_ANGLE,
        getRequireValue(data, POINT_DATA_ITEM.SCAN_ANGLE),
      );

      // Point Source Id
      pointDataView.setUint16(
        offset + POINT_DATA_VIEW_OFFSET.POINT_SOURCE_ID,
        getRequireValue(data, POINT_DATA_ITEM.POINT_SOURCE_ID),
      );

      // GPS Time
      pointDataView.setFloat64(
        offset + POINT_DATA_VIEW_OFFSET.GPS_TIME,
        getRequireValue(data, POINT_DATA_ITEM.GPS_TIME),
      );

      // Red
      pointDataView.setInt32(offset + POINT_DATA_VIEW_OFFSET.RED, getOptionValue(data, POINT_DATA_ITEM.RED));
      // Green
      pointDataView.setInt32(offset + POINT_DATA_VIEW_OFFSET.GREEN, getOptionValue(data, POINT_DATA_ITEM.GREEN));
      // Blue
      pointDataView.setInt32(offset + POINT_DATA_VIEW_OFFSET.BLUE, getOptionValue(data, POINT_DATA_ITEM.BLUE));

      // NIR
      pointDataView.setInt32(offset + POINT_DATA_VIEW_OFFSET.NIR, getOptionValue(data, POINT_DATA_ITEM.NIR));

      // index
      pointDataView.setInt32(offset + POINT_DATA_VIEW_OFFSET.INDEX1, getOptionValue(data, POINT_DATA_ITEM.INDEX1));
      pointDataView.setInt32(offset + POINT_DATA_VIEW_OFFSET.INDEX2, getOptionValue(data, POINT_DATA_ITEM.INDEX2));
      pointDataView.setInt32(offset + POINT_DATA_VIEW_OFFSET.INDEX3, getOptionValue(data, POINT_DATA_ITEM.INDEX3));
    }
  } catch (e: unknown) {
    if (e instanceof Error) {
      Logging.warn(LOG_CONF.ERROR_COPC_FILE_FORMAT, e.message);
      dataBuffer = undefined;
    }
  }

  return dataBuffer;
}
