/**
 * @fileoverview ログ操作のクラスの定義
 * @author Kota Kubota(SEQ)
 * @created 2025/04/29
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import {Logger, ILogObjMeta} from 'tslog';
import {LOG_CONF} from './logConf';
import {format} from 'date-fns';

/**
 * @interface 出力ログ情報
 */
interface LogObj {
  timestamp: string;
  code: string;
  level: string;
  message: string;
}

/**
 * @interface ログ定義
 */
export interface LogDef {
  code: string;
  message: string;
}

// タイムスタンプフォーマット
const TIMESTAMP_FORMAT = "yyyy-MM'T'dd-HH:mm:ss+0900";

// デフォルトログレベル
const DEFAULT_LOG_LEVEL = 'INFO';
const DEFAULT_LOG_LEVEL_NO = 3;

// ログレベルテーブル
export const LOG_LEVEL_NO_TABLE: Map<string, number> = new Map();
LOG_LEVEL_NO_TABLE.set('FATAL', 6);
LOG_LEVEL_NO_TABLE.set('ERROR', 5);
LOG_LEVEL_NO_TABLE.set('WARN', 4);
LOG_LEVEL_NO_TABLE.set('INFO', 3);
LOG_LEVEL_NO_TABLE.set('DEBUG', 2);
LOG_LEVEL_NO_TABLE.set('TRACE', 1);

// ログレベル取得定義
const GET_LOG_STR = (logLevel: string): string => {
  if (LOG_LEVEL_NO_TABLE.has(logLevel)) {
    return logLevel;
  } else {
    return DEFAULT_LOG_LEVEL;
  }
};

/**
 * ログ操作のクラス
 */
export class Logging {
  /**
   * コンストラクタ
   */
  private constructor() {
    // private constructor to prevent instantiation
  }

  // カスタムJSONログ出力定義
  static transportJson(logObj: unknown): void {
    const object = logObj as LogObj & ILogObjMeta;
    delete object._meta;
    const json = JSON.stringify(object);
    console.log(json);
  }

  // ログ出力オブジェクト
  static logger: Logger<object> = new Logger({
    type: 'json',
    minLevel: DEFAULT_LOG_LEVEL_NO,
    overwrite: {
      transportJSON: Logging.transportJson,
    },
  });

  /**
   * 出力する最低ログレベルを設定します
   * @param logLevel
   */
  static setLogLevel(logLevel: string): void {
    const setLevel = GET_LOG_STR(logLevel);
    Logging.logger.settings.minLevel = LOG_LEVEL_NO_TABLE.get(setLevel)!;
    Logging.info(LOG_CONF.INFO_SET_LOGLEVEL, setLevel);
  }

  /**
   * 出力するログのメッセージを取得する
   * @param message ログ定義のメッセージ
   * @param args メッセージ置換文字列
   * @returns メッセージ文字列
   */
  static getMessage(message: string, args: string[]): string {
    let tmpMessage = message;
    for (let i = 0; i < args.length; i++) {
      tmpMessage = tmpMessage.replace('{' + i + '}', args[i]);
    }
    return tmpMessage;
  }

  /**
   * 出力するログのタイムスタンプ文字列を取得する
   * @returns タイムスタンプ文字列
   */
  static getTimestamp(): string {
    const dt = format(new Date(), TIMESTAMP_FORMAT);
    return dt;
  }

  /**
   * ログレベルがTRACEのログを出力する
   * @param log 出力ログの定義
   * @param args ログメッセージの引数
   * @returns 出力メッセージ
   */
  static trace(log: LogDef, ...args: string[]): string {
    const dt = Logging.getTimestamp();
    const message = Logging.getMessage(log.message, args);
    Logging.logger.trace({timestamp: dt, code: log.code, level: 'TRACE', message: message});

    return message;
  }

  /**
   * ログレベルがDEBUGのログを出力する
   * @param log 出力ログの定義
   * @param args ログメッセージの引数
   * @returns 出力メッセージ
   */
  static debug(log: LogDef, ...args: string[]): string {
    const dt = Logging.getTimestamp();
    const message = Logging.getMessage(log.message, args);
    Logging.logger.debug({timestamp: dt, code: log.code, level: 'DEBUG', message: message});

    return message;
  }

  /**
   * ログレベルがINFOのログを出力する
   * @param log 出力ログの定義
   * @param args ログメッセージの引数
   * @returns 出力メッセージ
   */
  static info(log: LogDef, ...args: string[]): string {
    const dt = Logging.getTimestamp();
    const message = Logging.getMessage(log.message, args);
    Logging.logger.info({timestamp: dt, code: log.code, level: 'INFO', message: message});

    return message;
  }

  /**
   * ログレベルがWARNのログを出力する
   * @param log 出力ログの定義
   * @param args ログメッセージの引数
   * @returns 出力メッセージ
   */
  static warn(log: LogDef, ...args: string[]): string {
    const dt = Logging.getTimestamp();
    const message = Logging.getMessage(log.message, args);
    Logging.logger.warn({timestamp: dt, code: log.code, level: 'WARN', message: message});

    return message;
  }

  /**
   * ログレベルがERRORのログを出力する
   * @param log 出力ログの定義
   * @param args ログメッセージの引数
   * @returns 出力メッセージ
   */
  static error(log: LogDef, ...args: string[]): string {
    const dt = Logging.getTimestamp();
    const message = Logging.getMessage(log.message, args);
    Logging.logger.error({timestamp: dt, code: log.code, level: 'ERROR', message: message});

    return message;
  }

  /**
   * ログレベルがFATALのログを出力する
   * @param log 出力ログの定義
   * @param args ログメッセージの引数
   * @returns 出力メッセージ
   */
  static fatal(log: LogDef, ...args: string[]): string {
    const dt = Logging.getTimestamp();
    const message = Logging.getMessage(log.message, args);
    Logging.logger.fatal({timestamp: dt, code: log.code, level: 'FATAL', message: message});

    return message;
  }
}
