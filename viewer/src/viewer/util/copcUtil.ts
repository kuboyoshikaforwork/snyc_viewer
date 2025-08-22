/**
 * @fileoverview 点群系ビューアのユーティリティクラスの定義
 * @author Kota Kubota(SEQ)
 * @created 2025/05/01
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import * as THREE from 'three';
import {ViewUtil} from './viewUtil';

/**
 * 点群系ビューアユーティリティクラス
 */
export class COPCUtil extends ViewUtil {
  /**
   * 変換対象数値を指定した有効小数点桁数の数値に変換し、単位文字列を連結した文字列を取得する。
   * @param value 変換対象数値
   * @param precision 有効小数点桁数(0以下の場合は整数値に変換)
   * @param unit 単位文字列
   * @returns 単位付き数値文字列
   */
  static getUnitValue(value: number, precision: number, unit: string): string {
    // 小数点有効桁数が負の場合は整数表示
    if (precision < 0) {
      precision = 0;
    }

    const ret = value.toFixed(precision).toString() + ' ' + unit;

    return ret;
  }

  /**
   * 指定した浮動小数点数に対する剰余演算結果を取得する
   * @param x 被除数
   * @param y 除数
   * @returns 剰余演算結果(計算異常（0除算等）が発生した場合はNanが返る)
   */
  static fmod(x: number, y: number): number {
    return x - y * Math.floor(x / y);
  }

  /**
   * 円柱のオブジェクトの形状を変更する
   * @param cylinder 円柱オブジェクト
   * @param thetaStart 円柱の円周の開始位置
   * @param thetaLength 円柱の円周の角度
   */
  static updateCylinderGeometry(cylinder: THREE.Mesh, thetaStart: number, thetaLength: number): void {
    if (cylinder.geometry instanceof THREE.CylinderGeometry) {
      // ジオメトリの再生成
      const parameters = cylinder.geometry.parameters;
      cylinder.geometry.dispose();
      cylinder.geometry = new THREE.CylinderGeometry(
        parameters.radiusTop,
        parameters.radiusBottom,
        parameters.height,
        parameters.radialSegments,
        parameters.heightSegments,
        parameters.openEnded,
        COPCUtil.normalizeRadian(thetaStart),
        COPCUtil.normalizeRadian(thetaLength),
      );
    }
  }

  /**
   * 角度(ラジアン)が-2π～2πの範囲になるように変換する
   * @param radian 変換対象角度
   * @return 変換結果の角度(-2π～2π)
   */
  static normalizeRadian(radian: number): number {
    // 角度の法数
    const MAX_RADIAN = Math.PI * 2;

    // 2πの倍数であれば2πに変換
    if (radian % MAX_RADIAN === 0 && radian !== 0) {
      radian = Math.sign(radian) * MAX_RADIAN;
    } else {
      radian = radian % MAX_RADIAN;
    }

    return radian;
  }
}
