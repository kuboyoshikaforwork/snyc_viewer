/**
 * @fileoverview ログメッセージ定義
 * @author Kota Kubota(SEQ)
 * @created 2025/04/29
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

// ログ出力の設定情報
// prettier-ignore
export const LOG_CONF = {

  /************************************************************************************/
  // ERROR
  /************************************************************************************/
  // [ERROR]共通項目
  ERROR_INVALID_ARGUMENT: {code: 'E003010101', message: '{0}の引数[{1}：{2}]が不正です。'},
  // [ERROR]点群データ表示
  ERROR_LOAD_COPC_HEADER: {code: 'E003010102', message: '点群データ({0})のヘッダ情報のロードに失敗しました。'},
  ERROR_LOD_MODE: {code: 'E003010104', message: '間引き表示の方式に異常値[{0}]を設定しました。'},
  ERROR_LOD_DEPTH: {code: 'E003010105', message: '間引き表示の指定深さに異常値[{0}]を設定しました。'},
  ERROR_COLOR_MODE: {code: 'E003010106', message: '表示色変更の方式に異常値[{0}]を設定しました。'},
  ERROR_COLOR_MODE_INDEX_NO: {code: 'E003010107', message: '表示色変更のインデックス番号に異常値[{0}]を設定しました。'},
  ERROR_COLOR_MODE_LUT: {code: 'E003010108', message: '表示色変更のカラーテーブルに異常値を設定しました。'},
  ERROR_GAMMA_VALUE: {code: 'E003010109', message: 'ガンマ値に異常値を設定しました。'},
  ERROR_LOAD_TEXT_FILE: {code: 'E003010110', message: 'テキストファイル({0})のロードに失敗しました。'},
  ERROR_READ_TEXT_FILE: {code: 'E003010111', message: 'テキストファイル({0})の読み込みに失敗しました。'},
  ERROR_LOAD_JSON_FILE: {code: 'E003010112', message: 'JSONファイル({0})のロードに失敗しました。'},
  ERROR_READ_JSON_FILE: {code: 'E003010113', message: 'JSONファイル({0})の読み込みに失敗しました。'},
  ERROR_MULTI_VIEWER_SET_MAIN: {code: 'E003010114', message: '2画面分割表示のメイン画面設定に異常値[{0}]を設定しました。'},
  ERROR_DISPLAY_UNLOAD_DATA: {code: 'E003010115', message: '未ロードの点群({0})のため表示できません。'},
  ERROR_COPC_FILE_FORMAT: {code: 'E003010116', message: 'COPCファイルのデータ項目に誤りがあります。{0}'},
  ERROR_SUB_WORKER_ON_MESSAGE: {code: 'E003010117', message: 'ウェブワーカースレッド側でのデータ受信時にエラーが発生しました。'},
  ERROR_SUB_WORKER_INTERNAL: {code: 'E003010118', message: 'ウェブワーカースレッド側でエラーが発生しました。'},
  ERROR_MAIN_WORKER_ON_MESSAGE: {code: 'E003010119', message: 'メインスレッド側でのデータ受信時にエラーが発生しました。'},
  ERROR_COPC_HEADER_DATA_UNDEFINED: {code: 'E003010120', message: 'COPCのヘッダ情報がないためデータ取得を実行できません。'},
  ERROR_UNKNOWN: {code: 'E003010199', message: '予期せぬ例外が発生しました。({0}/{1})'},

  // [ERROR]点群データ計測
  ERROR_POINT_SELECT_MODE: {code: 'E003010201', message: '点選択処理の方式に異常値[{0}]を設定しました。'},
  ERROR_NOT_SELECTED_TWO_POINTS: {code: 'E003010202', message: '2点が選択されていないため処理を終了しました。'},
  ERROR_RANGE_SELECT_TYPE: {code: 'E003010203', message: '範囲選択処理の方式に異常値[{0}]を設定しました。'},
  ERROR_RANGE_SELECT_PARAMETER: {code: 'E003010204', message: '範囲選択処理のパラメータ({0})に異常値[{1}]を設定しました。'},
  ERROR_RANGE_SELECT_PARAM_INFO: {code: 'E003010205', message: '範囲選択処理の処理パラメータ取得に失敗しました。'},
  ERROR_OBJECT_CONTROL_MODE: {code: 'E003010206', message: '範囲選択処理のオブジェクトの操作モードに異常値[{0}]を設定しました。'},
  ERROR_LAS_DOWNLOAD_HEADER: {code: 'E003010207', message: 'ダウンロード対象({0})のヘッダ情報が取得できていません。'},
  ERROR_LAS_DOWNLOAD_VLR: {code: 'E003010208', message: 'ダウンロード対象({0})の可変長レコード(拡張：{1})のバイナリデータの取得に失敗しました。'},
  ERROR_LAS_DOWNLOAD_EBS: {code: 'E003010209', message: 'ダウンロード対象({0})の拡張データ項目の取得に失敗しました。'},
  ERROR_LAS_DOWNLOAD_LOAD_DATA: {code: 'E003010210', message: 'ダウンロード処理中のデータ取得に失敗しました。'},

  // [ERROR]3Dオブジェクト表示
  ERROR_LOAD_OBJ_FILE: {code: 'E003010401', message: 'OBJ形式のファイル({0})のロードに失敗しました。'},
  ERROR_LOAD_MTL_FILE: {code: 'E003010402', message: 'MTL形式のファイル({0})のロードに失敗しました。'},
  ERROR_PARSE_OBJ_FILE: {code: 'E003010403', message: 'OBJ形式のファイル({0})の読み込みに失敗しました。'},
  ERROR_REGIST_OBJ_MODEL: {code: 'E003010404', message: 'OBJ形式のファイル({0})からモデルの登録に失敗しました。'},
  ERROR_REGIST_MTL_MODEL: {code: 'E003010405', message: 'テクスチャ付きOBJ形式のファイル({0}/{1})からモデルの登録に失敗しました。'},
  ERROR_MTL_TEXTURE_SIZE: {code: 'E003010406', message: 'テクスチャ付きOBJ形式のファイルにおいてテクスチャサイズがGPUサポートのサイズ以上です。({0})'},
  ERROR_CREATE_OBJ: {code: 'E003010407', message: 'モデル({0})のオブジェクトの生成に失敗しました。'},
  ERROR_CREATE_GEOJSON: {code: 'E003010408', message: 'GeoJSONオブジェクトの生成に失敗しました。ファイル({0})の[{1}]に誤りがあります。'},
  ERROR_CREATE_GEOJSON_IMAGE: {code: 'E003010409', message: 'GeoJSONオブジェクトの生成に失敗しました。画像の取得({0})に失敗しました。'},
  ERROR_GENERATE_PRIMITIVEOBJ: {code: 'E003010410', message: 'プリミティブオブジェクト({0})の生成に失敗しました。({1}：{2})'},
  ERROR_VISIBLE_AXIS: {code: 'E003010411', message: 'XYZ座標軸の表示({0})に失敗しました。'},
  ERROR_VISIBLE_GEOJSON: {code: 'E003010412', message: 'GeoJSONオブジェクト(種別：{0})の可視に失敗しました。'},
  ERROR_INVISIBLE_GEOJSON: {code: 'E003010413', message: 'GeoJSONオブジェクト(種別：{0})の不可視に失敗しました。'},
  ERROR_REMOVE_GEOJSON: {code: 'E003010414', message: 'GeoJSONオブジェクト(種別：{0})の削除に失敗しました。'},
  ERROR_VISIBLE_PRIMITIVE: {code: 'E003010415', message: 'プリミティブオブジェクト(種別：{0})の可視に失敗しました。'},
  ERROR_INVISIBLE_PRIMITIVE: {code: 'E003010416', message: 'プリミティブオブジェクト(種別：{0})の不可視に失敗しました。'},
  ERROR_REMOVE_PRIMITIVE: {code: 'E003010417', message: 'プリミティブオブジェクト(種別：{0})の削除に失敗しました。'},
  ERROR_INVALID_OBJ_ID: {code: 'E003010418', message: '不正なオブジェクトID({0})を指定しました。'},

  /************************************************************************************/
  // WARN
  /************************************************************************************/
  // [WARN]点群データ表示
  WARN_INVALID_CONF_VALUE: {code: 'W003010101', message: '設定ファイルの入力値({0}：{1})が異常のためデフォルト値({2})を設定します。'},
  WARN_GET_POINT_CLOUD_DATA: {code: 'W003010102', message: '点群データのデータ取得に失敗しました。({0}/{1})'},
  WARN_OPEN_INDEXEDDB: {code: 'W003010103', message: 'IndexedDBのオープンに失敗しました。({0})'},
  WARN_INSERT_INDEXEDDB: {code: 'W003010104', message: 'IndexedDBへのデータ追加に失敗しました。({0}/{1})'},
  WARN_GET_DATA_FORM_INDEXEDDB: {code: 'W003010105', message: 'IndexedDBからのデータ取得に失敗しました。({0}/{1})'},
  WARN_DELETE_INDEXEDDB: {code: 'W003010106', message: 'IndexedDBのデータベースの削除に失敗しました。({0})'},
  WARN_CREATE_OBJECTSTORES_INDEXEDDB: {code: 'W003010107', message: 'IndexedDBのオブジェクトストアの生成に失敗しました。({0})'},
  WARN_GET_OBJECTSTORES_INDEXEDDB: {code: 'W003010108', message: 'IndexedDBのオブジェクトストアの取得に失敗しました。({0})'},
  WARN_GET_DATABASES: {code: 'W003010109', message: 'IndexedDBのデータベース一覧の取得に失敗しました。'},
  WARN_UNKNOWN_INDEXEDDB: {code: 'W003010110', message: 'IndexedDBへの処理中に予期せぬ例外が発生しました。({0})'},
  WARN_UNLOAD_INDEXEDDB_DELETE: {code: 'W003010111', message: '点群アンロード時のIndexedDBのデータベースの削除に失敗しました。({0})'},

  /************************************************************************************/
  // INFO
  /************************************************************************************/
  // [INFO]点群データ表示
  INFO_SET_CONFIG: {code: 'I003010101', message: '設定ファイルを反映しました。'},
  INFO_SET_LOGLEVEL: {code: 'I003010102', message: '出力するログレベルを[{0}]に変更しました。'},
  INFO_LOAD_POINT_CLOUD: {code: 'I003010103', message: '点群データ({0})をロードします。'},
  INFO_UNLOAD_POINT_CLOUD: {code: 'I003010104', message: '点群データ({0})をアンロードします。'},
  INFO_DISP_POINT_CLOUD: {code: 'I003010105', message: '点群データ({0})を表示します。'},
  INFO_HIDE_POINT_CLOUD: {code: 'I003010106', message: '点群データ({0})を非表示にします。'},
  INFO_END_VIEWER: {code: 'I003010107', message: 'ビューアを終了します。'},
  INFO_SET_LOD_MODE: {code: 'I003010108', message: '間引き表示の方式に[{0}]を設定しました。'},
  INFO_SET_LOD_DEPTH: {code: 'I003010109', message: '間引き表示の指定深さに[{0}]を設定しました。'},
  INFO_SET_COLOR_MODE: {code: 'I003010110', message: '表示色変更の方式に[{0}]を設定しました。'},
  INFO_SET_COLOR_NUMBER: {code: 'I003010111', message: '表示色変更のインデックス番号に[{0}]を設定しました。'},
  INFO_SET_COLOR_TABLE: {code: 'I003010112', message: '表示色変更のカラーテーブルを設定しました。'},
  INFO_SET_GAMMA_VALUE: {code: 'I003010113', message: 'ガンマ値に[{0}]を設定しました。'},
  INFO_MULTI_VIEWER: {code: 'I003010114', message: '2画面分割で表示します。'},
  INFO_MULTI_VIEWER_SYNC_ON: {code: 'I003010115', message: '2画面分割表示の動作モードを[連動]に設定します。'},
  INFO_MULTI_VIEWER_SYNC_OFF: {code: 'I003010116', message: '2画面分割表示の動作モードを[独立]に設定します。'},
  INFO_MULTI_VIEWER_SET_MAIN: {code: 'I003010117', message: '2画面分割表示のメイン画面を[{0}]に設定します。'},

  // [INFO]点群データ計測
  INFO_SET_POINT_SELECT_MODE: {code: 'I003010201', message: '点選択処理の方式に[{0}]を設定しました。'},
  INFO_DISP_DISTANCE: {code: 'I003010202', message: '距離計測結果表示を開始しました。'},
  INFO_HIDE_DISTANCE: {code: 'I003010203', message: '距離計測結果表示を終了しました。'},
  INFO_ENABLE_MEASURE_VERTICAL_DISTANCE: {code: 'I003010204', message: '鉛直距離計測を有効化しました。'},
  INFO_DISABLE_MEASURE_VERTICAL_DISTANCE: {code: 'I003010205', message: '鉛直距離計測を無効化しました。'},
  INFO_START_AREA_SELECT_MODE: {code: 'I003010206', message: '範囲選択処理(種別：{0})を開始しました。'},
  INFO_END_AREA_SELECT_MODE: {code: 'I003010207', message: '範囲選択処理(種別：{0})を終了しました。'},
  INFO_GET_COORDS_POINT_SELECT: {code: 'I003010208', message: '点選択で選択中の点座標を取得します。'},
  INFO_GET_COORDS_RANGE_SELECT: {code: 'I003010209', message: '範囲選択で選択中の点座標を取得します。'},
  INFO_OVER_LIMIT: {code: 'I003010210', message: '選択中の点座標が最大点数を超過しました。'},
  INFO_LAS_DOWNLOAD_START: {code: 'I003010211', message: '点群データのLASファイルダウンロードを開始します。'},
  INFO_LAS_DOWNLOAD_FILE_START: {code: 'I003010212', message: '点群データ({0})のLASファイルダウンロードを開始します。'},
  INFO_LAS_DOWNLOAD_SELECT_START: {code: 'I003010213', message: '範囲選択で選択中の点群データのLASファイルダウンロードを開始します。'},
  INFO_LAS_DOWNLOAD_END: {code: 'I003010214', message: '点群データのLASファイルダウンロードを終了します。'},

  // [INFO]3Dオブジェクト表示
  INFO_REGIST_OBJ_MODEL: {code: 'I003010401', message: 'OBJ形式のオブジェクト(モデルID：{0})を登録しました。'},
  INFO_REGIST_MTL_MODEL: {code: 'I003010402', message: 'テクスチャ付きOBJ形式のオブジェクト(モデルID：{0})を登録しました。'},
  INFO_CREATE_OBJ_OBJECT: {code: 'I003010403', message: 'モデル(モデルID：{0})のオブジェクト({1}/{2})をシーンに追加しました。'},
  INFO_VISIBLE_ALL_OBJ_OBJECT: {code: 'I003010404', message: 'すべてのOBJのオブジェクトを可視状態に設定しました。'},
  INFO_INVISIBLE_ALL_OBJ_OBJECT: {code: 'I003010405', message: 'すべてのOBJのオブジェクトを不可視状態に設定しました。'},
  INFO_REMOVE_ALL_OBJ_OBJECT: {code: 'I003010406', message: 'すべてのOBJのオブジェクトを削除しました。'},
  INFO_CREATE_GEOJSON_POLYGON: {code: 'I003010407', message: 'ポリゴンオブジェクト({0})をシーンに追加しました。'},
  INFO_CREATE_GEOJSON_POLYLINE: {code: 'I003010408', message: 'ポリラインオブジェクト({0})をシーンに追加しました。'},
  INFO_CREATE_GEOJSON_IMAGE: {code: 'I003010409', message: '画像オブジェクト({0})をシーンに追加しました。'},
  INFO_CREATE_GEOJSON_LEADLINE: {code: 'I003010410', message: '引出線付き文字列オブジェクト ({0})をシーンに追加しました。'},
  INFO_VISIBLE_ALL_GEOJSON_OBJECT: {code: 'I003010411', message: 'すべてのGeoJSONのオブジェクト({0})を可視状態に設定しました。'},
  INFO_INVISIBLE_ALL_GEOJSON_OBJECT: {code: 'I003010412', message: 'すべてのGeoJSONのオブジェクト({0})を不可視状態に設定しました。'},
  INFO_REMOVE_ALL_GEOJSON_OBJECT: {code: 'I003010413', message: 'すべてのGeoJSONのオブジェクト({0})を削除しました。'},
  INFO_CREATE_PRIMITE_SPHERE: {code: 'I003010414', message: '球のプリミティブオブジェクト({0}/{1})をシーンに追加しました。'},
  INFO_CREATE_PRIMITE_TRIGONAL_PYRAMIDS: {code: 'I003010415', message: '三角錐のプリミティブオブジェクト({0})をシーンに追加しました。'},
  INFO_CREATE_PRIMITE_SQUARE_PYRAMIDS: {code: 'I003010416', message: '四角錐のプリミティブオブジェクト({0})をシーンに追加しました。'},
  INFO_CREATE_PRIMITE_REGULAR_OCTAHEDRON: {code: 'I003010417', message: '正八面体のプリミティブオブジェクト({0})をシーンに追加しました。'},
  INFO_VISIBLE_ALL_PRIMITIVE_OBJECT: {code: 'I003010418', message: 'すべてのプリミティブオブジェクト({0})を可視状態に設定しました。'},
  INFO_INVISIBLE_ALL_PRIMITIVE_OBJECT: {code: 'I003010419', message: 'すべてのプリミティブオブジェクト({0})を不可視状態に設定しました。'},
  INFO_REMOVE_ALL_PRIMITIVE_OBJECT: {code: 'I003010420', message: 'すべてのプリミティブオブジェクト({0})を削除しました。'},
  INFO_VISIBLE_UNIT_OBJECT: {code: 'I003010421', message: 'オブジェクト(ID：{0})を可視状態に設定しました。'},
  INFO_INVISIBLE_UNIT_OBJECT: {code: 'I003010422', message: 'オブジェクト(ID：{0})を不可視状態に設定しました。'},
  INFO_REMOVE_UNIT_OBJECT: {code: 'I003010423', message: 'オブジェクト(ID：{0})を削除しました。'},
  INFO_VISIBLE_GROUP_OBJECT: {code: 'I003010424', message: 'グループ({0})のオブジェクトを可視状態に設定しました。'},
  INFO_INVISIBLE_GROUP_OBJECT: {code: 'I003010425', message: 'グループ({0})のオブジェクトを不可視状態に設定しました。'},
  INFO_REMOVE_GROUP_OBJECT: {code: 'I003010426', message: 'グループ({0})のオブジェクトを削除しました。'},
  INFO_SET_OBJ_VISIBLE_THRESHOLD: {code: 'I003010428', message: 'オブジェクトの表示範囲制限機能の閾値を[{0}]に設定しました。'},
  INFO_VISIBLE_AXIS: {code: 'I003010429', message: 'XYZ座標軸を可視状態(位置：{0})に設定しました。'},
  INFO_INVISIBLE_AXIS: {code: 'I003010430', message: 'XYZ座標軸を不可視状態に設定しました。'},
  INFO_GET_OBJ_ID: {code: 'I003010431', message: 'オブジェクトID(ID：{0})を取得しました。'},

  /************************************************************************************/
  // DEBUG
  /************************************************************************************/
  // [DEBUG]点群データ表示
  DEBUG_SET_CONF_VALUE: {code: 'D003010101', message: '設定項目：{0}に[{1})]を設定します。'},
  DEBUG_LOAD_POINT_DATA: {code: 'D003010102', message: '点群データの点データをロードします。({0}/{1})'},
  DEBUG_ENABLE_EYE_MOVE: {code: 'D003010103', message: 'マウスやキーボードによる視点移動を有効にしました。'},
  DEBUG_DISABLE_EYE_MOVE: {code: 'D003010104', message: 'マウスやキーボードによる視点移動を無効にしました。'},
  DEBUG_ENABLE_DOUBLECLICK_FOCUS_MOVE: {code: 'D003010105', message: 'ダブルクリックによる注視点移動を有効にしました。'},
  DEBUG_DISABLE_DOUBLECLICK_FOCUS_MOVE: {code: 'D003010106', message: 'ダブルクリックによる注視点移動を無効にしました。'},
  DEBUG_ADD_POINT_CLOUD_OBJECT: {code: 'D003010107', message: '点群オブジェクト(ID：{0})をシーンに追加しました。'},
  DEBUG_REMOVE_POINT_CLOUD_OBJECT: {code: 'D003010108', message: '点群オブジェクト(ID：{0})をシーンから削除しました。'},
  DEBUG_ADD_NODE_OBJECT: {code: 'D003010109', message: 'ノードオブジェクト(ID：{0})をシーンに追加しました。'},
  DEBUG_REMOVE_NODE_OBJECT: {code: 'D003010110', message: 'ノードオブジェクト(ID：{0})をシーンから削除しました。'},
  DEBUG_RELEASE_VIEWER_RESOURCE: {code: 'D003010111', message: 'ビューアオブジェクトのリソースを解放しました。'},
  DEBUG_INSERT_INDEXEDDB_DATA: {code: 'D003010112', message: 'IndexedDBにデータを追加しました。({0}/{1})'},
  DEBUG_GET_INDEXEDDB_DATA: {code: 'D003010113', message: 'IndexedDBからデータを取得しました。({0}/{1})'},
  DEBUG_DELETE_INDEXEDDB_DATA: {code: 'D003010114', message: 'IndexedDBのデータベース({0})を削除しました。'},
  DEBUG_RELEASE_SCENE_RESOURCE: {code: 'D003010115', message: '3D空間のシーンオブジェクトのリソースを解放しました。'},
  DEBUG_RELEASE_CAMERA_RESOURCE: {code: 'D003010116', message: '3D空間のカメラ制御オブジェクトのリソースを解放しました。'},
  DEBUG_RELEASE_POINT_CLOUD_RESOURCE: {code: 'D003010117', message: '点群データ管理オブジェクトのリソースを解放しました。'},
  DEBUG_RELEASE_NODE_RESOURCE: {code: 'D003010118', message: 'ノードオブジェクトのリソースを解放しました。'},
  DEBUG_STATIC_VIEW_POINT_NUM: {code: 'D003010119', message: '動的間引き表示時以外の表示点数の最大値を[{0}]に設定しました。'},
  DEBUG_DYNAMIC_VIEW_POINT_NUM: {code: 'D003010120', message: '動的間引き表示時の表示点数の最大値を[{0}]に設定しました。'},

  // [DEBUG]点群データ計測
  DEBUG_SET_VERTICAL_DISTANCE_CALLBACK: {code: 'D003010201', message: '鉛直距離計測の計測結果設定用のコールバックを設定しました。'},
  DEBUG_SET_OBJ_ROTATION_CALLBACK: {code: 'D003010202', message: '範囲選択処理のオブジェクト回転状態設定用のコールバックを設定しました。'},
  DEBUG_RELEASE_POINT_MEASURE_RESOURCE: {code: 'D003010203', message: '点群データ計測オブジェクトのリソースを解放しました。'},
  DEBUG_SET_OBJ_SIZE_CALLBACK: {code: 'D003010204', message: '範囲選択処理のオブジェクトサイズ設定用のコールバックを設定しました。'},

  // [DEBUG]3Dオブジェクト表示
  DEBUG_ADD_POINT_OBJECT: {code: 'D003010401', message: '点オブジェクト({0})をシーンに追加しました。'},
  DEBUG_REMOVE_POINT_OBJECT: {code: 'D003010402', message: '点オブジェクト({0})をシーンから削除しました。'},
  DEBUG_ADD_LINE_OBJECT: {code: 'D003010403', message: '線オブジェクト({0})をシーンに追加しました。'},
  DEBUG_REMOVE_LINE_OBJECT: {code: 'D003010404', message: '線オブジェクト({0})をシーンから削除しました。'},
  DEBUG_ADD_SPRITE_OBJECT: {code: 'D003010405', message: 'スプライトオブジェクト({0})をシーンに追加しました。'},
  DEBUG_REMOVE_SPRITE_OBJECT: {code: 'D003010406', message: 'スプライトオブジェクト({0})をシーンから削除しました。'},
  DEBUG_ADD_STANDARD_MATERIAL_OBJECT: {code: 'D003010407', message: 'STANDARDマテリアルのオブジェクト({0})をシーンに追加しました。'},
  DEBUG_ADD_BASIC_MATERIAL_OBJECT: {code: 'D003010408', message: 'STANDARDマテリアルのオブジェクト({0})をシーンに追加しました。'},
  DEBUG_ADD_WIREFRAME_OBJECT: {code: 'D003010409', message: 'ワイヤーフレームオブジェクト({0})をシーンに追加しました。'},
  DEBUG_REMOVE_MESH_OBJECT: {code: 'D0030104010', message: 'メッシュオブジェクト({0})をシーンから削除しました。'},

  /************************************************************************************/
  // TRACE
  /************************************************************************************/
  // [TRACE]点群データ表示
  TRACE_WINDOW_RESIZE: {code: 'T003010101', message: 'ウィンドウリサイズイベント({0}, {1})が発生しました。'},
  TRACE_MOUSE_DOUBLE_CLICK: {code: 'T003010102', message: 'ビューアのマウスダブルクリックイベント({0}, {1})が発生しました。'},
  TRACE_MOUSE_DOWN: {code: 'T003010103', message: 'ビューアのマウスダウンイベント({0}, {1})が発生しました。'},
  TRACE_MOUSE_MOVE: {code: 'T003010104', message: 'ビューアのマウスムーブイベント({0}, {1})が発生しました。'},
  TRACE_MOUSE_UP: {code: 'T003010105', message: 'ビューアのマウスアップイベント({0}, {1})が発生しました。'},
  TRACE_MOUSE_DOWN_CTRL: {code: 'T003010106', message: 'ビューアのマウスダウンイベントにおいてコントロールキー押下状態です。'},
  TRACE_MOUSE_DOWN_SHIFT: {code: 'T003010107', message: 'ビューアのマウスダウンイベントにおいてシフトキー押下状態です。'},
  TRACE_START_ANIMATION: {code: 'T003010108', message: 'アニメーション処理を開始します。'},
  TRACE_DYNAMIC_LOD: {code: 'T003010109', message: '動的間引き表示で点群を表示します。'},
  TRACE_WIDE_LOD: {code: 'T003010110', message: '広域間引き表示で点群を表示します。'},
  TRACE_DEPTH_LOD: {code: 'T003010111', message: '深さ指定間引きで点群を表示します。'},
  TRACE_SAME_DEPTH_DISP: {code: 'T003010112', message: '同一深さ表示({0})で点群を表示します。'},
  TRACE_ALL_POINTS_DISP: {code: 'T003010113', message: '全点群表示で点群を表示します。'},
  TRACE_GRADATION_DISP: {code: 'T003010114', message: '段階表示で点群を表示します。'},
  TRACE_GET_OBJECTS_AT_NDC: {code: 'T003010115', message: '正規化デバイス座標({0}, {1})上のオブジェクトを{2}個取得しました。'},
  TRACE_GET_POINT_AT_NDC: {code: 'T003010116', message: '2D座標({0}, {1})上に存在する点の座標は({0}, {1}, {2})です。'},
  TRACE_SET_EYE_POSITION: {code: 'T003010117', message: '視点座標({0}, {1}, {2})を設定しました。'},
  TRACE_SET_FOCUS_POSITION: {code: 'T003010118', message: '注視点座標({0}, {1}, {2})を設定しました。'},
  TRACE_SET_CAMERA_FOV: {code: 'T003010119', message: '視野角({0})を設定しました。'},
  TRACE_VIEW_CONTROL_MOUSE_DOWN: {code: 'T003010120', message: '視点制御のマウスダウンイベント({0}, {1})が発生しました。'},
  TRACE_VIEW_CONTROL_MOUSE_MOVE: {code: 'T003010121', message: '視点制御のマウスムーブイベント({0}, {1})が発生しました。'},
  TRACE_VIEW_CONTROL_MOUSE_UP: {code: 'T003010122', message: '視点制御のマウスアップイベント({0}, {1})が発生しました。'},
  TRACE_VIEW_CONTROL_MOUSE_WHEEL: {code: 'T003010123', message: '視点制御のマウスホイールイベント(移動量：{0})が発生しました。'},
  TRACE_VIEW_CONTROL_KEY_DOWN: {code: 'T003010124', message: '視点制御のキーダウンイベント(コード：{0})が発生しました。'},

  // [TRACE]点群データ計測
  TRACE_MEASURE_START_SELECTION: {code: 'T003010201', message: '点群データ計測の選択開始処理({0}, {1})を開始します。'},
  TRACE_MEASURE_IN_PROGRESS: {code: 'T003010202', message: '点群データ計測の選択中処理({0}, {1})を開始します。'},
  TRACE_MEASURE_END_SELECTION: {code: 'T003010203', message: '点群データ計測の点選択処理を終了します。'},
  TRACE_UPDATE_OBJECT_STATE: {code: 'T003010204', message: '範囲選択処理のオブジェクト状態の更新処理を開始します。'},
  TRACE_SET_OBJECT_ROTATION: {code: 'T003010205', message: '範囲選択処理のオブジェクトの回転角度({0}, {1}, {2})を設定しました。'},
  TRACE_LAS_DOWNLOAD_ADD_DATA: {code: 'T003010206', message: '点データ({0})をダウンロードするLASデータに追加しました。'},
};
