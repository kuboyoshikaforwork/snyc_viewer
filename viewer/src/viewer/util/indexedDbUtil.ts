/**
 * @fileoverview IndexedDBユーティリティクラスの定義
 * @author Kota Kubota(SEQ)
 * @created 2025/05/01
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import {Logging} from '../log/logging';
import {LOG_CONF} from '../log/logConf';

/** IndexedDBのオブジェクトストア名称 */
const DB_STORE_NAME = 'COPC';
/** IndexedDBのバージョン定義 */
const DB_VERSION = 1;
/** IndexedDBのエラー定義 */
export const DB_ERROR = {
  QUOTA_EXCEEDED: 'QuotaExceededError',
};

/**
 * IndexedDBのユーティリティクラス
 */
export class IndexedDbUtil {
  /**
   * データベースに点群データを格納する。データベースが生成されていない場合はデータベースを生成する。
   * @param dbName データベース名称(ファイルパス)
   * @param key テーブルの主キー名称(ノードのキー)
   * @param data 格納するデータ
   * @throws データ追加失敗・ストレージ容量超過
   */
  static async putPointData(dbName: string, key: string, data: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      // DBオープン
      const openReq: IDBOpenDBRequest = indexedDB.open(dbName, DB_VERSION);

      // DB新規作成またはバージョン変更時
      openReq.onupgradeneeded = () => {
        try {
          // オブジェクトストア生成
          const db: IDBDatabase = openReq.result;
          db.createObjectStore(DB_STORE_NAME);
        } catch (error: unknown) {
          if (error instanceof DOMException) {
            const message = Logging.warn(LOG_CONF.WARN_CREATE_OBJECTSTORES_INDEXEDDB, dbName);
            reject(new Error(message));
          } else {
            const message = Logging.warn(LOG_CONF.WARN_UNKNOWN_INDEXEDDB, String(error));
            reject(new Error(message));
          }
        }
      };
      // DBオープン失敗時
      openReq.onerror = () => {
        const message = Logging.warn(LOG_CONF.WARN_OPEN_INDEXEDDB, dbName);
        reject(new Error(message));
      };
      // DBオープン中
      openReq.onblocked = () => {
        const message = Logging.warn(LOG_CONF.WARN_OPEN_INDEXEDDB, dbName);
        reject(new Error(message));
      };
      // DBオープン成功時(onupgradeneededの後に実行。DBの更新がない場合はこれだけ実行)
      openReq.onsuccess = () => {
        try {
          // オブジェクトストアを読み書き権限付きで使用するトランザクション取得
          const db: IDBDatabase = openReq.result;
          const transaction = db.transaction([DB_STORE_NAME], 'readwrite');

          // 各オブジェクトストアの取り出し
          const objectStore = transaction.objectStore(DB_STORE_NAME);

          // データ追加要求
          const putReq = objectStore.put(data, key);

          // 要求失敗
          putReq.onerror = (event: Event) => {
            Logging.warn(LOG_CONF.WARN_INSERT_INDEXEDDB, dbName, key);
            event.preventDefault();
          };
          // 要求成功
          putReq.onsuccess = () => {
            // トランザクションイベントで通知を投げるため処理無し
            Logging.debug(LOG_CONF.DEBUG_INSERT_INDEXEDDB_DATA, dbName, key);
          };

          // トランザクションアボート
          transaction.onabort = (event: Event) => {
            db.close();
            if (event.target instanceof IDBTransaction && event.target.error) {
              // IndexedDBの容量超過検知用処理
              reject(event.target.error);
            } else {
              const message = Logging.warn(LOG_CONF.WARN_INSERT_INDEXEDDB, dbName, key);
              reject(new Error(message));
            }
          };
          // トランザクションエラー
          transaction.onerror = () => {
            // トランザクションアボート側で対応するため処理無し
          };
          // トランザクション完了
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
        } catch (error: unknown) {
          // 処理自体に失敗した場合(要求に対するエラーはイベント処理で対応)
          if (error instanceof DOMException) {
            const message = Logging.warn(LOG_CONF.WARN_INSERT_INDEXEDDB, dbName, key, error.name);
            reject(new Error(message));
          } else {
            const message = Logging.warn(LOG_CONF.WARN_UNKNOWN_INDEXEDDB, String(error));
            reject(new Error(message));
          }
        }
      };
    });
  }

  /**
   * データベースから指定した点群データを取得する
   * @param dbName データベース名称(ファイルパス)
   * @param key テーブルの主キー名称(ノードのキー)
   * @returns 点群データ
   * @throws データ取得失敗
   */
  static async getPointData(dbName: string, key: string): Promise<DataView | undefined> {
    return new Promise((resolve, reject) => {
      // DBオープン
      const openReq: IDBOpenDBRequest = indexedDB.open(dbName, DB_VERSION);

      openReq.onupgradeneeded = () => {
        try {
          // オブジェクトストア生成
          const db: IDBDatabase = openReq.result;
          db.createObjectStore(DB_STORE_NAME);
        } catch (error: unknown) {
          if (error instanceof DOMException) {
            const message = Logging.warn(LOG_CONF.WARN_CREATE_OBJECTSTORES_INDEXEDDB, dbName);
            reject(new Error(message));
          } else {
            const message = Logging.warn(LOG_CONF.WARN_UNKNOWN_INDEXEDDB, String(error));
            reject(new Error(message));
          }
        }
      };

      // DBオープン失敗時
      openReq.onerror = () => {
        const message = Logging.warn(LOG_CONF.WARN_OPEN_INDEXEDDB, dbName);
        reject(new Error(message));
      };
      // DBオープン中
      openReq.onblocked = () => {
        const message = Logging.warn(LOG_CONF.WARN_OPEN_INDEXEDDB, dbName);
        reject(new Error(message));
      };
      // DBオープン成功時
      openReq.onsuccess = (event: Event) => {
        try {
          // オブジェクトストアを読み込み権限付きで使用するトランザクション取得
          const db: IDBDatabase = openReq.result;
          const transaction = db.transaction([DB_STORE_NAME], 'readonly');

          // 各オブジェクトストアの取り出し
          const objectStore = transaction.objectStore(DB_STORE_NAME);
          // データ取得要求
          const getReq = objectStore.get(key);

          // 要求失敗
          getReq.onerror = () => {
            const message = Logging.warn(LOG_CONF.WARN_GET_DATA_FORM_INDEXEDDB, dbName, key);
            reject(new Error(message));
            event.preventDefault();
          };
          // 要求成功
          getReq.onsuccess = (event: Event) => {
            if (event.target instanceof IDBRequest) {
              const buffer = (event.target as IDBRequest).result as ArrayBuffer;
              Logging.debug(LOG_CONF.DEBUG_GET_INDEXEDDB_DATA, dbName, key);
              resolve(new DataView(buffer));
            } else {
              const message = Logging.warn(LOG_CONF.WARN_GET_DATA_FORM_INDEXEDDB, dbName, key);
              reject(new Error(message));
            }
          };

          // トランザクションアボート
          transaction.onabort = () => {
            // 処理結果通知済のため、DBクローズのみ
            Logging.warn(LOG_CONF.WARN_GET_DATA_FORM_INDEXEDDB, DB_STORE_NAME);
            db.close();
          };
          // トランザクションエラー
          transaction.onerror = () => {
            // トランザクションアボート側で対応するため処理無し
          };
          // トランザクション完了
          transaction.oncomplete = () => {
            // 処理結果通知済のため、DBクローズのみ
            db.close();
          };
        } catch (error: unknown) {
          // 処理自体に失敗した場合(要求に対するエラーはイベント処理で対応)
          if (error instanceof DOMException) {
            const message = Logging.warn(LOG_CONF.WARN_GET_DATA_FORM_INDEXEDDB, dbName, key, error.name);
            reject(new Error(message));
          } else {
            const message = Logging.warn(LOG_CONF.WARN_UNKNOWN_INDEXEDDB, String(error));
            reject(new Error(message));
          }
        }
      };
    });
  }

  /**
   * 指定したIndexedDBのデータベースを削除する
   * @param dbName データベース名称(ファイルパス)
   * @throws データベース削除失敗
   */
  static deleteDb(dbName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // データベースの削除を要求
      const deleteReq: IDBOpenDBRequest = indexedDB.deleteDatabase(dbName);

      // 削除失敗
      deleteReq.onerror = () => {
        const message = Logging.warn(LOG_CONF.WARN_DELETE_INDEXEDDB, dbName);
        reject(new Error(message));
      };
      // 削除成功
      deleteReq.onsuccess = () => {
        Logging.debug(LOG_CONF.DEBUG_DELETE_INDEXEDDB_DATA, dbName);
        resolve();
      };
    });
  }

  /**
   * 指定したデータベースのオブジェクトストア名称一覧を取得する
   * @param dbName データベース名称(ファイルパス)
   * @returns オブジェクトストア名称一覧
   * @throws データベースオープン失敗
   */
  static async getObjectStoreKeys(dbName: string): Promise<IDBValidKey[]> {
    return new Promise((resolve, reject) => {
      // DBオープン
      const openReq: IDBOpenDBRequest = indexedDB.open(dbName, DB_VERSION);

      openReq.onupgradeneeded = () => {
        try {
          // オブジェクトストア生成
          const db: IDBDatabase = openReq.result;
          db.createObjectStore(DB_STORE_NAME);
        } catch (error: unknown) {
          if (error instanceof DOMException) {
            const message = Logging.warn(LOG_CONF.WARN_CREATE_OBJECTSTORES_INDEXEDDB, dbName);
            reject(new Error(message));
          } else {
            const message = Logging.warn(LOG_CONF.WARN_UNKNOWN_INDEXEDDB, String(error));
            reject(new Error(message));
          }
        }
      };
      // DBオープン失敗時
      openReq.onerror = () => {
        const message = Logging.warn(LOG_CONF.WARN_OPEN_INDEXEDDB, dbName);
        reject(new Error(message));
      };
      // DBオープン中
      openReq.onblocked = () => {
        const message = Logging.warn(LOG_CONF.WARN_OPEN_INDEXEDDB, dbName);
        reject(new Error(message));
      };
      // DBオープン成功時
      openReq.onsuccess = () => {
        try {
          // オブジェクトストアを読み込み権限付きで使用するトランザクション取得
          const db: IDBDatabase = openReq.result;
          const transaction = db.transaction([DB_STORE_NAME], 'readonly');

          // キー取得要求
          const objectStore = transaction.objectStore(DB_STORE_NAME);
          const getAllKeysRequest = objectStore.getAllKeys();

          // 取得失敗
          getAllKeysRequest.onerror = (event: Event) => {
            const message = Logging.warn(LOG_CONF.WARN_GET_OBJECTSTORES_INDEXEDDB, dbName);
            reject(new Error(message));
            event.preventDefault();
          };
          // 取得成功
          getAllKeysRequest.onsuccess = () => {
            resolve(getAllKeysRequest.result);
          };

          // トランザクションアボート
          transaction.onabort = () => {
            // 処理結果通知済のため、DBクローズのみ
            Logging.warn(LOG_CONF.WARN_GET_OBJECTSTORES_INDEXEDDB, DB_STORE_NAME);
            db.close();
          };
          // トランザクションエラー
          transaction.onerror = () => {
            // トランザクションアボート側で対応するため処理無し
          };
          // トランザクション完了
          transaction.oncomplete = () => {
            // 処理結果通知済のため、DBクローズのみ
            db.close();
          };
        } catch (error: unknown) {
          // 処理自体に失敗した場合(要求に対するエラーはイベント処理で対応)
          if (error instanceof DOMException) {
            const message = Logging.warn(LOG_CONF.WARN_GET_OBJECTSTORES_INDEXEDDB, dbName, error.name);
            reject(new Error(message));
          } else {
            const message = Logging.warn(LOG_CONF.WARN_UNKNOWN_INDEXEDDB, String(error));
            reject(new Error(message));
          }
        }
      };
    });
  }

  /**
   * データの格納状態を取得する(例外発生時は未格納とする)
   * @param dbName データベース名称(ファイルパス)
   * @param key テーブルの主キー名称(ノードのキー)
   * @returns 格納状態(true：格納済、false：未格納)
   */
  static async isDataStored(dbName: string, key: string): Promise<boolean> {
    // すべてのデータベース情報取得
    const databases = await IndexedDbUtil.getDatabases();

    // 判定処理
    for (const database of databases) {
      if (database.name !== dbName) {
        continue;
      }

      try {
        // 指定したオブジェクトストア一覧を取得
        const storeKeys = await IndexedDbUtil.getObjectStoreKeys(dbName);
        for (const storeKey of storeKeys) {
          if (storeKey === key) {
            return true;
          }
        }
      } catch {
        // 処理は継続(判定に失敗した場合は未格納とする)
      }
    }
    return false;
  }

  /**
   * データベース名称の一覧を取得する
   * @returns データベース名称の一覧(取得に失敗した場合は空の配列)
   */
  static async getDatabases(): Promise<IDBDatabaseInfo[]> {
    // すべてのデータベース情報取得
    let databases: IDBDatabaseInfo[] = [];
    try {
      databases = await indexedDB.databases();
    } catch (error: unknown) {
      // データベース一覧取得に失敗した場合空の配列を返す
      if (error instanceof DOMException) {
        Logging.warn(LOG_CONF.WARN_GET_DATABASES);
      } else {
        Logging.warn(LOG_CONF.WARN_UNKNOWN_INDEXEDDB, String(error));
      }
    }

    return databases;
  }
}
