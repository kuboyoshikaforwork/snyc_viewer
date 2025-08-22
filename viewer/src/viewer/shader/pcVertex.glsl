/**
 * @fileoverview 頂点シェーダ処理の定義
 * @author Kota Kubota(SEQ)
 * @created 2025/05/19
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

// attribute変数
attribute vec3 color;
attribute vec3 lutIndex;
attribute int intensity;

// varying変数
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vColor;
varying vec3 vLutIndex;
flat varying int vIntensity;

// uniform変数
uniform float pointSize;
uniform bool scalePointSize;
uniform float scale;

/**
 * 頂点シェーダのメイン処理。オブジェクトの頂点の位置と点サイズを決定する。 
 */
void main(void) {
  vUv = uv;
  vPosition = position;
  vColor = color;
  vLutIndex = lutIndex;
  vIntensity = intensity;

  // オブジェクト座標系(ローカル座標系) ⇒ ワールド座標系 ⇒ 視点座標系(カメラから見た座標)
  // modelViewMatrix：modelMatrix(オブジェクト座標⇒ワールド座標) × viewMatrix(ワールド座標⇒視点座標)
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

  // 点サイズ
  if (scalePointSize) {
    gl_PointSize = pointSize * (scale / -mvPosition.z);
  } else {
    gl_PointSize = pointSize;
  }
  
  // 点座標
  // 視点座標系(カメラから見た座標) ⇒ クリップ座標系(xyzを-1〜+1で表す座標系)
  // projectionMatrix：カメラの各種パラメータから3次元を2次元に射影し、クリップ座標系に変換する行列
  gl_Position = projectionMatrix * mvPosition;
}
