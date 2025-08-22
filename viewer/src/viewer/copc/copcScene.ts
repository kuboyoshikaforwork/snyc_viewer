/**
 * @fileoverview 3D空間の点群表示のシーンを提供するクラスの定義
 * @author Kota Kubota(SEQ)
 * @created 2025/05/02
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import * as THREE from 'three';
import {Intersection, Object3D} from 'three';

import {ViewCamera} from '../three/viewCamera';
import {ViewRenderer} from '../three/viewRenderer';
import {ViewScene} from '../three/viewScene';
import {COPCConf} from '../conf/copcConf';
import {Logging} from '../log/logging';
import {LOG_CONF} from '../log/logConf';

/**
 * 3D空間の点群表示のシーンを提供するクラス
 * @extends ViewScene
 */
export class COPCScene extends ViewScene {
  /** 3D空間の点群を表示するシーン */
  private scenePoint: THREE.Scene;
  /** 3D空間のノードを表示するシーン */
  private sceneNode: THREE.Scene;

  /**
   * 3D空間のシーンを生成する
   * @param camera 3D空間のカメラオブジェクト
   * @param renderer 3D空間のレンダラーオブジェクト
   */
  constructor(camera: ViewCamera, renderer: ViewRenderer) {
    super(camera, renderer);

    // シーン生成
    this.scenePoint = new THREE.Scene();
    this.sceneNode = new THREE.Scene();

    // 設定値反映
    this.sceneObj.background = null;
    this.scenePoint.background = new THREE.Color(COPCConf.conf.BACKGROUD_COLOR);
  }

  /**
   * 3D空間のシーンオブジェクトに設定ファイルの定義を反映する。
   */
  override applyConfig(): void {
    // XYZ座標軸表示の設定
    this.axis.visible = COPCConf.conf.AXIS_VIEW;
    this.overlayPosition = COPCConf.conf.AXIS_VIEW_POSITION;

    // 背景色設定
    this.sceneObj.background = null;
    this.scenePoint.background = new THREE.Color(COPCConf.conf.BACKGROUD_COLOR);
  }

  /**
   * 点群を表示するシーンにおいて指定した座標上に存在するオブジェクトを取得する。
   * @param screen 2D座標(スクリーンの座標)
   * @returns オブジェクト一覧
   */
  public getIntersectPoints(screen: THREE.Vector2): Intersection<Object3D>[] {
    return this.camera.getIntersectObject(this.scenePoint, screen, true, false);
  }

  /**
   * ノードを表示するシーンにおいて指定した座標上に存在するオブジェクトを取得する。
   * @param screen 2D座標(スクリーンの座標)
   * @returns オブジェクト一覧
   */
  public getIntersectNodes(screen: THREE.Vector2): Intersection<Object3D>[] {
    return this.camera.getIntersectObject(this.sceneNode, screen, false, false);
  }

  /**
   * シーンのレンダリング、座標軸と各オブジェクトの表示状態を更新する
   * @param container 3D空間を表示するHTML要素
   */
  public override update(container: HTMLElement): void {
    // レンダリング
    const rendererObj = this.renderer.get();
    // フレームバッファをクリア
    rendererObj.clear();

    // 点群データシーンをレンダリング
    rendererObj.render(this.scenePoint, this.camera.get());
    // レンダリング情報を保持
    this.renderer.saveRenderingInfo();

    // ノードシーンをレンダリング
    rendererObj.render(this.sceneNode, this.camera.get());
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
   * 点群を表示するシーンに点オブジェクトを追加する
   * @param points シーンに追加する点オブジェクト
   */
  public addPointsScene(points: THREE.Points): void {
    this.scenePoint.add(points);
    Logging.debug(LOG_CONF.DEBUG_ADD_POINT_CLOUD_OBJECT, points.id.toString());
  }

  /**
   * 点群を表示するシーンから点オブジェクトを削除する
   * @param points シーンから削除する点オブジェクト
   */
  public removePointsScene(points: THREE.Points): void {
    this.scenePoint.remove(points);
    this.removeGeometry(points.geometry);
    this.removeMaterial(points.material);
    Logging.debug(LOG_CONF.DEBUG_REMOVE_POINT_CLOUD_OBJECT, points.id.toString());
  }

  /**
   * ノードを表示するシーンにメッシュオブジェクトを追加する
   * @param mesh シーンに追加するメッシュオブジェクト
   */
  public addNodeScene(mesh: THREE.Mesh): void {
    this.sceneNode.add(mesh);
    Logging.debug(LOG_CONF.DEBUG_ADD_NODE_OBJECT, mesh.id.toString());
  }

  /**
   * ノードを表示するシーンからメッシュオブジェクトを削除する
   * @param mesh シーンから削除するメッシュオブジェクト
   */
  public removeNodeScene(mesh: THREE.Mesh): void {
    this.sceneNode.remove(mesh);
    this.removeGeometry(mesh.geometry);
    this.removeMaterial(mesh.material);
    Logging.debug(LOG_CONF.DEBUG_REMOVE_NODE_OBJECT, mesh.id.toString());
  }
}
