/**
 * @fileoverview 固定値定義(汎用的な定数値を定義)
 * @author Masaaki Takeuchi(MESW)
 * @created 2025/05/20
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

/** デバッグ動作用設定 */
export const FOR_DEBUG: boolean = false;

/** イベント発生時のマウスイベントコード */
export const MOUSE_EVENT_CODE = {
  BUTTON_LEFT: 0,
  BUTTON_CENTER: 1,
  BUTTON_RIGHT: 2,
};
Object.freeze(MOUSE_EVENT_CODE);

/** バイトサイズ定義 */
export const BYTE_SIZE = {
  INT8: 1,
  UINT8: 1,
  INT16: 2,
  UINT16: 2,
  INT32: 4,
  UINT32: 4,
  FLOAT32: 4,
  FLOAT64: 8,
  BIG_INT64: 8,
  BIG_UINT64: 8,
};
Object.freeze(BYTE_SIZE);

/** 点群データ項目名称 */
export const POINT_DATA_ITEM = {
  X: 'X',
  Y: 'Y',
  Z: 'Z',
  INTENSITY: 'Intensity',
  RETURN_NUMBER: 'ReturnNumber',
  NUMBER_OF_RETURNS: 'NumberOfReturns',
  SYNTHETIC: 'Synthetic',
  KEY_POINT: 'KeyPoint',
  WITHHELD: 'Withheld',
  OVERLAP: 'Overlap',
  SCANNER_CHANNEL: 'ScannerChannel',
  SCAN_DIRECTION_FLAG: 'ScanDirectionFlag',
  EDGE_OF_FLIGHT_LINE: 'EdgeOfFlightLine',
  CLASSIFICATION: 'Classification',
  USER_DATA: 'UserData',
  SCAN_ANGLE: 'ScanAngle',
  POINT_SOURCE_ID: 'PointSourceId',
  GPS_TIME: 'GpsTime',
  RED: 'Red',
  GREEN: 'Green',
  BLUE: 'Blue',
  NIR: 'NIR',
  INDEX1: 'index1',
  INDEX2: 'index2',
  INDEX3: 'index3',
};
Object.freeze(POINT_DATA_ITEM);

/** 内部処理用点群データサイズ */
export const POINT_DATA_VIEW_SIZE = 77;

/** 内部処理用点群データオフセット情報 */
export const POINT_DATA_VIEW_OFFSET = {
  X: 0,
  Y: 8,
  Z: 16,
  INTENSITY: 24,
  RETURN_NUMBER: 26,
  NUMBER_OF_RETURNS: 27,
  SYNTHETIC: 28,
  KEY_POINT: 29,
  WITHHELD: 30,
  OVERLAP: 31,
  SCANNER_CHANNEL: 32,
  SCAN_DIRECTION_FLAG: 33,
  EDGE_OF_FLIGHT_LINE: 34,
  CLASSIFICATION: 35,
  USER_DATA: 36,
  SCAN_ANGLE: 37,
  POINT_SOURCE_ID: 39,
  GPS_TIME: 41,
  RED: 49,
  GREEN: 53,
  BLUE: 57,
  NIR: 61,
  INDEX1: 65,
  INDEX2: 69,
  INDEX3: 73,
};
Object.freeze(POINT_DATA_VIEW_OFFSET);
