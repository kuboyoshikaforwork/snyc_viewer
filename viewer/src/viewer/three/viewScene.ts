/**
 * @fileoverview 3D空間のシーンを提供するクラスの定義
 * @author Kota Kubota(SEQ)
 * @created 2025/05/02
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import * as THREE from 'three';
import {Intersection, Object3D} from 'three';
import {MTLLoader} from 'three/examples/jsm/loaders/MTLLoader.js';
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader.js';

import {ViewCamera} from './viewCamera';
import {ViewUtil} from '../util/viewUtil';
import {ViewRenderer} from './viewRenderer';
import {Logging} from '../log/logging';
import {LOG_CONF} from '../log/logConf';
import {COPCConf} from '../conf/copcConf';

/**
 * @interface オブジェクト情報
 */
interface ObjectInfo {
  object: THREE.Object3D<THREE.Object3DEventMap>;
  type: number;
  groupId: string;
  position: THREE.Vector3;
  visible: boolean;
}

/**
 * @interface ポリライン先端オブジェクト属性情報
 */
interface PolylineTipProp {
  type: number;
  length: number;
  color: THREE.Color;
  opacity: number;
  radius: number;
  topColor: THREE.Color;
  topRate: number;
}

/**
 * @interface 引出線付き文字列オブジェクト属性情報
 */
export interface LeadlineProp {
  pointColor: THREE.Color;
  pointRadius: number;
  font: string;
  fontSize: number;
  textColor: THREE.Color;
  textPosition: string;
  textMargin: number;
  text: string;
  lineColor: THREE.Color;
  lineWidth: number;
  lineHLength: number;
  lineVLength: number;
  lineAngle: number;
}

/**********************************/
// 共通固定値
/**********************************/
/** XYZ軸定義 */
const AXIS = {
  LENGTH: 0.7,
  HEAD_LENGTH: 0.2,
  HEAD_WIDTH: 0.1,
  X_COLOR: 0xff0000,
  Y_COLOR: 0x00ff00,
  Z_COLOR: 0x0000ff,
};
Object.freeze(AXIS);

/** オーバーレイシーン定義 */
const OVERLAY_SCENE_AREA_RATE = 0.08;
const OVERLAY_SCENE_POSITION = {
  LU: 0,
  LD: 1,
  RD: 2,
  RU: 3,
};
Object.freeze(OVERLAY_SCENE_POSITION);

/**********************************/
// GeoJSON固定値
/**********************************/
/** GeoJSON形状定義 */
const GEOJSON_GEOMETRY_TYPE = {
  POLYGON: 'Polygon',
  MULTI_POLYGON: 'MultiPolygon',
  POLYLINE: 'LineString',
  MULTI_POLYLINE: 'MultiLineString',
  POINT: 'Point',
  MULTI_POINT: 'MultiPoint',
};
Object.freeze(GEOJSON_GEOMETRY_TYPE);

/** GeoJSONオブジェクトのPointタイプ */
const GEOJSON_POINT_TYPE = {
  IMAGE: 1,
  LEADLINE: 2,
};
Object.freeze(GEOJSON_POINT_TYPE);

/** GeoJSONオブジェクトのポリラインの先端形状 */
const GEOJSON_POLYLINE_TIP_TYPE = {
  NONE: 0,
  SPHERE: 1,
  CONE: 2,
};
Object.freeze(GEOJSON_POLYLINE_TIP_TYPE);

/** GeoJSONオブジェクトの引出線付き文字列オブジェクトのテキスト表示位置 */
const GEOJSON_LEADLINE_TEXT_POSITION = {
  LEFT: 'left',
  CENTER: 'center',
  RIGHT: 'right',
};
Object.freeze(GEOJSON_LEADLINE_TEXT_POSITION);

/** GeoJSONオブジェクト種別定義 */
const GEOJSON_TYPE = {
  POLYGON: 0,
  POLYLINE: 1,
  IMAGE: 2,
  LEADLINE: 3,
};
Object.freeze(GEOJSON_TYPE);

/**********************************/
// プリミティブオブジェクト固定値
/**********************************/
/** プリミティブオブジェクト種別定義 */
const PRIMITIVE_TYPE = {
  SPHERE: 0,
  TRIGONAL_PYRAMIDS: 1,
  SQUARE_PYRAMIDS: 2,
  REGULAR_OCTAHEDRON: 3,
};
Object.freeze(PRIMITIVE_TYPE);

/**
 * 3D空間のシーンを提供するクラス
 */
export class ViewScene {
  /** 3D空間のカメラオブジェクト */
  protected camera: ViewCamera;
  /** 3D空間のレンダラー */
  protected renderer: ViewRenderer;

  /** 3D空間のオブジェクトを表示するシーン */
  protected sceneObj: THREE.Scene;
  /** XYZ座標軸を表示するオーバーレイ用のシーン */
  protected sceneOverlay: THREE.Scene;

  /** 環境光源 */
  protected ambientLights: THREE.AmbientLight[] = [];
  /** 平行光源 */
  protected directionalLights: THREE.DirectionalLight[] = [];

  /** XYZ座標軸オブジェクト */
  protected axis: THREE.Group = new THREE.Group();

  /** オーバーレイシーン表示位置 */
  protected overlayPosition: number = COPCConf.conf.AXIS_VIEW_POSITION;

  /** 登録OBJオブジェクトモデルの一覧 */
  private objModels: Map<number, THREE.Group<THREE.Object3DEventMap>> = new Map();
  /** OBJオブジェクトの一覧 */
  protected objObjects: Map<number, ObjectInfo> = new Map();

  /** プリミティブオブジェクトの一覧 */
  protected primitiveObjects: Map<number, ObjectInfo> = new Map();

  /** GeoJSONオブジェクトの一覧 */
  protected geojsonObjects: Map<number, ObjectInfo> = new Map();

  /** 3Dオブジェクト表示のオブジェクトIDの一覧 */
  private objectIds: Set<number> = new Set<number>();

  /** オブジェクトを非表示にする距離の閾値 */
  protected visibleLimitThreshold: number = 0;

  /**
   * 3D空間のシーンを生成する
   * @param camera 3D空間のカメラオブジェクト
   * @param renderer 3D空間のレンダラーオブジェクト
   */
  constructor(camera: ViewCamera, renderer: ViewRenderer) {
    this.camera = camera;
    this.renderer = renderer;

    // シーン生成
    this.sceneObj = new THREE.Scene();
    this.sceneOverlay = new THREE.Scene();

    // XYZ軸の設定
    this.axis = new THREE.Group();
    this.sceneOverlay.add(this.axis);
    this.initAxis();

    // 光源の設定
    this.initLight();

    // 設定値反映
    this.axis.visible = COPCConf.conf.AXIS_VIEW;
    this.overlayPosition = COPCConf.conf.AXIS_VIEW_POSITION;
    this.sceneObj.background = new THREE.Color(COPCConf.conf.BACKGROUD_COLOR);
  }

  /**
   * 3D空間のシーンオブジェクトに設定ファイルの定義を反映する。
   */
  public applyConfig(): void {
    // XYZ座標軸表示の設定
    this.axis.visible = COPCConf.conf.AXIS_VIEW;
    this.overlayPosition = COPCConf.conf.AXIS_VIEW_POSITION;

    // 背景色設定
    this.sceneObj.background = new THREE.Color(COPCConf.conf.BACKGROUD_COLOR);
  }

  /**
   * XYZ座標軸のオブジェクトを生成する
   */
  private initAxis(): void {
    // x軸方向矢印(赤)オブジェクトの生成
    this.axis.add(
      new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, 0),
        AXIS.LENGTH,
        AXIS.X_COLOR,
        AXIS.HEAD_LENGTH,
        AXIS.HEAD_WIDTH,
      ),
    );
    // y軸方向矢印(緑)オブジェクトの生成
    this.axis.add(
      new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 0),
        AXIS.LENGTH,
        AXIS.Y_COLOR,
        AXIS.HEAD_LENGTH,
        AXIS.HEAD_WIDTH,
      ),
    );
    // z軸方向矢印(青)オブジェクトの生成
    this.axis.add(
      new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, 0),
        AXIS.LENGTH,
        AXIS.Z_COLOR,
        AXIS.HEAD_LENGTH,
        AXIS.HEAD_WIDTH,
      ),
    );
  }

  /**
   * シーンの光源を生成する
   */
  private initLight(): void {
    // 環境光源(旧Vizの設定値を踏襲)
    const ambientLight = new THREE.AmbientLight(0xffffff);
    this.sceneObj.add(ambientLight);
    this.ambientLights.push(ambientLight);

    // 平行光源(旧Vizの設定値を踏襲)
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight1.position.set(1, 2, 3);
    this.sceneObj.add(directionalLight1);
    this.directionalLights.push(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight2.position.set(-1, -2, -3);
    this.sceneObj.add(directionalLight2);
    this.directionalLights.push(directionalLight2);

    const directionalLight3 = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight3.position.set(2, -1, -3);
    this.sceneObj.add(directionalLight3);
    this.directionalLights.push(directionalLight3);

    const directionalLight4 = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight4.position.set(-2, 1, 3);
    this.sceneObj.add(directionalLight4);
    this.directionalLights.push(directionalLight4);
  }

  /***
   * 生成したオブジェクトをシーンから全て削除し、リソースを解放する
   */
  public clear(): void {
    // XYZ座標軸
    for (const arrow of this.axis.children) {
      this.axis.remove(arrow);
    }
    this.sceneOverlay.remove(this.axis);

    // 光源
    for (const light of this.ambientLights) {
      this.sceneObj.remove(light);
    }
    for (const light of this.directionalLights) {
      this.sceneObj.remove(light);
    }
    Logging.debug(LOG_CONF.DEBUG_RELEASE_SCENE_RESOURCE);
  }

  /**
   * シーンのレンダリング、座標軸と各オブジェクトの表示状態を更新する
   * @param container 3D空間を表示するHTML要素
   */
  public update(container: HTMLElement): void {
    // レンダリング
    const rendererObj = this.renderer.get();
    // フレームバッファをクリア
    rendererObj.clear();

    // オブジェクトシーンをレンダリング
    rendererObj.render(this.sceneObj, this.camera.get());

    // オーバーレイシーンをレンダリング
    this.updateOverlay(rendererObj, container);

    // オブジェクトの表示状態の更新
    this.updateObj();

    // XYZ座標軸更新(カメラの逆クォータニオンで回転)
    this.axis.quaternion.copy(this.camera.get().quaternion.clone().invert());
  }

  /**
   * オーバーレイシーンの状態を更新する
   * @param rendererObj 3D空間のレンダラーオブジェクト
   * @param container 3D空間を表示するHTML要素
   */
  protected updateOverlay(rendererObj: THREE.WebGLRenderer, container: HTMLElement): void {
    // ビューポートを移動
    const size = container.clientWidth * OVERLAY_SCENE_AREA_RATE;
    if (this.overlayPosition === OVERLAY_SCENE_POSITION.LU) {
      // ビューポートを左上に設定
      rendererObj.setViewport(0, container.clientHeight - size, size, size);
    } else if (this.overlayPosition === OVERLAY_SCENE_POSITION.LD) {
      // ビューポートを左下に設定
      rendererObj.setViewport(0, 0, size, size);
    } else if (this.overlayPosition === OVERLAY_SCENE_POSITION.RD) {
      // ビューポートを右下に設定
      rendererObj.setViewport(container.clientWidth - size, 0, size, size);
    } else if (this.overlayPosition === OVERLAY_SCENE_POSITION.RU) {
      // ビューポートを右上に設定
      rendererObj.setViewport(container.clientWidth - size, container.clientHeight - size, size, size);
    }
    rendererObj.render(this.sceneOverlay, this.camera.getOverlay());

    // ビューポートを元に戻す
    rendererObj.setViewport(0, 0, container.clientWidth, container.clientHeight);
  }

  /**
   * オブジェクトの表示状態を更新する
   */
  protected updateObj(): void {
    // オブジェクトの表示状態更新
    if (0 < this.visibleLimitThreshold) {
      // 閾値設定0より大きい ⇒ 視点からの距離に応じた表示制御
      const eye = this.camera.get().position;
      // 対象のオブジェクト情報一覧を取得
      const objectInfos = [
        ...this.objObjects.values(),
        ...this.geojsonObjects.values(),
        ...this.primitiveObjects.values(),
      ];
      // 表示制御
      for (const objectInfo of objectInfos) {
        const dist = eye.distanceTo(objectInfo.position);
        if (dist <= this.visibleLimitThreshold) {
          // 距離が閾値以下 ⇒ 表示
          // もともとの設定が表示状態のオブジェクトのみ表示に変更
          if (objectInfo.visible) {
            objectInfo.object.visible = true;
          }
        } else {
          // 距離が閾値超過 ⇒ 非表示
          objectInfo.object.visible = false;
        }
      }
    } else {
      // 距離に応じた制御をしない ⇒ 表示設定のオブジェクトを表示する
      for (const objectInfo of this.objObjects.values()) {
        if (objectInfo.visible) {
          objectInfo.object.visible = true;
        }
      }
    }
  }

  /**
   * オブジェクトを表示するシーンにおいて指定した座標上に存在するオブジェクトを取得する
   * @param screen 2D座標(スクリーンの座標)
   * @returns オブジェクト一覧
   */
  public getIntersectObjects(screen: THREE.Vector2): Intersection<Object3D>[] {
    return this.camera.getIntersectObject(this.sceneObj, screen, true, true);
  }

  /************************************************************************************/
  // オブジェクト共通操作
  /************************************************************************************/

  /**
   * ジオメトリを削除し、リソースを解放する
   * @param geometry 削除するジオメトリ
   */
  protected removeGeometry(geometry: THREE.BufferGeometry): void {
    if (geometry) {
      geometry.dispose();
    }
  }

  /**
   * マテリアルとマテリアルに紐づくテクスチャを削除し、リソースを解放する
   * @param material 削除するマテリアル
   */
  protected removeMaterial(material: THREE.Material | THREE.Material[]): void {
    if (material) {
      if (Array.isArray(material)) {
        material.forEach((m: THREE.Material) => {
          if ('map' in m && m.map) {
            (m.map as THREE.Texture).dispose();
          }
          m.dispose();
        });
      } else {
        if ('map' in material && material.map) {
          (material.map as THREE.Texture).dispose();
        }
        material.dispose();
      }
    }
  }

  /**
   * 指定したグループオブジェクトがもつオブジェクトを削除し、リソースを解放する
   * @param group グループオブジェクト
   */
  private removeGroup(group: THREE.Group): void {
    for (const child of group.children) {
      // グループオブジェクトの場合再帰呼び出し
      if (child.type === 'Group') {
        this.removeGroup(child as THREE.Group);
      }
      // ジオメトリを持つ場合、ジオメトリ削除
      if ('geometry' in child && child.geometry) {
        this.removeGeometry(child.geometry as THREE.BufferGeometry);
      }
      // マテリアルを持つ場合、マテリアル削除
      if ('material' in child && child.material) {
        this.removeMaterial(child.material as THREE.Material | THREE.Material[]);
      }
      group.remove(child);
    }
  }

  /**
   * 指定したオブジェクトIDのオブジェクトを可視にする。
   * OBJ表示・GeoJSON表示・プリミティブオブジェクト表示で表示したオブジェクトを対象とする。
   * @param objId オブジェクトID
   * @throws 不正なオブジェクトIDの指定
   */
  public setObjectVisible(objId: number): void {
    let objectInfo = undefined;

    if (this.objObjects.has(objId)) {
      // OBJオブジェクト
      objectInfo = this.objObjects.get(objId)!;
    } else if (this.geojsonObjects.has(objId)) {
      // GeoJSONオブジェクト
      objectInfo = this.geojsonObjects.get(objId)!;
    } else if (this.primitiveObjects.has(objId)) {
      // プリミティブオブジェクト
      objectInfo = this.primitiveObjects.get(objId)!;
    }

    if (objectInfo) {
      objectInfo.object.visible = true;
      objectInfo.visible = true;
      Logging.info(LOG_CONF.INFO_VISIBLE_UNIT_OBJECT, objId.toString());
    } else {
      const message = Logging.error(LOG_CONF.ERROR_INVALID_OBJ_ID, objId.toString());
      throw new Error(message);
    }
  }

  /**
   * 指定したオブジェクトIDのオブジェクトを不可視にする。
   * OBJ表示・GeoJSON表示・プリミティブオブジェクト表示で表示したオブジェクトを対象とする。
   * @param objId オブジェクトID
   * @throws 不正なオブジェクトIDの指定
   */
  public setObjectInvisible(objId: number): void {
    let objectInfo = undefined;

    if (this.objObjects.has(objId)) {
      // OBJオブジェクト
      objectInfo = this.objObjects.get(objId)!;
    } else if (this.geojsonObjects.has(objId)) {
      // GeoJSONオブジェクト
      objectInfo = this.geojsonObjects.get(objId)!;
    } else if (this.primitiveObjects.has(objId)) {
      // プリミティブオブジェクト
      objectInfo = this.primitiveObjects.get(objId)!;
    }

    if (objectInfo) {
      objectInfo.object.visible = false;
      objectInfo.visible = false;
      Logging.info(LOG_CONF.INFO_INVISIBLE_UNIT_OBJECT, objId.toString());
    } else {
      const message = Logging.error(LOG_CONF.ERROR_INVALID_OBJ_ID, objId.toString());
      throw new Error(message);
    }
  }

  /**
   * 指定したオブジェクトIDのオブジェクトをシーンから削除する。
   * OBJ表示・GeoJSON表示・プリミティブオブジェクト表示で表示したオブジェクトを対象とする。
   * @param objId オブジェクトID
   * @throws 不正なオブジェクトIDの指定
   */
  public removeObject(objId: number): void {
    let objectInfo = undefined;

    if (this.objObjects.has(objId)) {
      // OBJオブジェクト
      objectInfo = this.objObjects.get(objId)!;
      const object = objectInfo.object as THREE.Group;
      this.sceneObj.remove(object);
      this.removeGroup(object);
      this.objObjects.delete(objId);
    } else if (this.geojsonObjects.has(objId)) {
      // GeoJSONオブジェクト
      objectInfo = this.geojsonObjects.get(objId)!;
      this.sceneObj.remove(objectInfo.object);
      if (objectInfo.object.type === 'Group') {
        const object = objectInfo.object as THREE.Group;
        this.removeGroup(object);
      } else {
        const object = objectInfo.object as THREE.Mesh;
        this.removeGeometry(object.geometry);
        this.removeMaterial(object.material);
      }
      this.geojsonObjects.delete(objId);
    } else if (this.primitiveObjects.has(objId)) {
      // プリミティブオブジェクト
      objectInfo = this.primitiveObjects.get(objId)!;
      const object = objectInfo.object as THREE.Mesh;
      this.sceneObj.remove(object);
      this.removeGeometry(object.geometry);
      this.removeMaterial(object.material);
      this.primitiveObjects.delete(objId);
    }

    if (objectInfo) {
      Logging.info(LOG_CONF.INFO_REMOVE_UNIT_OBJECT, objId.toString());
      this.objectIds.delete(objId);
    } else {
      const message = Logging.error(LOG_CONF.ERROR_INVALID_OBJ_ID, objId.toString());
      throw new Error(message);
    }
  }

  /**
   * 指定したグループIDのオブジェクトをシーンに表示する。
   * 指定したグループIDのオブジェクトが存在しない場合は何もしない。
   * OBJ表示・GeoJSON表示・プリミティブオブジェクト表示で表示したオブジェクトを対象とする。
   * @param groupId オブジェクトのグループID
   */
  public setGroupObjectVisible(groupId: string): void {
    const objectInfos = [
      ...this.objObjects.values(),
      ...this.geojsonObjects.values(),
      ...this.primitiveObjects.values(),
    ];

    // 表示制御
    let executed = false;
    for (const objectInfo of objectInfos) {
      if (groupId === objectInfo.groupId) {
        objectInfo.object.visible = true;
        objectInfo.visible = true;
        executed = true;
      }
    }

    if (executed) {
      Logging.info(LOG_CONF.INFO_VISIBLE_GROUP_OBJECT, groupId);
    }
  }

  /**
   * 指定したグループIDのオブジェクトを不可視にする。
   * 指定したグループIDのオブジェクトが存在しない場合は何もしない。
   * OBJ表示・GeoJSON表示・プリミティブオブジェクト表示で表示したオブジェクトを対象とする。
   * @param groupId オブジェクトのグループID
   */
  public setGroupObjectInvisible(groupId: string): void {
    const objectInfos = [
      ...this.objObjects.values(),
      ...this.geojsonObjects.values(),
      ...this.primitiveObjects.values(),
    ];

    // 表示制御
    let executed = false;
    for (const objectInfo of objectInfos) {
      if (groupId === objectInfo.groupId) {
        objectInfo.object.visible = false;
        objectInfo.visible = false;
        executed = true;
      }
    }

    if (executed) {
      Logging.info(LOG_CONF.INFO_INVISIBLE_GROUP_OBJECT, groupId);
    }
  }

  /**
   * 指定したグループIDのオブジェクトをシーンから削除する。
   * 指定したグループIDのオブジェクトが存在しない場合は何もしない。
   * OBJ表示・GeoJSON表示・プリミティブオブジェクト表示で表示したオブジェクトを対象とする。
   * @param groupId オブジェクトのグループID
   */
  public removeGroupObject(groupId: string): void {
    let executed = false;

    // OBJオブジェクト
    for (const [objId, objectInfo] of this.objObjects) {
      if (groupId === objectInfo.groupId) {
        this.removeObject(objId);
        executed = true;
      }
    }

    // GeoJSONオブジェクト
    for (const [objId, objectInfo] of this.geojsonObjects) {
      if (groupId === objectInfo.groupId) {
        this.removeObject(objId);
        executed = true;
      }
    }

    // プリミティブオブジェクト
    for (const [objId, objectInfo] of this.primitiveObjects) {
      if (groupId === objectInfo.groupId) {
        this.removeObject(objId);
        executed = true;
      }
    }

    if (executed) {
      Logging.info(LOG_CONF.INFO_REMOVE_GROUP_OBJECT, groupId);
    }
  }

  /**
   * オブジェクトがユーザの選択対象であるか判定する
   * @param object 判定対象のオブジェクト
   * @returns オブジェクトのID(非選択対象の場合:-1)
   */
  public isSelectableObject(object: THREE.Object3D<THREE.Object3DEventMap>): number {
    let id = -1;

    // オブジェクトのID取得
    if (object.parent && object.parent.type === 'Group') {
      if (this.objectIds.has(object.parent.id)) {
        id = object.parent.id;
      }
    } else {
      if (this.objectIds.has(object.id)) {
        id = object.id;
      }
    }

    // 引出線付き文字列オブジェクトは選択対象外
    const objectInfo = this.geojsonObjects.get(id);
    if (objectInfo && objectInfo.type === GEOJSON_TYPE.LEADLINE) {
      id = -1;
    }

    return id;
  }

  /**
   * 視点からの距離が一定以上離れたオブジェクトを非表示するための閾値を設定する
   * @param threshold 非表示するための閾値(0以下の場合すべて表示する)
   */
  public setVisibleLimitThreshold(threshold: number): void {
    this.visibleLimitThreshold = threshold;
    Logging.info(LOG_CONF.INFO_SET_OBJ_VISIBLE_THRESHOLD, threshold.toString());
  }

  /************************************************************************************/
  // OBJ表示
  /************************************************************************************/

  /**
   * OBJ形式ファイルのURLからオブジェクトを取得する
   * マテリアル指定がある場合は、指定したマテリアルつきつきオブジェクトを取得する
   * @param path OBJ形式ファイルのURL
   * @param material マテリアル定義
   * @returns OBJ形式ファイルのオブジェクト
   * @throws オブジェクト取得失敗
   */
  private async loadObj(
    path: string,
    material?: MTLLoader.MaterialCreator,
  ): Promise<THREE.Group<THREE.Object3DEventMap>> {
    return new Promise((resolve, reject) => {
      const objLoader = new OBJLoader();
      if (material) {
        // マテリアル設定
        objLoader.setMaterials(material);
      }
      // ロード実行
      objLoader.load(
        path,
        (model: THREE.Group<THREE.Object3DEventMap>) => resolve(model),
        () => {},
        () => {
          const message = Logging.error(LOG_CONF.ERROR_LOAD_OBJ_FILE, path);
          reject(new Error(message));
        },
      );
    });
  }

  /**
   * OBJ形式ファイルのファイル情報からオブジェクトを取得する
   * マテリアル指定がある場合は、指定したマテリアルにつきオブジェクトを取得する
   * @param file OBJ形式ファイルのファイル情報
   * @param material マテリアル定義
   * @returns OBJ形式ファイルのオブジェクト
   * @throws オブジェクト取得失敗
   */
  private async parseObj(
    file: File,
    material?: MTLLoader.MaterialCreator,
  ): Promise<THREE.Group<THREE.Object3DEventMap>> {
    return new Promise((resolve, reject) => {
      ViewUtil.loadTextFile(file)
        .then((content: string) => {
          const objLoader = new OBJLoader();
          if (material) {
            // マテリアル設定
            objLoader.setMaterials(material);
          }
          // パース実行
          const model = objLoader.parse(content);
          resolve(model);
        })
        .catch(() => {
          const message = Logging.error(LOG_CONF.ERROR_PARSE_OBJ_FILE, file.name);
          reject(new Error(message));
        });
    });
  }

  /**
   * MTL形式ファイルのURLからマテリアル定義を取得する
   * @param path MTL形式ファイルのURL
   * @returns マテリアル定義
   * @throws マテリアル取得失敗
   * */
  private async loadMtl(path: string): Promise<MTLLoader.MaterialCreator> {
    return new Promise((resolve, reject) => {
      const mtlLoader = new MTLLoader();
      mtlLoader.setMaterialOptions({side: THREE.DoubleSide});
      mtlLoader.load(
        path,
        (material: MTLLoader.MaterialCreator) => {
          material.preload();
          resolve(material);
        },
        () => {},
        () => {
          const message = Logging.error(LOG_CONF.ERROR_LOAD_MTL_FILE, path);
          reject(new Error(message));
        },
      );
    });
  }

  /**
   * OBJ形式のファイルを読み込みモデルとして登録する
   * @param obj OBJファイルのURLまたはファイル情報
   * @param color オブジェクトの色
   * @param opacity オブジェクトの透明度
   * @returns 登録モデルID
   * @throws OBJ形式の異常
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  public async loadOBJModel(obj: string | File, color: THREE.Color, opacity: number): Promise<number> {
    let model: THREE.Group<THREE.Object3DEventMap> | undefined = undefined;
    try {
      // モデル生成
      if (typeof obj === 'string') {
        model = await this.loadObj(obj);
      } else {
        model = await this.parseObj(obj);
      }
      // 設定値反映
      for (const child of model.children) {
        (child as any).material.color.set(color);
        (child as any).material.transparent = opacity < 1.0;
        (child as any).material.opacity = opacity;
        (child as any).material.needsUpdate = true;
        (child as any).material.side = THREE.DoubleSide;
      }

      // モデル登録
      this.objModels.set(model.id, model);
      Logging.info(LOG_CONF.INFO_REGIST_OBJ_MODEL, model.id.toString());
    } catch {
      const filename = typeof obj === 'string' ? obj : obj.name;
      const message = Logging.error(LOG_CONF.ERROR_REGIST_OBJ_MODEL, filename);
      throw new Error(message);
    }
    return model.id;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  /**
   * テクスチャ付きOBJ形式のファイルを読み込みモデルとして登録する
   * @param obj OBJファイルのURLまたはファイル情報
   * @param mtl MTL形式ファイルのURL
   * @returns 登録モデル
   * @throws OBJ形式の異常・MTL形式の異常・テクスチャサイズサポート対象外
   */
  public async loadTextureOBJModel(obj: string | File, mtl: string): Promise<number> {
    const objFilename = typeof obj === 'string' ? obj : obj.name;
    let material: MTLLoader.MaterialCreator | undefined = undefined;
    let model: THREE.Group<THREE.Object3DEventMap> | undefined = undefined;

    try {
      // テクスチャのロード
      material = await this.loadMtl(mtl);

      // モデル生成
      if (material) {
        if (typeof obj === 'string') {
          model = await this.loadObj(obj, material);
        } else {
          model = await this.parseObj(obj, material);
        }
      }
    } catch {
      // 後段の処理で例外スローするためここでは何もしない
    }

    if (model) {
      // テクスチャのサイズ確認
      const isSupportTexture = (material: THREE.Material) => {
        if ('map' in material && material.map) {
          const map = material.map as THREE.Texture;
          if (map.image && 'width' in map.image && 'height' in map.image) {
            if (
              !this.renderer.isSupportTextureSize(map.image.width) ||
              !this.renderer.isSupportTextureSize(map.image.height)
            ) {
              const message = Logging.error(LOG_CONF.ERROR_MTL_TEXTURE_SIZE, map.image.src);
              throw new Error(message);
            }
          }
        }
      };
      for (const child of model.children) {
        if ('material' in child && child.material) {
          const material = child.material as THREE.Material | THREE.Material[];
          if (Array.isArray(material)) {
            material.forEach((m: THREE.Material) => {
              isSupportTexture(m);
            });
          } else {
            isSupportTexture(material);
          }
        }
      }

      // モデル登録
      this.objModels.set(model.id, model);
      Logging.info(LOG_CONF.INFO_REGIST_MTL_MODEL, model.id.toString());
      return model.id;
    } else {
      const message = Logging.error(LOG_CONF.ERROR_REGIST_MTL_MODEL, mtl, objFilename);
      throw new Error(message);
    }
  }

  /**
   * 指定したモデルのオブジェクトを生成し、オブジェクト表示シーンに追加する
   * @param modelID シーンに追加するモデルID
   * @param groupId オブジェクトのグループID
   * @param position オブジェクト位置
   * @param roll オブジェクト姿勢のRoll要素
   * @param pitch オブジェクト姿勢のPitch要素
   * @param yaw オブジェクト姿勢のYaw要素
   * @param visible オブジェクトの可視/不可視設定(true：可視、false：不可視)
   * @returns オブジェクトID
   */
  public addOBJ(
    modelID: number,
    groupId: string,
    position: THREE.Vector3,
    roll: number,
    pitch: number,
    yaw: number,
    visible: boolean,
  ): number {
    // モデル取得
    const model = this.objModels.get(modelID);
    if (!model) {
      const message = Logging.error(LOG_CONF.ERROR_CREATE_OBJ, modelID.toString());
      throw new Error(message);
    }

    // オブジェクト生成
    const object = model.clone();
    const matrix = ViewUtil.getTranslationMatrix(position, roll, pitch, yaw);
    object.matrix = matrix;
    object.matrixAutoUpdate = false;
    object.visible = visible;

    // シーンへ追加
    this.sceneObj.add(object);

    // 表示情報の保持
    this.objectIds.add(object.id);
    this.objObjects.set(object.id, {object: object, groupId: groupId, type: 0, position: position, visible: visible});

    Logging.info(LOG_CONF.INFO_CREATE_OBJ_OBJECT, modelID.toString(), groupId, object.id.toString());

    return object.id;
  }

  /**
   * 全てのOBJのオブジェクトを可視にする
   */
  public setAllObjVisible(): void {
    for (const objId of this.objObjects.keys()) {
      this.setObjectVisible(objId);
    }
    Logging.info(LOG_CONF.INFO_VISIBLE_ALL_OBJ_OBJECT);
  }

  /**
   * 全てのOBJのオブジェクトを不可視にする
   */
  public setAllObjInvisible(): void {
    for (const objId of this.objObjects.keys()) {
      this.setObjectInvisible(objId);
    }
    Logging.info(LOG_CONF.INFO_INVISIBLE_ALL_OBJ_OBJECT);
  }

  /**
   * 全てのOBJのオブジェクトをシーンから削除する
   * 削除するオブジェクトに紐づくオブジェクトのモデルは削除されない
   */
  public removeAllObj(): void {
    for (const objId of this.objObjects.keys()) {
      this.removeObject(objId);
    }
    Logging.info(LOG_CONF.INFO_REMOVE_ALL_OBJ_OBJECT);
  }

  /************************************************************************************/
  // GeoJSON表示
  /************************************************************************************/

  /**
   * GeoJSON形式のファイルを読み込み、生成したオブジェクトをオブジェクト表示シーンに追加する
   * @param geoJSON GeoJSON形式ファイルのURLまたはファイル情報
   * @param groupId オブジェクトのグループID
   * @param visible オブジェクトの可視/不可視設定(true：可視、false：不可視)
   * @returns オブジェクトID
   * @throws GeoJSON形式の異常・画像データ取得失敗
   */
  public async addGeoJSONObject(geoJSON: string | File, groupId: string, visible: boolean): Promise<number[]> {
    // 生成済オブジェクトID一覧
    const ids: number[] = [];

    // ファイル読み込み
    const filename = typeof geoJSON === 'string' ? geoJSON : geoJSON.name;
    const geoJsonData = await ViewUtil.loadJsonFile(geoJSON);

    // フォーマットチェック
    const features = geoJsonData.features;
    if (!features || typeof features !== 'object') {
      const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'features');
      throw new Error(message);
    }

    try {
      for (const feature of features) {
        // フォーマットチェック
        if (!feature.properties || typeof feature.properties !== 'object') {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'properties');
          throw new Error(message);
        }
        if (!feature.geometry || typeof feature.geometry !== 'object') {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'geometry');
          throw new Error(message);
        }
        if (!feature.geometry.coordinates || typeof feature.geometry.coordinates !== 'object') {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'geometry/coordinates');
          throw new Error(message);
        }

        const properties = feature.properties;
        const geometry = feature.geometry;

        // 座標取得
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getCoordinates = (inCoordinates: any): THREE.Vector3[] => {
          const coordinates: THREE.Vector3[] = [];
          for (const coordinate of inCoordinates) {
            if (ViewUtil.is3DCoordFormatArray(coordinate)) {
              coordinates.push(new THREE.Vector3(coordinate[0], coordinate[1], coordinate[2]));
            } else {
              const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'geometry/coordinates');
              throw new Error(message);
            }
          }
          return coordinates;
        };

        // オブジェクト生成処理
        switch (geometry.type) {
          case GEOJSON_GEOMETRY_TYPE.POLYGON: {
            const coordinates = getCoordinates(geometry.coordinates);
            const id = this.addGeoJSONPolygon(filename, groupId, properties, coordinates, visible);
            ids.push(id);
            break;
          }
          case GEOJSON_GEOMETRY_TYPE.MULTI_POLYGON: {
            for (const coordinate of geometry.coordinates) {
              const coordinates = getCoordinates(coordinate);
              const id = this.addGeoJSONPolygon(filename, groupId, properties, coordinates, visible);
              ids.push(id);
            }
            break;
          }
          case GEOJSON_GEOMETRY_TYPE.POLYLINE: {
            const coordinates = getCoordinates(geometry.coordinates);
            const id = this.addGeoJSONLineString(filename, groupId, properties, coordinates, visible);
            ids.push(id);
            break;
          }
          case GEOJSON_GEOMETRY_TYPE.MULTI_POLYLINE: {
            for (const coordinate of geometry.coordinates) {
              const coordinates = getCoordinates(coordinate);
              const id = this.addGeoJSONLineString(filename, groupId, properties, coordinates, visible);
              ids.push(id);
            }
            break;
          }
          case GEOJSON_GEOMETRY_TYPE.POINT: {
            const coordinates = getCoordinates(geometry.coordinates);
            const id = await this.addGeoJSONPoint(filename, groupId, properties, coordinates, visible);
            ids.push(id);
            break;
          }
          case GEOJSON_GEOMETRY_TYPE.MULTI_POINT: {
            for (const coordinate of geometry.coordinates) {
              const coordinates = getCoordinates(coordinate);
              const id = await this.addGeoJSONPoint(filename, groupId, properties, coordinates, visible);
              ids.push(id);
            }
            break;
          }
          default: {
            const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'geometry/type');
            throw new Error(message);
          }
        }
      }
    } catch (error: unknown) {
      // 生成処理に途中失敗した場合、生成済のオブジェクトを破棄
      for (const id of ids) {
        this.removeObject(id);
      }
      if (error instanceof Error) {
        throw error;
      }
    }

    return ids;
  }

  /**
   * GeoJSON形式のジオメトリタイプがPolygonのプロパティ情報のチェックを行い、ポリゴンオブジェクトの生成処理を呼び出す
   * @param filename ファイル名
   * @param groupId オブジェクトのグループID
   * @param jsonProps GeoJSON形式のプロパティ情報
   * @param coords オブジェクト表示位置
   * @param visible オブジェクトの可視/不可視(true：可視、false：不可視)
   * @returns オブジェクトID
   * @throws GeoJSON形式の異常
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  private addGeoJSONPolygon(
    filename: string,
    groupId: string,
    jsonProps: any,
    coords: THREE.Vector3[],
    visible: boolean,
  ): number {
    // フォーマットチェック
    if (!jsonProps.color || !ViewUtil.isColorFormat(jsonProps.color)) {
      const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'color');
      throw new Error(message);
    }
    if (
      !jsonProps.opacity ||
      typeof jsonProps.opacity !== 'number' ||
      !(0 <= jsonProps.opacity && jsonProps.opacity <= 1.0)
    ) {
      const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'opacity');
      throw new Error(message);
    }
    if (coords.length < 3) {
      const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'geometry/coordinates');
      throw new Error(message);
    }

    // オブジェクト生成
    const mesh = this.addPolygonObject(coords, new THREE.Color(jsonProps.color), jsonProps.opacity, visible);

    // 表示位置(中心座標)の算出
    const position: THREE.Vector3 = new THREE.Vector3();
    for (const coord of coords) {
      position.add(coord);
    }
    position.divideScalar(coords.length);

    // 表示情報の保持
    this.objectIds.add(mesh.id);
    this.geojsonObjects.set(mesh.id, {
      object: mesh,
      groupId: groupId,
      type: GEOJSON_TYPE.POLYGON,
      position: position,
      visible: visible,
    });

    Logging.info(LOG_CONF.INFO_CREATE_GEOJSON_POLYGON, mesh.id.toString());

    return mesh.id;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  /**
   * ポリゴンオブジェクトを生成し、オブジェクト表示シーンに追加する
   * @param coords ポリゴン座標
   * @param color ポリゴンの色
   * @param opacity ポリゴンの透明度
   * @param visible ポリゴンの表示可否
   * @returns 生成オブジェクト
   */
  private addPolygonObject(coords: THREE.Vector3[], color: THREE.Color, opacity: number, visible: boolean): THREE.Mesh {
    const vertices: number[] = [];
    const indices: number[] = [];
    const verticesStart: number = 0;

    // 点作成
    for (const coord of coords) {
      vertices.push(coord.x, coord.y, coord.z);
    }

    // 多角形を三角形に分割
    for (let p = verticesStart; p < vertices.length - 2; p++) {
      indices.push(verticesStart, p + 1, p + 2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      opacity: opacity,
      transparent: opacity < 1.0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = visible;

    // シーンへ追加
    this.sceneObj.add(mesh);

    return mesh;
  }

  /**
   * GeoJSON形式のジオメトリタイプがLineStringのプロパティ情報のチェックを行い、
   * ポリラインオブジェクトの生成処理を呼び出す
   * @param filename ファイル名
   * @param groupId オブジェクトのグループID
   * @param jsonProps GeoJSON形式のプロパティ情報
   * @param coords オブジェクト表示位置
   * @param visible オブジェクトの可視/不可視(true：可視、false：不可視)
   * @returns オブジェクトID
   * @throws GeoJSON形式の異常
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  private addGeoJSONLineString(
    filename: string,
    groupId: string,
    jsonProps: any,
    coords: THREE.Vector3[],
    visible: boolean,
  ): number {
    // フォーマットチェック
    if (!jsonProps.color || !ViewUtil.isColorFormat(jsonProps.color)) {
      const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'color');
      throw new Error(message);
    }
    if (!jsonProps.thickness || typeof jsonProps.thickness !== 'number') {
      const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'thickness');
      throw new Error(message);
    }
    if (
      !jsonProps.opacity ||
      typeof jsonProps.opacity !== 'number' ||
      !(0 <= jsonProps.opacity && jsonProps.opacity <= 1.0)
    ) {
      const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'opacity');
      throw new Error(message);
    }
    if (coords.length < 2) {
      const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'geometry/coordinates');
      throw new Error(message);
    }

    // 先端フォーマットチェック定義
    const tipFormatCheck = (tipProps: any, startEnd: string): boolean => {
      const tipType = Object.values(GEOJSON_POLYLINE_TIP_TYPE);
      if (typeof tipProps.type !== 'number' || !tipType.includes(tipProps.type)) {
        const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, startEnd + '/type');
        throw new Error(message);
      }
      if (!tipProps.length || typeof tipProps.length !== 'number') {
        const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, startEnd + '/length');
        throw new Error(message);
      }
      if (!tipProps.color || !ViewUtil.isColorFormat(tipProps.color)) {
        const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, startEnd + '/color');
        throw new Error(message);
      }
      if (
        !tipProps.opacity ||
        typeof tipProps.opacity !== 'number' ||
        !(0 <= jsonProps.opacity && jsonProps.opacity <= 1.0)
      ) {
        const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, startEnd + '/opacity');
        throw new Error(message);
      }
      if (!tipProps.radius || typeof tipProps.radius !== 'number') {
        const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, startEnd + '/radius');
        throw new Error(message);
      }
      if (!tipProps.topColor || !ViewUtil.isColorFormat(tipProps.topColor)) {
        const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, startEnd + '/topColor');
        throw new Error(message);
      }
      if (
        !tipProps.topRate ||
        typeof tipProps.topRate !== 'number' ||
        !(0 <= tipProps.topRate && tipProps.topRate <= 1.0)
      ) {
        const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, startEnd + '/topRate');
        throw new Error(message);
      }

      return true;
    };
    // 先端フォーマットチェック
    tipFormatCheck(jsonProps.start, 'START');
    tipFormatCheck(jsonProps.end, 'END');

    // 先端オブジェクトの情報生成定義
    const getTipPropObject = (input: any) => {
      const tip: PolylineTipProp = {
        type: 0,
        length: 0,
        color: new THREE.Color(0x000000),
        opacity: 0,
        radius: 0,
        topColor: new THREE.Color(0x000000),
        topRate: 0,
      };
      if (input) {
        tip.type = input.type;
        tip.length = input.length;
        tip.color = new THREE.Color(input.color);
        tip.opacity = input.opacity;
        tip.radius = input.radius;
        tip.topColor = new THREE.Color(input.topColor);
        tip.topRate = input.topRate;
      }
      return tip;
    };
    // 先端オブジェクトの情報生成
    const startTip: PolylineTipProp = getTipPropObject(jsonProps.start);
    const endTip: PolylineTipProp = getTipPropObject(jsonProps.end);

    // オブジェクト生成
    const group = this.addPolylineObject(
      coords,
      new THREE.Color(jsonProps.color),
      jsonProps.opacity,
      jsonProps.thickness,
      startTip,
      endTip,
      visible,
    );

    // 表示位置(始点と終点の中心座標)の算出
    const position = coords[0].clone().add(coords[coords.length - 1]);
    position.divideScalar(2.0);

    // 表示情報の保持
    this.objectIds.add(group.id);
    this.geojsonObjects.set(group.id, {
      object: group,
      groupId: groupId,
      type: GEOJSON_TYPE.POLYLINE,
      position: position,
      visible: visible,
    });

    Logging.info(LOG_CONF.INFO_CREATE_GEOJSON_POLYLINE, group.id.toString());

    return group.id;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  /**
   * ポリラインオブジェクトを生成し、オブジェクト表示シーンに追加する
   * @param coords ポリライン座標
   * @param color ポリラインの色
   * @param opacity ポリラインの透明度
   * @param thickness ポリラインの直径の太さ
   * @param start ポリライン始端設定値(未定義の場合先端は生成しない)
   * @param end ポリライン終端設定値(未定義の場合先端は生成しない)
   * @param visible オブジェクトの可視/不可視(true：可視、false：不可視)
   * @returns 生成オブジェクト
   */
  private addPolylineObject(
    coords: THREE.Vector3[],
    color: THREE.Color,
    opacity: number,
    thickness: number,
    start: PolylineTipProp,
    end: PolylineTipProp,
    visible: boolean,
  ): THREE.Group {
    // ポリラインオブジェクトグループ
    const polyline = new THREE.Group();

    // 始点と終点設定
    const startPoint = coords[0].clone();
    const endPoint = coords[1].clone();

    // 先端オブジェクト作成
    const tipStart = this.addPolylineTipObject(startPoint, endPoint, start, visible);
    if (tipStart) {
      polyline.add(tipStart);
      // 座標更新(オブジェクトのサイズ分座標をずらす)
      const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
      coords[0] = new THREE.Vector3().addVectors(startPoint, direction.multiplyScalar(start.length));
    }
    const tipEnd = this.addPolylineTipObject(endPoint, startPoint, end, visible);
    if (tipEnd) {
      polyline.add(tipEnd);
      // 座標更新(オブジェクトのサイズ分座標をずらす)
      const direction = new THREE.Vector3().subVectors(startPoint, endPoint).normalize();
      coords[1] = new THREE.Vector3().addVectors(endPoint, direction.multiplyScalar(end.length));
    }

    // 始点終点の座標調整後の円柱の高さ
    const height = coords[0].distanceTo(coords[1]);

    // 始点終点の座標調整後の円柱の中心座標
    const midpoint = new THREE.Vector3().addVectors(coords[0], coords[1]).divideScalar(2.0);

    // 円柱オブジェクト生成
    const geometry = new THREE.CylinderGeometry(thickness, thickness, height, 60);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      opacity: opacity,
      transparent: opacity < 1.0,
      side: THREE.DoubleSide,
    });
    const cylinder = new THREE.Mesh(geometry, material);
    cylinder.position.copy(midpoint);
    cylinder.visible = visible;

    // 回転状態反映
    const up = new THREE.Vector3(0, 1, 0);
    const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
    cylinder.quaternion.copy(quaternion);
    polyline.add(cylinder);

    // シーンへ追加
    this.sceneObj.add(polyline);

    return polyline;
  }

  /**
   * ポリラインの先端オブジェクトを生成する
   * @param targetSideCoord 先端オブジェクト生成側の座標
   * @param nonSideCoord 先端オブジェクト生成側と反対の座標
   * @param tipProp ポリライン先端の設定値
   * @param visible オブジェクトの可視/不可視(true：可視、false：不可視)
   * @returns 生成オブジェクト(未生成の場合はundefined)
   */
  private addPolylineTipObject(
    targetSideCoord: THREE.Vector3,
    nonSideCoord: THREE.Vector3,
    tipProp: PolylineTipProp,
    visible: boolean,
  ): THREE.Mesh | undefined {
    let mesh: THREE.Mesh | undefined = undefined;

    switch (tipProp.type) {
      case GEOJSON_POLYLINE_TIP_TYPE.NONE:
        break;
      case GEOJSON_POLYLINE_TIP_TYPE.SPHERE: {
        // オブジェクト生成
        const geometry = new THREE.SphereGeometry(tipProp.length / 2, 32, 32);
        const material = new THREE.MeshBasicMaterial({
          color: tipProp.color,
          opacity: tipProp.opacity,
          transparent: tipProp.opacity < 1.0,
          side: THREE.DoubleSide,
        });
        mesh = new THREE.Mesh(geometry, material);
        const direction = new THREE.Vector3().subVectors(targetSideCoord, nonSideCoord).normalize();
        const offset = direction.clone().multiplyScalar(-tipProp.length / 2);
        mesh.position.copy(targetSideCoord).add(offset);
        break;
      }
      case GEOJSON_POLYLINE_TIP_TYPE.CONE: {
        // 側面のキャンバス生成
        const sideCanvas = document.createElement('canvas');
        sideCanvas.width = 100;
        sideCanvas.height = 100;
        const sidectx = sideCanvas.getContext('2d');
        if (sidectx) {
          sidectx.fillStyle = '#' + tipProp.topColor.getHexString();
          sidectx.fillRect(0, 0, 100, 100 * tipProp.topRate);
          sidectx.fillStyle = '#' + tipProp.color.getHexString();
          sidectx.fillRect(0, 100 * tipProp.topRate, 100, 100 * (1 - tipProp.topRate));
        }
        // 底面のキャンバス生成
        const bottomCanvas = document.createElement('canvas');
        bottomCanvas.width = 100;
        bottomCanvas.height = 100;
        const ctx = bottomCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#' + tipProp.color.getHexString();
          ctx.fillRect(0, 0, 100, 100);
        }

        // 側面と底面のマテリアル作成
        const sideTexture = new THREE.CanvasTexture(sideCanvas);
        const sideMat = new THREE.MeshBasicMaterial({
          map: sideTexture,
          opacity: tipProp.opacity,
          transparent: tipProp.opacity < 1.0,
          side: THREE.FrontSide,
        });
        const bottomTexture = new THREE.CanvasTexture(bottomCanvas);
        const bottomMat = new THREE.MeshBasicMaterial({
          map: bottomTexture,
          opacity: tipProp.opacity,
          transparent: tipProp.opacity < 1.0,
          side: THREE.FrontSide,
        });
        // オブジェクト生成
        const geometry = new THREE.CylinderGeometry(0, tipProp.radius, tipProp.length, 60, 1, false);
        const material = [sideMat, bottomMat, bottomMat];
        mesh = new THREE.Mesh(geometry, material);

        // 円錐の位置・回転の設定
        const direction = new THREE.Vector3().subVectors(targetSideCoord, nonSideCoord).normalize();
        const offset = direction.clone().multiplyScalar(-tipProp.length / 2);
        mesh.position.copy(targetSideCoord).add(offset);
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
        mesh.quaternion.copy(quaternion);
        break;
      }
      default: {
        const message = Logging.error(
          LOG_CONF.ERROR_INVALID_ARGUMENT,
          'addPolylineTipObject',
          'type',
          tipProp.type.toString(),
        );
        throw new Error(message);
      }
    }

    if (mesh) {
      mesh.visible = visible;
    }

    return mesh;
  }

  /**
   * GeoJSON形式のジオメトリタイプがPointのプロパティ情報のチェックを行い、
   * 設定種別に応じて画像オブジェクトまたは引出線付き文字列オブジェクトの生成処理を呼び出す
   * @param filename ファイル名
   * @param groupId オブジェクトのグループID
   * @param jsonProps GeoJSON形式のプロパティ情報
   * @param coords オブジェクト表示位置
   * @param visible オブジェクトの可視/不可視設定(true：可視、false：不可視)
   * @returns オブジェクトID
   * @throws GeoJSON形式の異常・画像データ取得失敗
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  private async addGeoJSONPoint(
    filename: string,
    groupId: string,
    jsonProps: any,
    coords: THREE.Vector3[],
    visible: boolean,
  ): Promise<number> {
    // フォーマットチェック
    if (coords.length !== 1) {
      const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'geometry/coordinates');
      throw new Error(message);
    }

    let sprite: THREE.Sprite;
    let geojsonType: number = -1;
    switch (jsonProps.type) {
      case GEOJSON_POINT_TYPE.IMAGE: {
        // フォーマットチェック
        if (!jsonProps.texture || typeof jsonProps.texture !== 'string') {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'texture');
          throw new Error(message);
        }
        if (!jsonProps.scale || typeof jsonProps.scale !== 'number') {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'scale');
          throw new Error(message);
        }
        sprite = await this.addImageBillboardObject(coords[0], jsonProps.texture, jsonProps.scale, visible);
        geojsonType = GEOJSON_TYPE.IMAGE;
        Logging.info(LOG_CONF.INFO_CREATE_GEOJSON_IMAGE, sprite.id.toString());
        break;
      }
      case GEOJSON_POINT_TYPE.LEADLINE: {
        // フォーマットチェック
        if (!jsonProps.pointColor || !ViewUtil.isColorFormat(jsonProps.pointColor)) {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'pointColor');
          throw new Error(message);
        }
        if (!jsonProps.pointRadius || typeof jsonProps.pointRadius !== 'number') {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'pointRadius');
          throw new Error(message);
        }
        if (!jsonProps.font || typeof jsonProps.font !== 'string') {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'font');
          throw new Error(message);
        }
        if (!jsonProps.fontSize || typeof jsonProps.fontSize !== 'number') {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'fontSize');
          throw new Error(message);
        }
        if (!jsonProps.textColor || !ViewUtil.isColorFormat(jsonProps.textColor)) {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'textColor');
          throw new Error(message);
        }
        const positions: string[] = Object.values(GEOJSON_LEADLINE_TEXT_POSITION);
        if (
          !jsonProps.textPosition ||
          typeof jsonProps.textPosition !== 'string' ||
          !positions.includes(jsonProps.textPosition)
        ) {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'textPosition');
          throw new Error(message);
        }
        if (!jsonProps.textMargin || typeof jsonProps.textMargin !== 'number') {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'textMargin');
          throw new Error(message);
        }
        if (!jsonProps.text || typeof jsonProps.text !== 'string') {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'text');
          throw new Error(message);
        }
        if (!jsonProps.lineColor || !ViewUtil.isColorFormat(jsonProps.lineColor)) {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'lineColor');
          throw new Error(message);
        }
        if (!jsonProps.lineWidth || typeof jsonProps.lineWidth !== 'number') {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'lineWidth');
          throw new Error(message);
        }
        if (!jsonProps.lineHLength || typeof jsonProps.lineHLength !== 'number') {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'lineHLength');
          throw new Error(message);
        }
        if (!jsonProps.lineVLength || typeof jsonProps.lineVLength !== 'number') {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'lineVLength');
          throw new Error(message);
        }
        if (
          !jsonProps.lineAngle ||
          typeof jsonProps.lineAngle !== 'number' ||
          !(0 <= jsonProps.lineAngle && jsonProps.lineAngle <= 359)
        ) {
          const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'lineAngle');
          throw new Error(message);
        }
        // オブジェクトの情報生成
        const leadlineProp: LeadlineProp = {
          pointColor: new THREE.Color(jsonProps.pointColor),
          pointRadius: jsonProps.pointRadius,
          font: jsonProps.font,
          fontSize: jsonProps.fontSize,
          textColor: new THREE.Color(jsonProps.textColor),
          textPosition: jsonProps.textPosition,
          textMargin: jsonProps.textMargin,
          text: jsonProps.text,
          lineColor: new THREE.Color(jsonProps.lineColor),
          lineWidth: jsonProps.lineWidth,
          lineHLength: jsonProps.lineHLength,
          lineVLength: jsonProps.lineVLength,
          lineAngle: jsonProps.lineAngle,
        };
        sprite = await this.addLeadlineBillboardObject(coords[0], leadlineProp, jsonProps.scale, visible);
        geojsonType = GEOJSON_TYPE.LEADLINE;
        Logging.info(LOG_CONF.INFO_CREATE_GEOJSON_LEADLINE, sprite.id.toString());
        break;
      }
      default: {
        const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON, filename, 'type');
        throw new Error(message);
      }
    }

    // 表示情報の保持
    this.objectIds.add(sprite.id);
    this.geojsonObjects.set(sprite.id, {
      object: sprite,
      groupId: groupId,
      type: geojsonType,
      position: coords[0],
      visible: visible,
    });

    return sprite.id;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  /**
   * ビルボードの画像オブジェクトを生成し、オブジェクト表示シーンに追加する。
   * @param coords 画像オブジェクト座標
   * @param url 画像ファイルのURL
   * @param scale オブジェクトのスケール
   * @param visible オブジェクトの可視/不可視設定(true：可視、false：不可視)
   * @returns 生成オブジェクト
   * @throws 画像データ取得失敗
   */
  private async addImageBillboardObject(
    coords: THREE.Vector3,
    url: string,
    scale: number,
    visible: boolean,
  ): Promise<THREE.Sprite> {
    let sprite: THREE.Sprite;

    // テクスチャロード処理
    const loadImage = (url: string): Promise<THREE.Texture> => {
      return new Promise((resolve, reject) => {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
          url,
          (texture: THREE.Texture) => resolve(texture),
          () => {},
          (error: unknown) => reject(error),
        );
      });
    };

    try {
      // キャンパスの作成
      const texture: THREE.Texture = await loadImage(url);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = texture.image.width;
      canvas.height = texture.image.height;

      // キャンパスに画像を描画
      if (context) {
        context.drawImage(texture.image, 0, 0);
      }

      // スプライトの作成
      const canvasTexture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({map: canvasTexture});
      sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(coords);
      sprite.scale.x = scale;
      sprite.scale.y = (texture.image.height / texture.image.width) * scale;
      sprite.visible = visible;
    } catch {
      const message = Logging.error(LOG_CONF.ERROR_CREATE_GEOJSON_IMAGE, url);
      throw new Error(message);
    }

    // シーンへ追加
    this.sceneObj.add(sprite);

    return sprite;
  }

  /**
   * ビルボードの引出線付き文字列オブジェクトを生成し、オブジェクト表示シーンに追加する。
   * @param coords 引出線付き文字列オブジェクト座標
   * @param leadlineProp 引出線付き文字列オブジェクトの設定値
   * @param scale オブジェクトのスケール
   * @param visible オブジェクトの可視/不可視設定(true：可視、false：不可視)
   * @returns 生成オブジェクト
   */
  public addLeadlineBillboardObject(
    coords: THREE.Vector3,
    leadlineProp: LeadlineProp,
    scale: number,
    visible: boolean,
  ): THREE.Sprite {
    // 点・テキスト・斜めのライン・水平なラインをキャンパスに追加
    const textCanvas = document.createElement('canvas');
    let vLengthSign = 1;
    if (leadlineProp.lineAngle >= 180) {
      vLengthSign = -1;
    }

    const calculateHorizontal = (angle: number, vertical: number): number => {
      if (angle % 180 === 0) {
        return 0;
      } else {
        return vertical / Math.tan(THREE.MathUtils.degToRad(angle));
      }
    };

    const horizontal = calculateHorizontal(leadlineProp.lineAngle, leadlineProp.lineVLength * vLengthSign);
    textCanvas.width = (Math.abs(horizontal) + leadlineProp.lineHLength) * 2;
    textCanvas.height = (leadlineProp.fontSize + leadlineProp.lineVLength) * 2 + leadlineProp.lineWidth;
    const context = textCanvas.getContext('2d');

    if (context) {
      // キャンパスの背景を透明に設定
      context.clearRect(0, 0, textCanvas.width, textCanvas.height);
      // ラインとテキストのポジション
      // テキストのポジションは水平ラインの左端から詰めて表示するときの位置で初期化
      let lineposX = textCanvas.width / 2;
      let lineposY = textCanvas.height / 2;
      let textposX = lineposY;
      let linedirect = 1;

      if (horizontal === 0) {
        if (leadlineProp.lineAngle === 0) {
          textposX = lineposX;
        } else {
          textposX = lineposX + leadlineProp.lineHLength * -1;
          linedirect = -1;
        }
      } else if (horizontal > 0) {
        lineposX += horizontal;
        if (leadlineProp.lineAngle <= 90) {
          lineposY -= leadlineProp.lineVLength;
        } else {
          lineposY += leadlineProp.lineVLength;
        }
        textposX = lineposX;
      } else {
        lineposX += horizontal;
        if (leadlineProp.lineAngle < 180) {
          lineposY -= leadlineProp.lineVLength;
        } else {
          lineposY += leadlineProp.lineVLength;
        }
        linedirect = -1;
        textposX = lineposX + leadlineProp.lineHLength * linedirect;
      }
      const textposY = lineposY;

      // ライン追加
      context.lineWidth = leadlineProp.lineWidth;
      context.strokeStyle = '#' + leadlineProp.lineColor.getHexString();
      context.beginPath();
      context.moveTo(textCanvas.width / 2, textCanvas.height / 2);
      context.lineTo(lineposX, lineposY);
      context.lineTo(lineposX + leadlineProp.lineHLength * linedirect, lineposY);
      context.stroke();
      context.closePath();

      // テキスト追加
      context.fillStyle = '#' + leadlineProp.textColor.getHexString();
      context.font = `${leadlineProp.fontSize}px ${leadlineProp.font}`;
      let shortText = leadlineProp.text;

      // ポイント追加
      context.beginPath();
      context.arc(textCanvas.width / 2, textCanvas.height / 2, leadlineProp.pointRadius, 0, Math.PI * 2, false);
      context.fillStyle = '#' + leadlineProp.pointColor.getHexString();
      context.fill();
      context.closePath();

      if (context.measureText('あ').width + leadlineProp.lineWidth / 2 > leadlineProp.lineHLength) {
        // テキストが表示できないとき
        shortText = '';
      } else if (context.measureText('あ…').width + leadlineProp.lineWidth / 2 > leadlineProp.lineHLength) {
        // 水平ラインの長さがテキスト二文字分より短いとき
        shortText = '…';
      } else {
        //テキストの長さが水平方向のラインより長い場合、はみ出すテキストを切り捨てる
        while (context.measureText(shortText).width + leadlineProp.lineWidth / 2 > leadlineProp.lineHLength) {
          // 二文字減らす
          shortText = shortText.slice(0, -2);
          shortText = shortText + '…';
        }
      }

      // GeoJsonの定義位置に表示
      switch (leadlineProp.textPosition) {
        case GEOJSON_LEADLINE_TEXT_POSITION.LEFT:
          break;
        case GEOJSON_LEADLINE_TEXT_POSITION.CENTER:
          textposX = lineposX + (leadlineProp.lineHLength * linedirect) / 2 - context.measureText(shortText).width / 2;
          break;
        case GEOJSON_LEADLINE_TEXT_POSITION.RIGHT:
          if (linedirect === 1) {
            textposX = lineposX + leadlineProp.lineHLength * linedirect - context.measureText(shortText).width;
          } else {
            textposX = lineposX - context.measureText(shortText).width;
          }
          break;
        default: {
          const message = Logging.error(
            LOG_CONF.ERROR_INVALID_ARGUMENT,
            'addLeadlineBillboardObject',
            'type',
            leadlineProp.textPosition,
          );
          throw new Error(message);
        }
      }

      // テキストのふちどり
      context.fillText(shortText, textposX, textposY - leadlineProp.lineWidth);
      context.strokeStyle = 'white';
      context.lineWidth = leadlineProp.fontSize / 100;
      context.strokeText(shortText, textposX, textposY - leadlineProp.lineWidth);
    }

    // オブジェクト生成
    const texture = new THREE.CanvasTexture(textCanvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({map: texture, transparent: true});
    const sprite = new THREE.Sprite(material);

    // スプライトの中心の位置を設定
    sprite.position.copy(coords);
    sprite.scale.x = scale;
    sprite.scale.y = (textCanvas.height / textCanvas.width) * scale;
    sprite.visible = visible;

    // シーンへ追加
    this.sceneObj.add(sprite);

    return sprite;
  }

  /**
   * 指定した種別またはすべてのGeoJSONオブジェクトを可視にする
   * @param type オブジェクト種別 (0: ポリゴン, 1: ポリライン, 2: 画像オブジェクト, 3: 引出線付き文字列オブジェクト)
   * @throws 指定可能なオブジェクト種別以外の数値を設定
   */
  public setAllGeoJSONVisible(type?: number): void {
    if (undefined !== type) {
      // 指定した種別のGeoJSONオブジェクトを対象
      const types: number[] = Object.values(GEOJSON_TYPE);
      if (types.includes(type)) {
        for (const [objId, objInfo] of this.geojsonObjects) {
          if (objInfo.type === type) {
            this.setObjectVisible(objId);
          }
        }
        Logging.info(LOG_CONF.INFO_VISIBLE_ALL_GEOJSON_OBJECT, '-');
      } else {
        const message = Logging.error(LOG_CONF.ERROR_VISIBLE_GEOJSON, type.toString());
        throw new Error(message);
      }
      Logging.info(LOG_CONF.INFO_VISIBLE_ALL_GEOJSON_OBJECT, type.toString());
    } else {
      // すべてのGeoJSONオブジェクトを対象
      for (const objId of this.geojsonObjects.keys()) {
        this.setObjectVisible(objId);
      }
      Logging.info(LOG_CONF.INFO_VISIBLE_ALL_GEOJSON_OBJECT, '-');
    }
  }

  /**
   * 指定した種別またはすべてのGeoJSONオブジェクトを不可視にする
   * @param type オブジェクト種別(0:ポリゴン 1:ポリライン 2:画像オブジェクト 3:引出線付き文字列オブジェクト)
   * @throws 指定可能なオブジェクト種別以外の数値を設定
   */
  public setAllGeoJSONInvisible(type?: number): void {
    if (undefined !== type) {
      // 指定した種別のGeoJSONオブジェクトを対象
      const types: number[] = Object.values(GEOJSON_TYPE);
      if (types.includes(type)) {
        for (const [objId, objInfo] of this.geojsonObjects) {
          if (objInfo.type === type) {
            this.setObjectInvisible(objId);
          }
        }
      } else {
        const message = Logging.error(LOG_CONF.ERROR_INVISIBLE_GEOJSON, type.toString());
        throw new Error(message);
      }
      Logging.info(LOG_CONF.INFO_INVISIBLE_ALL_GEOJSON_OBJECT, type.toString());
    } else {
      // すべてのGeoJSONオブジェクトを対象
      for (const objId of this.geojsonObjects.keys()) {
        this.setObjectInvisible(objId);
      }
      Logging.info(LOG_CONF.INFO_INVISIBLE_ALL_GEOJSON_OBJECT, '-');
    }
  }

  /**
   * 指定した種別またはすべてのGeoJSONオブジェクトをシーンから削除する
   * @param type オブジェクト種別(0:ポリゴン 1:ポリライン 2:画像オブジェクト 3:引出線付き文字列オブジェクト)
   * @throws 指定可能なオブジェクト種別以外の数値を設定
   */
  public removeAllGeoJSON(type?: number): void {
    if (undefined !== type) {
      // 指定した種別のGeoJSONオブジェクトを対象
      const types: number[] = Object.values(GEOJSON_TYPE);
      if (types.includes(type)) {
        for (const [objId, objInfo] of this.geojsonObjects) {
          if (objInfo.type === type) {
            this.removeObject(objId);
          }
        }
      } else {
        const message = Logging.error(LOG_CONF.ERROR_REMOVE_GEOJSON, type.toString());
        throw new Error(message);
      }
      Logging.info(LOG_CONF.INFO_REMOVE_ALL_GEOJSON_OBJECT, type.toString());
    } else {
      // すべてのGeoJSONオブジェクトを対象
      for (const objId of this.geojsonObjects.keys()) {
        this.removeObject(objId);
      }
      Logging.info(LOG_CONF.INFO_REMOVE_ALL_GEOJSON_OBJECT, '-');
    }
  }

  /************************************************************************************/
  // プリミティブオブジェクト表示
  /************************************************************************************/

  /**
   * 球のプリミティブオブジェクトを生成し、オブジェクト表示シーンに追加する。
   * @param groupId オブジェクトのグループID
   * @param position 球の中心座標
   * @param radius 球の半径
   * @param color 球の色
   * @param visible オブジェクトの可視/不可視設定(true：可視、false：不可視)
   * @retruns オブジェクトID
   * @throws 異常パラメータ
   */
  public addPrimitiveSphere(
    groupId: string,
    position: THREE.Vector3,
    radius: number,
    color: THREE.Color,
    visible: boolean,
  ): number {
    // パラメータチェック
    if (radius <= 0) {
      const message = Logging.error(LOG_CONF.ERROR_GENERATE_PRIMITIVEOBJ, '球', 'radius', radius.toString());
      throw new Error(message);
    }

    // オブジェクト生成
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      side: THREE.DoubleSide,
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(position);
    sphere.visible = visible;

    // シーンへ追加
    this.sceneObj.add(sphere);

    // 表示情報の保持
    this.objectIds.add(sphere.id);
    this.primitiveObjects.set(sphere.id, {
      object: sphere,
      groupId: groupId,
      type: PRIMITIVE_TYPE.SPHERE,
      position: position,
      visible: visible,
    });

    Logging.info(LOG_CONF.INFO_CREATE_PRIMITE_SPHERE, groupId, sphere.id.toString());

    return sphere.id;
  }

  /**
   * 三角錐のプリミティブオブジェクトを生成し、オブジェクト表示シーンに追加する。
   * @param groupId オブジェクトのグループID
   * @param position 三角錐の中心座標
   * @param roll 三角錐の姿勢のRoll要素
   * @param pitch 三角錐の姿勢のPitch要素
   * @param yaw 三角錐の姿勢のYaw要素
   * @param width 三角錐の底面の1辺の長さ
   * @param height 三角錐の高さ
   * @param color 三角錐の色
   * @param visible オブジェクトの可視/不可視設定(true：可視、false：不可視)
   * @retruns オブジェクトID
   * @throws 異常パラメータ
   */
  public addPrimitiveTrigonalPyramids(
    groupId: string,
    position: THREE.Vector3,
    roll: number,
    pitch: number,
    yaw: number,
    width: number,
    height: number,
    color: THREE.Color,
    visible: boolean,
  ): number {
    // パラメータチェック
    if (width <= 0) {
      const message = Logging.error(LOG_CONF.ERROR_GENERATE_PRIMITIVEOBJ, '三角錐', 'width', width.toString());
      throw new Error(message);
    }
    if (height <= 0) {
      const message = Logging.error(LOG_CONF.ERROR_GENERATE_PRIMITIVEOBJ, '三角錐', 'height', height.toString());
      throw new Error(message);
    }

    // オブジェクト生成
    const radius = (width / 2) * (1 / Math.cos(THREE.MathUtils.degToRad(30.0)));
    const geometry = new THREE.CylinderGeometry(0, radius, height, 3, 1);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      side: THREE.DoubleSide,
    });
    const trigonalPyramids = new THREE.Mesh(geometry, material);
    trigonalPyramids.visible = visible;

    // オブジェクト位置回転変換
    const matrix = ViewUtil.getTranslationMatrix(position, roll, pitch, yaw);
    trigonalPyramids.matrix = matrix;
    trigonalPyramids.matrixAutoUpdate = false;

    // シーンへ追加
    this.sceneObj.add(trigonalPyramids);

    // 表示情報の保持
    this.objectIds.add(trigonalPyramids.id);
    this.primitiveObjects.set(trigonalPyramids.id, {
      object: trigonalPyramids,
      groupId: groupId,
      type: PRIMITIVE_TYPE.TRIGONAL_PYRAMIDS,
      position: position,
      visible: visible,
    });

    Logging.info(LOG_CONF.INFO_CREATE_PRIMITE_TRIGONAL_PYRAMIDS, groupId, trigonalPyramids.id.toString());

    return trigonalPyramids.id;
  }

  /**
   * 四角錐のプリミティブオブジェクトを生成し、オブジェクト表示シーンに追加する。
   * @param groupId オブジェクトのグループID
   * @param position 四角錐の中心座標
   * @param roll 四角錐の姿勢のRoll要素
   * @param pitch 四角錐の姿勢のPitch要素
   * @param yaw 四角錐の姿勢のYaw要素
   * @param width 四角錐の底面の1辺の長さ
   * @param height 四角錐の高さ
   * @param color 四角錐の色
   * @param visible オブジェクトの可視/不可視設定(true：可視、false：不可視)
   * @retruns オブジェクトID
   * @throws 異常パラメータ
   */
  public addPrimitiveSquarePyramids(
    groupId: string,
    position: THREE.Vector3,
    roll: number,
    pitch: number,
    yaw: number,
    width: number,
    height: number,
    color: THREE.Color,
    visible: boolean,
  ): number {
    // パラメータチェック
    if (width <= 0) {
      const message = Logging.error(LOG_CONF.ERROR_GENERATE_PRIMITIVEOBJ, '四角錐', 'width', width.toString());
      throw new Error(message);
    }
    if (height <= 0) {
      const message = Logging.error(LOG_CONF.ERROR_GENERATE_PRIMITIVEOBJ, '四角錐', 'height', height.toString());
      throw new Error(message);
    }

    // オブジェクト生成
    const radius = (width / 2) * (1 / Math.cos(THREE.MathUtils.degToRad(45.0)));
    const geometry = new THREE.CylinderGeometry(0, radius, height, 4, 1);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      side: THREE.DoubleSide,
    });
    const squarePyramids = new THREE.Mesh(geometry, material);
    squarePyramids.visible = visible;

    // オブジェクト位置回転変換
    const matrix = ViewUtil.getTranslationMatrix(position, roll, pitch, yaw);
    squarePyramids.matrix = matrix;
    squarePyramids.matrixAutoUpdate = false;

    // シーンへ追加
    this.sceneObj.add(squarePyramids);

    // 表示情報の保持
    this.objectIds.add(squarePyramids.id);
    this.primitiveObjects.set(squarePyramids.id, {
      object: squarePyramids,
      groupId: groupId,
      type: PRIMITIVE_TYPE.SQUARE_PYRAMIDS,
      position: position,
      visible: visible,
    });

    Logging.info(LOG_CONF.INFO_CREATE_PRIMITE_SQUARE_PYRAMIDS, groupId, squarePyramids.id.toString());

    return squarePyramids.id;
  }

  /**
   * 正八面体のプリミティブオブジェクトを生成し、オブジェクト表示シーンに追加する。
   * @param groupId オブジェクトのグループID
   * @param position 正八面体の中心座標
   * @param roll 正八面体の姿勢のRoll要素
   * @param pitch 正八面体の姿勢のPitch要素
   * @param yaw 正八面体の姿勢のYaw要素
   * @param width 正八面体の1辺の長さ
   * @param color 正八面体の色
   * @param visible オブジェクトの可視/不可視設定(true：可視、false：不可視)
   * @retruns オブジェクトID
   * @throws 異常パラメータ
   */
  public addPrimitiveRegularOctahedron(
    groupId: string,
    position: THREE.Vector3,
    roll: number,
    pitch: number,
    yaw: number,
    width: number,
    color: THREE.Color,
    visible: boolean,
  ): number {
    // パラメータチェック
    if (width <= 0) {
      const message = Logging.error(LOG_CONF.ERROR_GENERATE_PRIMITIVEOBJ, '正八面体', 'width', width.toString());
      throw new Error(message);
    }

    // オブジェクト生成
    const radius = width / Math.sqrt(2.0);
    const geometry = new THREE.OctahedronGeometry(radius, 0);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      side: THREE.DoubleSide,
    });
    const regularOctahedron = new THREE.Mesh(geometry, material);
    regularOctahedron.visible = visible;

    // オブジェクト位置回転変換
    const matrix = ViewUtil.getTranslationMatrix(position, roll, pitch, yaw);
    regularOctahedron.matrix = matrix;
    regularOctahedron.matrixAutoUpdate = false;

    // シーンへ追加
    this.sceneObj.add(regularOctahedron);

    // 表示情報の保持
    this.objectIds.add(regularOctahedron.id);
    this.primitiveObjects.set(regularOctahedron.id, {
      object: regularOctahedron,
      groupId: groupId,
      type: PRIMITIVE_TYPE.REGULAR_OCTAHEDRON,
      position: position,
      visible: visible,
    });

    Logging.info(LOG_CONF.INFO_CREATE_PRIMITE_REGULAR_OCTAHEDRON, groupId, regularOctahedron.id.toString());

    return regularOctahedron.id;
  }

  /**
   * 指定した種別またはすべてのプリミティブオブジェクトのオブジェクトを可視にする
   * @param type オブジェクト種別(0：球、1：三角錐、2：四角錐、3：正八面体)
   * @throws 指定可能なオブジェクト種別以外の数値を設定
   */
  public setAllPrimitiveVisible(type?: number): void {
    if (undefined !== type) {
      // 指定した種別のプリミティブオブジェクトを対象
      const types: number[] = Object.values(PRIMITIVE_TYPE);
      if (types.includes(type)) {
        for (const [objId, objInfo] of this.primitiveObjects) {
          if (objInfo.type === type) {
            this.setObjectVisible(objId);
          }
        }
      } else {
        const message = Logging.error(LOG_CONF.ERROR_VISIBLE_PRIMITIVE, type.toString());
        throw new Error(message);
      }
      Logging.info(LOG_CONF.INFO_VISIBLE_ALL_PRIMITIVE_OBJECT, type.toString());
    } else {
      // すべてのプリミティブオブジェクトを対象
      for (const objId of this.primitiveObjects.keys()) {
        this.setObjectVisible(objId);
      }
      Logging.info(LOG_CONF.INFO_VISIBLE_ALL_PRIMITIVE_OBJECT, '-');
    }
  }

  /**
   * 指定した種別またはすべてのプリミティブオブジェクトのオブジェクトを不可視にする
   * @param type オブジェクト種別(0：球、1：三角錐、2：四角錐、3：正八面体)
   * @throws 指定可能なオブジェクト種別以外の数値を設定
   */
  public setAllPrimitiveInvisible(type?: number): void {
    if (undefined !== type) {
      // 指定した種別のプリミティブオブジェクトを対象
      const types: number[] = Object.values(PRIMITIVE_TYPE);
      if (types.includes(type)) {
        for (const [objId, objInfo] of this.primitiveObjects) {
          if (objInfo.type === type) {
            this.setObjectInvisible(objId);
          }
        }
      } else {
        const message = Logging.error(LOG_CONF.ERROR_INVISIBLE_PRIMITIVE, type.toString());
        throw new Error(message);
      }
      Logging.info(LOG_CONF.INFO_INVISIBLE_ALL_PRIMITIVE_OBJECT, type.toString());
    } else {
      // すべてのプリミティブオブジェクトを対象
      for (const objId of this.primitiveObjects.keys()) {
        this.setObjectInvisible(objId);
      }
      Logging.info(LOG_CONF.INFO_VISIBLE_ALL_PRIMITIVE_OBJECT, '-');
    }
  }

  /**
   * 指定した種別またはすべてのプリミティブオブジェクトをシーンから削除する
   * @param type オブジェクト種別(0：球、1：三角錐、2：四角錐、3：正八面体)
   * @throws 指定可能なオブジェクト種別以外の数値を設定
   */
  public removeAllPrimitive(type?: number): void {
    if (undefined !== type) {
      // 指定した種別のプリミティブオブジェクトを対象
      const types: number[] = Object.values(PRIMITIVE_TYPE);
      if (types.includes(type)) {
        for (const [objId, objInfo] of this.primitiveObjects) {
          if (objInfo.type === type) {
            this.removeObject(objId);
          }
        }
      } else {
        const message = Logging.error(LOG_CONF.ERROR_REMOVE_PRIMITIVE, type.toString());
        throw new Error(message);
      }

      Logging.info(LOG_CONF.INFO_REMOVE_ALL_PRIMITIVE_OBJECT, type.toString());
    } else {
      // すべてのプリミティブオブジェクトを対象
      for (const objId of this.primitiveObjects.keys()) {
        this.removeObject(objId);
      }
      Logging.info(LOG_CONF.INFO_REMOVE_ALL_PRIMITIVE_OBJECT, '-');
    }
  }

  /************************************************************************************/
  // 座標軸表示
  /************************************************************************************/

  /**
   * 座標軸を指定した位置で可視にする。
   * @param position 座標軸の表示位置(0：左上、1：左下、2：右下、3：右上)
   * @throws 設定可能以外の数値を設定
   */
  public setAxisVisible(position: number): void {
    const positions: number[] = Object.values(OVERLAY_SCENE_POSITION);
    if (positions.includes(position)) {
      this.overlayPosition = position;
      this.axis.visible = true;
      Logging.info(LOG_CONF.INFO_VISIBLE_AXIS, position.toString());
    } else {
      const message = Logging.error(LOG_CONF.ERROR_VISIBLE_AXIS, position.toString());
      throw new Error(message);
    }
  }

  /**
   * 座標軸を不可視にする。
   */
  public setAxisInvisible(): void {
    this.axis.visible = false;
    Logging.info(LOG_CONF.INFO_INVISIBLE_AXIS);
  }

  /************************************************************************************/
  // オブジェクト生成
  /************************************************************************************/

  /**
   * オブジェクトをオブジェクト表示シーンに追加する
   * @param object 追加対象オブジェクト
   */
  public addObject3D(object: THREE.Object3D): void {
    this.sceneObj.add(object);
  }

  /**
   * オブジェクトをオブジェクト表示シーンから削除する
   * @param object 削除対象オブジェクト
   */
  public removeObject3D(object: THREE.Object3D): void {
    this.sceneObj.remove(object);
  }

  /**
   * 点のオブジェクトを生成し、オブジェクト表示シーンに追加する
   * @param position 点の座標
   * @param color 点の色
   * @param opacity 点の透明度
   * @param size 点のサイズ
   * @param sizeAttenuation 点サイズ変更有無
   * @returns 点オブジェクト
   */
  public addPointObject(
    position: THREE.Vector3,
    color: THREE.Color,
    opacity: number,
    size: number,
    sizeAttenuation: boolean,
  ): THREE.Points {
    // オブジェクト生成
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([position.x, position.y, position.z]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const material = new THREE.PointsMaterial({
      color: color,
      opacity: opacity,
      transparent: opacity < 1.0,
      size: size,
      sizeAttenuation: sizeAttenuation,
    });
    const points = new THREE.Points(geometry, material);

    this.sceneObj.add(points);

    Logging.debug(LOG_CONF.DEBUG_ADD_POINT_OBJECT, points.id.toString());

    return points;
  }

  /**
   * 点オブジェクトをオブジェクト表示シーンから削除する
   * @param points 点オブジェクト
   */
  public removePointObject(points: THREE.Points): void {
    this.sceneObj.remove(points);
    this.removeGeometry(points.geometry);
    this.removeMaterial(points.material);
    Logging.debug(LOG_CONF.DEBUG_REMOVE_POINT_OBJECT, points.id.toString());
  }

  /**
   * 線オブジェクトを生成し、オブジェクト表示シーンに追加する
   * @param position 線の座標
   * @param color 線の色
   * @param opacity 線の透明度
   * @returns 線オブジェクト
   */
  public addLineObject(position: THREE.Vector3[], color: THREE.Color, opacity: number): THREE.Line {
    // オブジェクト生成
    const geometry = new THREE.BufferGeometry().setFromPoints(position);
    const material = new THREE.LineBasicMaterial({
      color: color,
      opacity: opacity,
      transparent: opacity < 1.0,
    });
    const line = new THREE.Line(geometry, material);

    this.sceneObj.add(line);

    Logging.debug(LOG_CONF.DEBUG_ADD_LINE_OBJECT, line.id.toString());

    return line;
  }

  /**
   * 線オブジェクトをオブジェクト表示シーンから削除する
   * @param line 線オブジェクト
   */
  public removeLineObject(line: THREE.Line): void {
    this.sceneObj.remove(line);
    this.removeGeometry(line.geometry);
    this.removeMaterial(line.material);
    Logging.debug(LOG_CONF.DEBUG_REMOVE_LINE_OBJECT, line.id.toString());
  }

  /**
   * スプライトオブジェクトをオブジェクト表示シーンから削除する
   * @param sprite スプライトオブジェクト
   */
  public removeSpriteObject(sprite: THREE.Sprite): void {
    this.sceneObj.remove(sprite);
    this.removeGeometry(sprite.geometry);
    this.removeMaterial(sprite.material);
    Logging.debug(LOG_CONF.DEBUG_REMOVE_SPRITE_OBJECT, sprite.id.toString());
  }

  /**
   * 陰がつかない均一な塗りつぶしのオブジェクトを生成し、オブジェクト表示シーンに追加する
   * @param position オブジェクトの座標
   * @param quaternion オブジェクトの回転(クォータニオン)
   * @param geometry ジオメトリの定義
   * @param color オブジェクトの色
   * @param opacity オブジェクトの透明度
   * @param side マテリアルの両面表示有無
   * @param texture オブジェクトのテクスチャ
   * @returns 生成オブジェクト
   */
  public addBasicMaterialObject(
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
    geometry: THREE.BufferGeometry,
    color: THREE.Color,
    opacity: number,
    side: THREE.Side,
    texture?: THREE.Texture,
  ): THREE.Mesh {
    // オブジェクト生成
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: color,
        opacity: opacity,
        transparent: opacity < 1.0,
        map: texture ? texture : null,
        side: side,
      }),
    );

    // 状態の設定
    mesh.position.copy(position);
    mesh.quaternion.copy(quaternion);

    this.sceneObj.add(mesh);

    Logging.debug(LOG_CONF.DEBUG_ADD_BASIC_MATERIAL_OBJECT, mesh.id.toString());

    return mesh;
  }

  /**
   * ワイヤーフレームのメッシュオブジェクトを生成し、オブジェクト表示シーンに追加する
   * @param position オブジェクトの座標
   * @param quaternion オブジェクトの回転(クォータニオン)
   * @param geometry ジオメトリの定義
   * @param color オブジェクトの色
   * @param opacity オブジェクトの透明度
   * @param wireframeLinewidth オブジェクトのワイヤーフレームのフレームの太さ
   * @returns 生成オブジェクト
   */
  public addWireframeMeshObject(
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
    geometry: THREE.BufferGeometry,
    color: THREE.Color,
    opacity: number,
    wireframeLinewidth: number,
  ): THREE.Mesh {
    // オブジェクト生成
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: color,
        opacity: opacity,
        transparent: opacity < 1.0,
        wireframe: true,
        wireframeLinewidth: wireframeLinewidth,
      }),
    );

    // 状態の設定
    mesh.position.copy(position);
    mesh.quaternion.copy(quaternion);

    this.sceneObj.add(mesh);

    Logging.debug(LOG_CONF.DEBUG_ADD_WIREFRAME_OBJECT, mesh.id.toString());

    return mesh;
  }

  /**
   * メッシュオブジェクトをオブジェクト表示シーンから削除する
   */
  public removeMeshObject(mesh: THREE.Mesh): void {
    this.sceneObj.remove(mesh);
    this.removeGeometry(mesh.geometry);
    this.removeMaterial(mesh.material);
    Logging.debug(LOG_CONF.DEBUG_REMOVE_MESH_OBJECT, mesh.id.toString());
  }
}
