/**
 * @fileoverview モデル系ビューアの設定情報を管理するクラスの定義
 * @author Kota Kubota(SEQ)
 * @created 2025/04/29
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import {ColorRepresentation} from 'three';
import {LOG_LEVEL_NO_TABLE, Logging} from '../log/logging';
import {LOG_CONF} from '../log/logConf';
import {ViewUtil} from '../util/viewUtil';

/** マウスボタン設定の文字列定義 */
const MOUSE_BUTTON_POSITION = ['LEFT', 'MIDDLE', 'RIGHT'];

/** アルファベット定義 */
const ALPHABET_REGEX = /^[a-zA-Z]$/;

/**
 * @interface モデル系ビューア設定定義
 */
export interface ViewConfDef {
  LOG_LEVEL: string;
  BACKGROUD_COLOR: ColorRepresentation;
  PERS_FOV: number;
  PERS_NEAR: number;
  PERS_FAR: number;
  EYE_MOVE_ENABLED: boolean;
  RAYCASTER_POINT_THRESHOLD: number;
  MOUSE_BUTTON_ROTATE: string;
  MOUSE_BUTTON_ZOOM: string;
  MOUSE_BUTTON_PAN: string;
  KEY_ROTATE_UP: string;
  KEY_ROTATE_LEFT: string;
  KEY_ROTATE_DOWN: string;
  KEY_ROTATE_RIGHT: string;
  KEY_PAN_UP: string;
  KEY_PAN_LEFT: string;
  KEY_PAN_DOWN: string;
  KEY_PAN_RIGHT: string;
  MULTI_VIEW_MODE: number;
  AXIS_VIEW: boolean;
  AXIS_VIEW_POSITION: number;
}

/** デフォルト値 */
export const VIEW_CONF_DEFAULT: ViewConfDef = {
  LOG_LEVEL: 'INFO',
  BACKGROUD_COLOR: '#000000',
  PERS_FOV: 45,
  PERS_NEAR: 1,
  PERS_FAR: 10000000,
  EYE_MOVE_ENABLED: true,
  RAYCASTER_POINT_THRESHOLD: 1,
  MOUSE_BUTTON_ROTATE: 'LEFT',
  MOUSE_BUTTON_ZOOM: 'MIDDLE',
  MOUSE_BUTTON_PAN: 'RIGHT',
  KEY_ROTATE_UP: 'W',
  KEY_ROTATE_LEFT: 'A',
  KEY_ROTATE_DOWN: 'S',
  KEY_ROTATE_RIGHT: 'D',
  KEY_PAN_UP: 'I',
  KEY_PAN_LEFT: 'J',
  KEY_PAN_DOWN: 'K',
  KEY_PAN_RIGHT: 'L',
  MULTI_VIEW_MODE: 0,
  AXIS_VIEW: false,
  AXIS_VIEW_POSITION: 2,
};

/**
 * モデル系ビューアの設定情報を管理するクラス
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export class ViewConf {
  /** ユーザ設定の設定値情報(デフォルト値で初期化) */
  static conf: ViewConfDef = structuredClone(VIEW_CONF_DEFAULT);

  /** 真偽判定定義 */
  static isBoolean = (val: any): boolean => {
    return typeof val === 'boolean';
  };
  /** 数値判定定義 */
  static isNumber = (val: any): boolean => {
    return typeof val === 'number';
  };
  /** ログレベル判定定義 */
  static isLogLevel = (val: any): boolean => {
    return Array.from(LOG_LEVEL_NO_TABLE.keys()).includes(val);
  };
  /** マウスボタン判定定義 */
  static isMouse = (val: any): boolean => {
    return MOUSE_BUTTON_POSITION.includes(val);
  };
  /** アルファベット判定定義 */
  static isAlphabet = (val: any): boolean => {
    return ALPHABET_REGEX.test(val);
  };

  /**
   * 設定ファイルのデータをプロパティの変数に反映する
   * @param setting ユーザ設定のデータ
   */
  static set(setting: {[key: string]: any}): void {
    const colorConverter = (val: any): any => {
      return val.replace('0x', '#');
    };

    // prettier-ignore
    // ユーザ設定のデータを反映
    {
      // ログレベル関連
      ViewConf.conf.LOG_LEVEL = ViewConf.getSettingValue('LOG_LEVEL', setting.LOG_LEVEL, VIEW_CONF_DEFAULT.LOG_LEVEL, ViewConf.isLogLevel);

      // シーン関連
      ViewConf.conf.BACKGROUD_COLOR = ViewConf.getSettingValue('BACKGROUD_COLOR', setting.BACKGROUD_COLOR, VIEW_CONF_DEFAULT.BACKGROUD_COLOR, ViewUtil.isColorFormat, colorConverter);

      // カメラ関連
      ViewConf.conf.PERS_FOV = ViewConf.getSettingValue('PERS_FOV', setting.PERS_FOV, VIEW_CONF_DEFAULT.PERS_FOV, ViewConf.isNumber);
      ViewConf.conf.PERS_NEAR = ViewConf.getSettingValue('PERS_NEAR', setting.PERS_NEAR, VIEW_CONF_DEFAULT.PERS_NEAR, ViewConf.isNumber);
      ViewConf.conf.PERS_FAR = ViewConf.getSettingValue('PERS_FAR', setting.PERS_FAR, VIEW_CONF_DEFAULT.PERS_FAR, ViewConf.isNumber);

      // 視点制御関連
      ViewConf.conf.EYE_MOVE_ENABLED = ViewConf.getSettingValue('EYE_MOVE_ENABLED', setting.EYE_MOVE_ENABLED, VIEW_CONF_DEFAULT.EYE_MOVE_ENABLED, ViewConf.isBoolean);
      ViewConf.conf.RAYCASTER_POINT_THRESHOLD = ViewConf.getSettingValue('RAYCASTER_POINT_THRESHOLD', setting.RAYCASTER_POINT_THRESHOLD, VIEW_CONF_DEFAULT.RAYCASTER_POINT_THRESHOLD, ViewConf.isNumber);

      // マウス操作関連
      ViewConf.conf.MOUSE_BUTTON_ROTATE = ViewConf.getSettingValue('MOUSE_BUTTON_ROTATE', setting.MOUSE_BUTTON_ROTATE, VIEW_CONF_DEFAULT.MOUSE_BUTTON_ROTATE, ViewConf.isMouse);
      ViewConf.conf.MOUSE_BUTTON_ZOOM = ViewConf.getSettingValue('MOUSE_BUTTON_ZOOM', setting.MOUSE_BUTTON_ZOOM, VIEW_CONF_DEFAULT.MOUSE_BUTTON_ZOOM, ViewConf.isMouse);
      ViewConf.conf.MOUSE_BUTTON_PAN = ViewConf.getSettingValue('MOUSE_BUTTON_PAN', setting.MOUSE_BUTTON_PAN, VIEW_CONF_DEFAULT.MOUSE_BUTTON_PAN, ViewConf.isMouse);

      // キーボード操作関連
      ViewConf.conf.KEY_ROTATE_UP = ViewConf.getSettingValue('KEY_ROTATE_UP', setting.KEY_ROTATE_UP, VIEW_CONF_DEFAULT.KEY_ROTATE_UP, ViewConf.isAlphabet);
      ViewConf.conf.KEY_ROTATE_LEFT = ViewConf.getSettingValue('KEY_ROTATE_LEFT', setting.KEY_ROTATE_LEFT, VIEW_CONF_DEFAULT.KEY_ROTATE_LEFT, ViewConf.isAlphabet);
      ViewConf.conf.KEY_ROTATE_DOWN = ViewConf.getSettingValue('KEY_ROTATE_DOWN', setting.KEY_ROTATE_DOWN, VIEW_CONF_DEFAULT.KEY_ROTATE_DOWN, ViewConf.isAlphabet);
      ViewConf.conf.KEY_ROTATE_RIGHT = ViewConf.getSettingValue('KEY_ROTATE_RIGHT', setting.KEY_ROTATE_RIGHT, VIEW_CONF_DEFAULT.KEY_ROTATE_RIGHT, ViewConf.isAlphabet);
      ViewConf.conf.KEY_PAN_UP = ViewConf.getSettingValue('KEY_PAN_UP', setting.KEY_PAN_UP, VIEW_CONF_DEFAULT.KEY_PAN_UP, ViewConf.isAlphabet);
      ViewConf.conf.KEY_PAN_LEFT = ViewConf.getSettingValue('KEY_PAN_LEFT', setting.KEY_PAN_LEFT, VIEW_CONF_DEFAULT.KEY_PAN_LEFT, ViewConf.isAlphabet);
      ViewConf.conf.KEY_PAN_DOWN = ViewConf.getSettingValue('KEY_PAN_DOWN', setting.KEY_PAN_DOWN, VIEW_CONF_DEFAULT.KEY_PAN_DOWN, ViewConf.isAlphabet);
      ViewConf.conf.KEY_PAN_RIGHT = ViewConf.getSettingValue('KEY_PAN_RIGHT', setting.KEY_PAN_RIGHT, VIEW_CONF_DEFAULT.KEY_PAN_RIGHT, ViewConf.isAlphabet);

      // 2画面分割表示関連
      ViewConf.conf.MULTI_VIEW_MODE = ViewConf.getSettingValue('MULTI_VIEW_MODE', setting.MULTI_VIEW_MODE, VIEW_CONF_DEFAULT.MULTI_VIEW_MODE, ViewConf.isNumber);

      // 軸表示関連
      ViewConf.conf.AXIS_VIEW = ViewConf.getSettingValue('AXIS_VIEW', setting.AXIS_VIEW, VIEW_CONF_DEFAULT.AXIS_VIEW, ViewConf.isBoolean);
      ViewConf.conf.AXIS_VIEW_POSITION = ViewConf.getSettingValue('AXIS_VIEW_POSITION', setting.AXIS_VIEW_POSITION, VIEW_CONF_DEFAULT.AXIS_VIEW_POSITION, ViewConf.isNumber);
    }
  }

  /**
   * 設定値の取得
   * @param key 判定項目名
   * @param setVal 判定入力値
   * @param defVal デフォルト値
   * @param checker 入力値の正常判定処理
   * @param converter 入力値変換処理
   * @returns 設定値またはデフォルト値
   */
  static getSettingValue(
    key: string,
    setVal: any,
    defVal: any,
    checker: (val: any) => boolean,
    converter?: (val: any) => any,
  ): any {
    let retVal = undefined;
    if (typeof setVal !== 'undefined' && checker(setVal)) {
      if (converter !== undefined) {
        retVal = converter(setVal);
      } else {
        retVal = setVal;
      }
    } else {
      Logging.warn(LOG_CONF.WARN_INVALID_CONF_VALUE, key, String(setVal), String(defVal));
      retVal = defVal;
    }

    Logging.debug(LOG_CONF.DEBUG_SET_CONF_VALUE, key, String(retVal));
    return retVal;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
