/**
 * @fileoverview 点群系ビューアの設定情報を管理するクラスの定義
 * @author Kota Kubota(SEQ)
 * @created 2025/04/29
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import {ColorRepresentation} from 'three';
import {COPCUtil} from '../util/copcUtil';
import {ViewConf, ViewConfDef} from './viewConf';

/**
 * @interface 点群系ビューア設定定義
 */
export interface CopcConfDef extends ViewConfDef {
  GAMMA_VALUE: number;
  DBLCLICK_MOVE_EYE_ENABLED: boolean;
  POINT_SIZE: number;
  ADJUSTMENT_POINT_SIZE: boolean;
  LOD_MODE: number;
  LOD_DEPTH: number;
  COLOR_MODE: number;
  COLOR_MODE_INDEX_NO: number;
  SELECTION_MODE: number;
  SELECT_MAX_POINT: number;
  SELECT_POINT_COLOR: ColorRepresentation;
  SELECT_POINT_SIZE: number;
  STRIPE_MEASURE_COLOR1: ColorRepresentation;
  STRIPE_MEASURE_COLOR2: ColorRepresentation;
  STRIPE_MEASURE_SPHERE_COLOR: ColorRepresentation;
  MEASURE_VALUE_DIGIT: number;
  SELECT_RANGE_WIREFRAME_COLOR: ColorRepresentation;
  SELECT_RANGE_X_SIZE: number;
  SELECT_RANGE_Y_SIZE: number;
  SELECT_RANGE_Z_SIZE: number;
  SELECT_RANGE_RADIUS: number;
  SELECT_RANGE_THETA_S: number;
  SELECT_RANGE_THETA_L: number;
  DATA_LOAD_WORKER_NUM: number;
}

/** デフォルト値 */
const COPC_CONF_DEFAULT: CopcConfDef = {
  LOG_LEVEL: 'INFO',
  BACKGROUD_COLOR: '#000000',
  PERS_FOV: 45,
  PERS_NEAR: 1,
  PERS_FAR: 10000000,
  GAMMA_VALUE: 3,
  EYE_MOVE_ENABLED: true,
  DBLCLICK_MOVE_EYE_ENABLED: true,
  RAYCASTER_POINT_THRESHOLD: 1,
  POINT_SIZE: 1,
  ADJUSTMENT_POINT_SIZE: false,
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
  LOD_MODE: 0,
  LOD_DEPTH: 1,
  COLOR_MODE: 0,
  COLOR_MODE_INDEX_NO: 1,
  MULTI_VIEW_MODE: 0,
  SELECTION_MODE: 0,
  SELECT_MAX_POINT: 10000,
  SELECT_POINT_COLOR: '#ff0000',
  SELECT_POINT_SIZE: 5,
  STRIPE_MEASURE_COLOR1: '#ffffff',
  STRIPE_MEASURE_COLOR2: '#ff0000',
  STRIPE_MEASURE_SPHERE_COLOR: '#ff0000',
  MEASURE_VALUE_DIGIT: 2,
  SELECT_RANGE_WIREFRAME_COLOR: '#00ff00',
  SELECT_RANGE_X_SIZE: 100,
  SELECT_RANGE_Y_SIZE: 100,
  SELECT_RANGE_Z_SIZE: 100,
  SELECT_RANGE_RADIUS: 100,
  SELECT_RANGE_THETA_S: 0,
  SELECT_RANGE_THETA_L: 360,
  AXIS_VIEW: true,
  AXIS_VIEW_POSITION: 2,
  DATA_LOAD_WORKER_NUM: 2,
};

/**
 * 点群系ビューアの設定情報を管理するクラス
 */
export class COPCConf extends ViewConf {
  /** ユーザ設定の設定値情報(デフォルト値で初期化) */
  static conf: CopcConfDef = structuredClone(COPC_CONF_DEFAULT);

  /**
   * 設定ファイルのデータをプロパティの変数に反映する
   * @param setting ユーザ設定のデータ
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  static set(setting: {[key: string]: any}): void {
    const colorConverter = (val: any): any => {
      return val.replace('0x', '#');
    };

    // prettier-ignore
    // ユーザ設定のデータを反映
    {
      // ログレベル関連
      COPCConf.conf.LOG_LEVEL = COPCConf.getSettingValue('LOG_LEVEL', setting.LOG_LEVEL, COPC_CONF_DEFAULT.LOG_LEVEL, ViewConf.isLogLevel);

      // シーン関連
      COPCConf.conf.BACKGROUD_COLOR = COPCConf.getSettingValue('BACKGROUD_COLOR', setting.BACKGROUD_COLOR, COPC_CONF_DEFAULT.BACKGROUD_COLOR, COPCUtil.isColorFormat,colorConverter);

      // カメラ関連
      COPCConf.conf.PERS_FOV = COPCConf.getSettingValue('PERS_FOV', setting.PERS_FOV, COPC_CONF_DEFAULT.PERS_FOV, ViewConf.isNumber);
      COPCConf.conf.PERS_NEAR = COPCConf.getSettingValue('PERS_NEAR', setting.PERS_NEAR, COPC_CONF_DEFAULT.PERS_NEAR, ViewConf.isNumber);
      COPCConf.conf.PERS_FAR = COPCConf.getSettingValue('PERS_FAR', setting.PERS_FAR, COPC_CONF_DEFAULT.PERS_FAR, ViewConf.isNumber);

      // 点群見た目関連
      COPCConf.conf.GAMMA_VALUE = COPCConf.getSettingValue('GAMMA_VALUE', setting.GAMMA_VALUE, COPC_CONF_DEFAULT.GAMMA_VALUE, ViewConf.isNumber);

      // 視点制御関連
      COPCConf.conf.EYE_MOVE_ENABLED = COPCConf.getSettingValue('EYE_MOVE_ENABLED', setting.EYE_MOVE_ENABLED, COPC_CONF_DEFAULT.EYE_MOVE_ENABLED, ViewConf.isBoolean);
      COPCConf.conf.DBLCLICK_MOVE_EYE_ENABLED = COPCConf.getSettingValue('DBLCLICK_MOVE_EYE_ENABLED', setting.DBLCLICK_MOVE_EYE_ENABLED, COPC_CONF_DEFAULT.DBLCLICK_MOVE_EYE_ENABLED, ViewConf.isBoolean);
      COPCConf.conf.RAYCASTER_POINT_THRESHOLD = COPCConf.getSettingValue('RAYCASTER_POINT_THRESHOLD', setting.RAYCASTER_POINT_THRESHOLD, COPC_CONF_DEFAULT.RAYCASTER_POINT_THRESHOLD, ViewConf.isNumber);

      // 点サイズ関連
      COPCConf.conf.POINT_SIZE = COPCConf.getSettingValue('POINT_SIZE', setting.POINT_SIZE, COPC_CONF_DEFAULT.POINT_SIZE, ViewConf.isNumber);
      COPCConf.conf.ADJUSTMENT_POINT_SIZE = COPCConf.getSettingValue('ADJUSTMENT_POINT_SIZE', setting.ADJUSTMENT_POINT_SIZE, COPC_CONF_DEFAULT.ADJUSTMENT_POINT_SIZE, ViewConf.isBoolean);

      // マウス操作関連
      COPCConf.conf.MOUSE_BUTTON_ROTATE = COPCConf.getSettingValue('MOUSE_BUTTON_ROTATE', setting.MOUSE_BUTTON_ROTATE, COPC_CONF_DEFAULT.MOUSE_BUTTON_ROTATE, ViewConf.isMouse);
      COPCConf.conf.MOUSE_BUTTON_ZOOM = COPCConf.getSettingValue('MOUSE_BUTTON_ZOOM', setting.MOUSE_BUTTON_ZOOM, COPC_CONF_DEFAULT.MOUSE_BUTTON_ZOOM, ViewConf.isMouse);
      COPCConf.conf.MOUSE_BUTTON_PAN = COPCConf.getSettingValue('MOUSE_BUTTON_PAN', setting.MOUSE_BUTTON_PAN, COPC_CONF_DEFAULT.MOUSE_BUTTON_PAN, ViewConf.isMouse);

      // キーボード操作関連
      COPCConf.conf.KEY_ROTATE_UP = COPCConf.getSettingValue('KEY_ROTATE_UP', setting.KEY_ROTATE_UP, COPC_CONF_DEFAULT.KEY_ROTATE_UP, ViewConf.isAlphabet);
      COPCConf.conf.KEY_ROTATE_LEFT = COPCConf.getSettingValue('KEY_ROTATE_LEFT', setting.KEY_ROTATE_LEFT, COPC_CONF_DEFAULT.KEY_ROTATE_LEFT, ViewConf.isAlphabet);
      COPCConf.conf.KEY_ROTATE_DOWN = COPCConf.getSettingValue('KEY_ROTATE_DOWN', setting.KEY_ROTATE_DOWN, COPC_CONF_DEFAULT.KEY_ROTATE_DOWN, ViewConf.isAlphabet);
      COPCConf.conf.KEY_ROTATE_RIGHT = COPCConf.getSettingValue('KEY_ROTATE_RIGHT', setting.KEY_ROTATE_RIGHT, COPC_CONF_DEFAULT.KEY_ROTATE_RIGHT, ViewConf.isAlphabet);
      COPCConf.conf.KEY_PAN_UP = COPCConf.getSettingValue('KEY_PAN_UP', setting.KEY_PAN_UP, COPC_CONF_DEFAULT.KEY_PAN_UP, ViewConf.isAlphabet);
      COPCConf.conf.KEY_PAN_LEFT = COPCConf.getSettingValue('KEY_PAN_LEFT', setting.KEY_PAN_LEFT, COPC_CONF_DEFAULT.KEY_PAN_LEFT, ViewConf.isAlphabet);
      COPCConf.conf.KEY_PAN_DOWN = COPCConf.getSettingValue('KEY_PAN_DOWN', setting.KEY_PAN_DOWN, COPC_CONF_DEFAULT.KEY_PAN_DOWN, ViewConf.isAlphabet);
      COPCConf.conf.KEY_PAN_RIGHT = COPCConf.getSettingValue('KEY_PAN_RIGHT', setting.KEY_PAN_RIGHT, COPC_CONF_DEFAULT.KEY_PAN_RIGHT, ViewConf.isAlphabet);

      // 間引き関連
      COPCConf.conf.LOD_MODE = COPCConf.getSettingValue('LOD_MODE', setting.LOD_MODE, COPC_CONF_DEFAULT.LOD_MODE, ViewConf.isNumber);
      COPCConf.conf.LOD_DEPTH = COPCConf.getSettingValue('LOD_DEPTH', setting.LOD_DEPTH, COPC_CONF_DEFAULT.LOD_DEPTH, ViewConf.isNumber);

      // 表示色関連
      COPCConf.conf.COLOR_MODE = COPCConf.getSettingValue('COLOR_MODE', setting.COLOR_MODE, COPC_CONF_DEFAULT.COLOR_MODE, ViewConf.isNumber);
      COPCConf.conf.COLOR_MODE_INDEX_NO = COPCConf.getSettingValue('COLOR_MODE_INDEX_NO', setting.COLOR_MODE_INDEX_NO, COPC_CONF_DEFAULT.COLOR_MODE_INDEX_NO, ViewConf.isNumber);

      // 2画面分割表示関連
      COPCConf.conf.MULTI_VIEW_MODE = COPCConf.getSettingValue('MULTI_VIEW_MODE', setting.MULTI_VIEW_MODE, COPC_CONF_DEFAULT.MULTI_VIEW_MODE, ViewConf.isNumber);

      // 点選択関連
      COPCConf.conf.SELECTION_MODE = COPCConf.getSettingValue('SELECTION_MODE', setting.SELECTION_MODE, COPC_CONF_DEFAULT.SELECTION_MODE, ViewConf.isNumber);
      COPCConf.conf.SELECT_MAX_POINT = COPCConf.getSettingValue('SELECT_MAX_POINT', setting.SELECT_MAX_POINT, COPC_CONF_DEFAULT.SELECT_MAX_POINT, ViewConf.isNumber);
      COPCConf.conf.SELECT_POINT_COLOR = COPCConf.getSettingValue('SELECT_POINT_COLOR', setting.SELECT_POINT_COLOR, COPC_CONF_DEFAULT.SELECT_POINT_COLOR, COPCUtil.isColorFormat,colorConverter);
      COPCConf.conf.SELECT_POINT_SIZE = COPCConf.getSettingValue('SELECT_POINT_SIZE', setting.SELECT_POINT_SIZE, COPC_CONF_DEFAULT.SELECT_POINT_SIZE, ViewConf.isNumber);
      COPCConf.conf.STRIPE_MEASURE_COLOR1 = COPCConf.getSettingValue('STRIPE_MEASURE_COLOR1', setting.STRIPE_MEASURE_COLOR1, COPC_CONF_DEFAULT.STRIPE_MEASURE_COLOR1, COPCUtil.isColorFormat,colorConverter);
      COPCConf.conf.STRIPE_MEASURE_COLOR2 = COPCConf.getSettingValue('STRIPE_MEASURE_COLOR2', setting.STRIPE_MEASURE_COLOR2, COPC_CONF_DEFAULT.STRIPE_MEASURE_COLOR2, COPCUtil.isColorFormat,colorConverter);
      COPCConf.conf.STRIPE_MEASURE_SPHERE_COLOR = COPCConf.getSettingValue('STRIPE_MEASURE_SPHERE_COLOR', setting.STRIPE_MEASURE_SPHERE_COLOR, COPC_CONF_DEFAULT.STRIPE_MEASURE_SPHERE_COLOR, COPCUtil.isColorFormat,colorConverter);
      COPCConf.conf.MEASURE_VALUE_DIGIT = COPCConf.getSettingValue('MEASURE_VALUE_DIGIT', setting.MEASURE_VALUE_DIGIT, COPC_CONF_DEFAULT.MEASURE_VALUE_DIGIT, ViewConf.isNumber);

      // 範囲選択関連
      COPCConf.conf.SELECT_RANGE_WIREFRAME_COLOR = COPCConf.getSettingValue('SELECT_RANGE_WIREFRAME_COLOR', setting.SELECT_RANGE_WIREFRAME_COLOR, COPC_CONF_DEFAULT.SELECT_RANGE_WIREFRAME_COLOR, COPCUtil.isColorFormat,colorConverter);
      COPCConf.conf.SELECT_RANGE_X_SIZE = COPCConf.getSettingValue('SELECT_RANGE_X_SIZE', setting.SELECT_RANGE_X_SIZE, COPC_CONF_DEFAULT.SELECT_RANGE_X_SIZE, ViewConf.isNumber);
      COPCConf.conf.SELECT_RANGE_Y_SIZE = COPCConf.getSettingValue('SELECT_RANGE_Y_SIZE', setting.SELECT_RANGE_Y_SIZE, COPC_CONF_DEFAULT.SELECT_RANGE_Y_SIZE, ViewConf.isNumber);
      COPCConf.conf.SELECT_RANGE_Z_SIZE = COPCConf.getSettingValue('SELECT_RANGE_Z_SIZE', setting.SELECT_RANGE_Z_SIZE, COPC_CONF_DEFAULT.SELECT_RANGE_Z_SIZE, ViewConf.isNumber);
      COPCConf.conf.SELECT_RANGE_RADIUS = COPCConf.getSettingValue('SELECT_RANGE_RADIUS', setting.SELECT_RANGE_RADIUS, COPC_CONF_DEFAULT.SELECT_RANGE_RADIUS, ViewConf.isNumber);
      COPCConf.conf.SELECT_RANGE_THETA_S = COPCConf.getSettingValue('SELECT_RANGE_THETA_S', setting.SELECT_RANGE_THETA_S, COPC_CONF_DEFAULT.SELECT_RANGE_THETA_S, ViewConf.isNumber);
      COPCConf.conf.SELECT_RANGE_THETA_L = COPCConf.getSettingValue('SELECT_RANGE_THETA_L', setting.SELECT_RANGE_THETA_L, COPC_CONF_DEFAULT.SELECT_RANGE_THETA_L, ViewConf.isNumber);

      // 軸表示関連
      COPCConf.conf.AXIS_VIEW = COPCConf.getSettingValue('AXIS_VIEW', setting.AXIS_VIEW, COPC_CONF_DEFAULT.AXIS_VIEW, ViewConf.isBoolean);
      COPCConf.conf.AXIS_VIEW_POSITION = COPCConf.getSettingValue('AXIS_VIEW_POSITION', setting.AXIS_VIEW_POSITION, COPC_CONF_DEFAULT.AXIS_VIEW_POSITION, ViewConf.isNumber);

      // 点群ロード関連
      COPCConf.conf.DATA_LOAD_WORKER_NUM = COPCConf.getSettingValue('DATA_LOAD_WORKER_NUM', setting.DATA_LOAD_WORKER_NUM, COPC_CONF_DEFAULT.DATA_LOAD_WORKER_NUM, ViewConf.isNumber);
    }
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
