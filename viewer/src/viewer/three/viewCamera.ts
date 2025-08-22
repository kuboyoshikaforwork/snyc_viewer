/**
 * @fileoverview 3D空間のカメラを提供するクラスの定義
 * @author Kota Kubota(SEQ)
 * @created 2025/05/02
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import * as THREE from 'three';
import {Intersection, Object3D} from 'three';
import {COPCConf} from '../conf/copcConf';
import {Logging} from '../log/logging';
import {LOG_CONF} from '../log/logConf';

/**
 * 3D空間のカメラを提供するクラス
 */
export class ViewCamera {
  /** 3D空間を表示するHTML要素 */
  private container: HTMLElement;

  /** 3D空間の透視撮影カメラ */
  private camera: THREE.PerspectiveCamera;
  /** オーバーレイシーン用カメラ */
  private overlayCamera: THREE.OrthographicCamera;

  /** レイキャスタオブジェクト */
  private raycaster: THREE.Raycaster;

  /**
   * 3D空間のカメラを生成する
   * @param container 3D空間を表示するHTML要素
   * @param yAxisUp Y軸Z軸上方向設定(true：Y軸上方向、false：Z軸上方向)
   */
  constructor(container: HTMLElement, yAxisUp: boolean) {
    // コンテナ
    this.container = container;

    // 透視投影カメラ
    this.camera = new THREE.PerspectiveCamera(
      COPCConf.conf.PERS_FOV,
      container.clientWidth / container.clientHeight,
      COPCConf.conf.PERS_NEAR,
      COPCConf.conf.PERS_FAR,
    );
    this.camera.position.set(0.0, 0.0, 0.0);

    // 上方向設定
    if (yAxisUp) {
      this.camera.up.set(0.0, 1.0, 0.0);
    } else {
      this.camera.up.set(0.0, 0.0, 1.0);
    }

    // オーバレイ用カメラ
    this.overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.overlayCamera.position.z = 5;

    // レイキャスタ初期設定(threshold：3D空間上の距離)
    this.raycaster = new THREE.Raycaster();
    const raycasterParams: THREE.RaycasterParameters = {
      Mesh: {},
      Line: {threshold: COPCConf.conf.RAYCASTER_POINT_THRESHOLD},
      LOD: {},
      Points: {threshold: COPCConf.conf.RAYCASTER_POINT_THRESHOLD},
      Sprite: {},
    };
    this.raycaster.params = raycasterParams;
    this.raycaster.near = this.camera.near;
    this.raycaster.far = this.camera.far;

    // 設定値反映
    this.camera.fov = COPCConf.conf.PERS_FOV;
    this.camera.near = COPCConf.conf.PERS_NEAR;
    this.camera.far = COPCConf.conf.PERS_FAR;
    this.raycaster.params.Points.threshold = COPCConf.conf.RAYCASTER_POINT_THRESHOLD;
    this.raycaster.near = this.camera.near;
    this.raycaster.far = this.camera.far;
  }

  /**
   * 設定値反映処理
   */
  public applyConfig(): void {
    // カメラオブジェクト
    this.camera.fov = COPCConf.conf.PERS_FOV;
    this.camera.near = COPCConf.conf.PERS_NEAR;
    this.camera.far = COPCConf.conf.PERS_FAR;

    // レイキャスタ
    this.raycaster.params.Points.threshold = COPCConf.conf.RAYCASTER_POINT_THRESHOLD;
    this.raycaster.near = this.camera.near;
    this.raycaster.far = this.camera.far;
  }

  /**
   * 透視投影カメラオブジェクトの取得
   * @returns 透視投影カメラオブジェクト
   */
  public get(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * オーバーレイシーン用カメラオブジェクトの取得
   * @returns オーバーレイシーン用カメラオブジェクト
   */
  public getOverlay(): THREE.OrthographicCamera {
    return this.overlayCamera;
  }

  /**
   * HTML要素のサイズに併せてカメラの状態(アスペクト比)を更新
   */
  public update(): void {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
  }

  /**
   * カメラの視野角を設定する
   * @param fov カメラの視野角
   */
  public setFov(fov: number): void {
    this.camera.fov = fov;
    Logging.trace(LOG_CONF.TRACE_SET_CAMERA_FOV, fov.toString());
  }

  /**
   * カメラの視野角を取得する
   * @returns カメラの視野角
   */
  public getFov(): number {
    return this.camera.fov;
  }

  /**
   * カメラの近方の視錐台を取得する
   * @returns カメラの近方の視錐台
   */
  public getNearFrustum(): number {
    return this.camera.near;
  }

  /**
   * カメラの遠方の視錐台を取得する
   * @returns カメラの遠方の視錐台
   */
  public getFarFrustum(): number {
    return this.camera.far;
  }

  /**
   * カメラの変換行列を取得する
   * @returns カメラ変換行列
   */
  public getMatrixElem(): THREE.Matrix4Tuple {
    return this.camera.matrix.elements;
  }

  /**
   * 3D座標をNDC(正規化デバイス)座標に変換する
   * @param world 変換対象の3D座標
   * @returns NDC(正規化デバイス)座標
   */
  public world2NDC(world: THREE.Vector3): THREE.Vector3 {
    const tmp: THREE.Vector3 = new THREE.Vector3().copy(world);
    const ndc: THREE.Vector3 = tmp.project(this.camera);
    return ndc;
  }

  /**
   * 2D座標をNDC(正規化デバイス)座標に変換する
   * @param screen 変換対象の2D座標
   * @returns NDC(正規化デバイス)座標
   */
  public screen2NDC(screen: THREE.Vector2): THREE.Vector2 {
    const containerRect = this.container.getBoundingClientRect();
    const ndc = new THREE.Vector2();
    ndc.x = ((screen.x - containerRect.left) / containerRect.width) * 2 - 1;
    ndc.y = -((screen.y - containerRect.top) / containerRect.height) * 2 + 1;
    return ndc;
  }

  /**
   * 指定したシーンの2D座標上に存在するオブジェクトを取得する。
   * オブジェクト内部にカメラが存在すると当該オブジェクトは取得できない
   * @param scene 3D空間のシーン
   * @param position 2D座標(スクリーンの座標)
   * @param onlyVisible 取得対象を表示中のオブジェクトのみにするか否か(true：表示中のみ、false：非表示含む)
   * @param recursive 取得対象にオブジェクトの子要素も含めるか否か(true：含める、false：含めない)
   * @returns オブジェクト一覧
   */
  public getIntersectObject(
    scene: THREE.Scene,
    position: THREE.Vector2,
    onlyVisible: boolean,
    recursive: boolean,
  ): Intersection<Object3D>[] {
    // スクリーン座標をNDC座標に変換
    const ndc = this.screen2NDC(position);

    // 指定位置からまっすぐに伸びる光線ベクトル上のオブジェクトを取得
    this.raycaster.setFromCamera(ndc, this.camera);
    let intersects = this.raycaster.intersectObjects(scene.children, recursive);
    Logging.trace(LOG_CONF.TRACE_GET_OBJECTS_AT_NDC, ndc.x.toString(), ndc.y.toString(), intersects.length.toString());

    // 表示中オブジェクトのみ対象
    if (onlyVisible) {
      intersects = intersects.filter(intersect => intersect.object.visible);
    }

    return intersects;
  }

  /**
   * 指定した2D座標上と平面の交点の座標を取得する
   * @param screen 2D座標(スクリーンの座標)
   * @param plane 3D空間の平面
   * @returns 交点座標
   */
  public getIntersectPlane(screen: THREE.Vector2, plane: THREE.Plane): THREE.Vector3 {
    // スクリーン座標をNDC座標に変換
    const ndc = this.screen2NDC(screen);

    this.raycaster.setFromCamera(ndc, this.camera);
    const intersection = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, intersection);

    return intersection;
  }

  /**
   * 指定した3D座標位置における単位メートル辺りのピクセル数を取得する
   * @param position 基準3D座標
   * @returns ピクセル数
   */
  public getPixelPerMeter(position: THREE.Vector3): number {
    const height = this.container.clientHeight;
    const viewMatrix = this.camera.matrixWorldInverse;

    // カメラ座標系でのオブジェクト位置
    const glCoord = position.clone().applyMatrix4(viewMatrix);

    // 1mあたりのpx数
    const objPix = height / (2 * glCoord.z * Math.tan(((this.getFov() / 2) * Math.PI) / 180.0));

    return Math.abs(objPix);
  }

  /**
   * 指定したオブジェクトのバウンディングボックスがカメラの視錐台の内部に存在するか判定する
   * @param object オブジェクト
   * @returns 存在有無(true：内部に存在、false：外部に存在)
   */
  public isBbExistInView(object: Object3D): boolean {
    // Bounding Box取得
    const boundingBox = new THREE.Box3().setFromObject(object);

    // カメラの視錐台を更新
    const frustum = new THREE.Frustum();
    const cameraViewProjectionMatrix = new THREE.Matrix4();

    // カメラのワールド行列を更新
    this.camera.updateMatrixWorld();
    cameraViewProjectionMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(cameraViewProjectionMatrix);

    // 境界ボックスが視錐台内に存在するかどうかを判定
    const existInView = frustum.intersectsBox(boundingBox);

    return existInView;
  }
}
