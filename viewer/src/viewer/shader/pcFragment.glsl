/**
 * @fileoverview フラグメントシェーダ処理の定義
 * @author Kota Kubota(SEQ)
 * @created 2025/05/19
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

// 定数定義
const float PI = 3.141592653589793;

// カラーインデックス定数
#define COLOR_INDEX1 1
#define COLOR_INDEX2 2
#define COLOR_INDEX3 3

// カラーモード定数
#define COLOR_MODE_RGB 0
#define COLOR_MODE_INDEX 1
#define COLOR_MODE_MIX 2
#define COLOR_MODE_INTENSITY 3

// 範囲選択タイプ定数
#define RANGE_SELECT_TYPE_BOX 0
#define RANGE_SELECT_TYPE_CYLINDER 1
#define RANGE_SELECT_TYPE_SPHERE 2

// varying変数
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vColor;
varying vec3 vLutIndex;
flat varying int vIntensity;

// uniform変数
// 表示色変更
uniform int colorMode;
uniform int colorIndexNo;
uniform sampler2D lut;
uniform vec4 selectedColor;

// γ値
uniform float gammaValue;

// 範囲選択
uniform int rsType;
uniform mat4 rangeSelectionMatrix;
uniform float thetaLength;

/**
 * ガンマ値を使用して入力値にガンマ変換を適用する。
 * @param value 変換対象値
 * @param gammaFactor ガンマ値
 * @returns ガンマ補正結果
 */
vec4 linearToGamma( in vec4 value, in float gammaFactor ) {
  return vec4( pow( value.xyz, vec3( 1.0 / gammaFactor ) ), value.w );
}

/**
 * 指定した浮動小数点数に対する剰余演算結果を取得する。
 * @param x 被除数
 * @param y 除数
 * @returns 剰余演算結果
 */
float fmodglsl(float x, float y) {
  return x - y * floor(x / y);
}

/**
 * 原点から指定座標までの半直線と、正のx軸の間の平面上での角度を取得する。
 * @param y 点のy座標
 * @param x 点のx座標
 * @returns 計算結果の角度（単位：ラジアン）
 */
float atan2(in float y, in float x) {
  return (x == 0.0) ? (sign(y) * PI/2.0) : (atan(y, x));
}

/**
 * 表示色変更がIndexの場合、指定インデックスのインデックス番号(整数値)を取得する。
 * @returns インデックス番号
 */
int getColorIndex() {
  int index = -1;
  switch(colorIndexNo) {
    case COLOR_INDEX1:
      index = int(vLutIndex.x);
      break;
    case COLOR_INDEX2:
      index = int(vLutIndex.y);
      break;
    case COLOR_INDEX3:
      index = int(vLutIndex.z);
      break;
    default:
      index = -1;
      break;
  }

  return index;
}

/**
 * 表示色変更の設定に応じた色情報を取得する。
 * @returns 色情報
 */
vec4 getColorVec() {
  // 定数
  const float COLOR_MAX = 65535.0;
  const float INTENSITY_MAX = 65535.0;

  // カラーインデックス取得・変換
  int colorIndex = getColorIndex();
  float index = float(colorIndex) / 255.0;


  vec4 colorVec;
  switch(colorMode) {
    case COLOR_MODE_RGB:
      colorVec = vec4(vColor / COLOR_MAX, 1.0);
      break;
    case COLOR_MODE_INDEX:
      colorVec = texture2D(lut, vec2(index, 0.0)); 
      break;
    case COLOR_MODE_MIX:
      if (colorIndex == 0) {
        // 0の場合はRGB値で表示
        colorVec = vec4(vColor / COLOR_MAX, 1.0);
      } else {
        // 0以外の場合はLUTで表示
        colorVec = texture2D(lut, vec2(index, 0.0)); 
      }
      break;
    case COLOR_MODE_INTENSITY:
      colorVec = vec4(float(vIntensity) / INTENSITY_MAX, float(vIntensity) / INTENSITY_MAX, float(vIntensity) / INTENSITY_MAX, 1.0);
      break;
    default:
      colorVec = vec4(vColor / COLOR_MAX, 1.0);
      break;
  }

  return colorVec;
}

/**
 * 点の座標が範囲選択のオブジェクトの内部に存在するか判定する。
 * @returns 内外判定結果
 */
bool isInsideRangeShape() {
  bool inside = false;    // 内外判定結果
  float distance = 0.0;   // 判定用距離
  vec4 clipPosition = rangeSelectionMatrix * vec4( vPosition, 1.0 );

  switch (rsType) {
    case RANGE_SELECT_TYPE_BOX:
      inside = -0.5 <= clipPosition.x && clipPosition.x <= 0.5;
      inside = inside && -0.5 <= clipPosition.y && clipPosition.y <= 0.5;
      inside = inside && -0.5 <= clipPosition.z && clipPosition.z <= 0.5;
      break;
    case RANGE_SELECT_TYPE_CYLINDER:
      float angle = 0.0;
      // 高さ
      inside = -0.5 <= clipPosition.y && clipPosition.y <= 0.5;
      // 半径
      distance = pow(clipPosition.x, 2.0) + pow(clipPosition.z, 2.0);
      distance = sqrt(distance);
      inside = inside && (distance <= 1.0);
      // 扇形
      angle = atan2(clipPosition.x ,clipPosition.z);
      angle = fmodglsl(angle, PI * 2.0);
      inside = inside && (angle <= thetaLength);
      break;
    case RANGE_SELECT_TYPE_SPHERE:
      distance = pow(clipPosition.x, 2.0) + pow(clipPosition.y, 2.0) + pow(clipPosition.z, 2.0);
      distance = sqrt(distance);
      inside = (distance <= 1.0);
      break;
    default:
      // 範囲選択種別が上記以外の場合は、常に外側とする
      break;
  }

  return inside;
}

/**
 * フラグメントシェーダのメイン処理
 */
void main() {
    
  // 表示色取得
  vec4 colorVec = getColorVec();
  
  // 範囲選択判定(NONE(-1)の場合は内外判定処理をしない)
  bool inside = false;
  if (0 <= rsType) {
    inside = isInsideRangeShape();
  }

  // 色設定
  if (inside) {
    gl_FragColor = vec4(selectedColor);
  } else {
    gl_FragColor = linearToGamma( colorVec, gammaValue );
  }
}
