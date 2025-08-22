/**
 * @fileoverview モデル系ビューアのユーティリティクラスの定義
 * @author Kota Kubota(SEQ)
 * @created 2025/05/01
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import * as THREE from 'three';
import {Logging} from '../log/logging';
import {LOG_CONF} from '../log/logConf';

/**
 * モデル系ビューアユーティリティクラス
 */
export class ViewUtil {
  /**
   * 3D空間の2点間の水平方向のユークリッド距離を取得する
   * @param a 1点目の3D座標
   * @param b 2点目の3D座標
   * @param yPlane Y軸Z軸上方向設定(true：Y軸上方向、false：Z軸上方向)
   * @returns 水平方向ユークリッド距離
   */
  static getHorizontalDist(a: THREE.Vector3, b: THREE.Vector3, yAxisUp: boolean): number {
    if (yAxisUp) {
      return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.z - b.z, 2));
    } else {
      return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
    }
  }

  /**
   * 3D空間の2点間の垂直方向のユークリッド距離を取得する
   * @param a 1点目の3D座標
   * @param b 2点目の3D座標
   * @param yPlane Y軸Z軸上方向設定(true：Y軸上方向、false：Z軸上方向)
   * @returns 垂直方向ユークリッド距離
   */
  static getVerticalDist(a: THREE.Vector3, b: THREE.Vector3, yAxisUp: boolean): number {
    if (yAxisUp) {
      return Math.sqrt(Math.pow(a.y - b.y, 2));
    } else {
      return Math.sqrt(Math.pow(a.z - b.z, 2));
    }
  }

  /**
   * 指定した小数点桁数の数値となるように四捨五入した数値を取得する。
   * @param value 変換対象数値
   * @param precision 取得する数値の小数点桁数（0以下の場合は整数値に四捨五入）
   * @returns 四捨五入した数値
   */
  static roundPrecision(value: number, precision: number): number {
    const base = Math.pow(10, precision);
    return Math.round(value * base) / base;
  }

  /**
   * 3Dベクトルを指定した軸の周りで指定した角度だけ回転した結果を取得する
   * @param xyz 変換対象ベクトル
   * @param axis 回転軸
   * @param theta 回転角度（度数）
   * @returns 回転後ベクトル
   */
  static rotateVector(xyz: THREE.Vector3, axis: THREE.Vector3, theta: number): THREE.Vector3 {
    const item1 = xyz.clone().multiplyScalar(Math.cos(theta));
    const item2 = new THREE.Vector3().crossVectors(axis, xyz).multiplyScalar(Math.sin(theta));
    const item3 = axis
      .clone()
      .multiplyScalar(axis.dot(xyz))
      .multiplyScalar(1.0 - Math.cos(theta));

    return item1.add(item2).add(item3);
  }

  /**
   * ファイルのURLまたはファイル情報からテキストファイルデータをロードする。
   * @param file ファイルのURLまたはファイル情報
   * @returns テキストデータ
   */
  static async loadTextFile(file: string | File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof file === 'string') {
        fetch(file)
          .then(response => {
            if (!response.ok) {
              reject();
            }
            return response.text();
          })
          .then(fileContent => {
            resolve(fileContent);
          })
          .catch(() => {
            const message = Logging.error(LOG_CONF.ERROR_LOAD_TEXT_FILE, file);
            reject(new Error(message));
          });
      } else {
        const reader = new FileReader();
        reader.onload = (event: ProgressEvent<FileReader>) => {
          if (event && event.target && event.target.result) {
            const fileContent = event.target.result;
            if (typeof fileContent === 'string') {
              resolve(fileContent);
            } else {
              const message = Logging.error(LOG_CONF.ERROR_READ_TEXT_FILE, file.name);
              reject(new Error(message));
            }
          } else {
            const message = Logging.error(LOG_CONF.ERROR_READ_TEXT_FILE, file.name);
            reject(new Error(message));
          }
        };
        reader.onerror = () => {
          const message = Logging.error(LOG_CONF.ERROR_READ_TEXT_FILE, file.name);
          reject(new Error(message));
        };
        reader.readAsText(file);
      }
    });
  }

  /**
   * ファイルのURLまたはファイル情報からJSONファイルデータをロードする。
   * @param file ファイルのURLまたはファイル情報
   * @returns JSONデータ
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  static async loadJsonFile(file: string | File): Promise<any> {
    return new Promise((resolve, reject) => {
      if (typeof file === 'string') {
        fetch(file)
          .then(response => {
            if (!response.ok) {
              reject();
            }
            return response.json();
          })
          .then(fileContent => {
            resolve(fileContent);
          })
          .catch(() => {
            const message = Logging.error(LOG_CONF.ERROR_LOAD_JSON_FILE, file);
            reject(new Error(message));
          });
      } else {
        const reader = new FileReader();
        reader.onload = (event: ProgressEvent<FileReader>) => {
          if (event && event.target && event.target.result) {
            const fileContent = event.target.result;
            if (typeof fileContent === 'string') {
              const json = JSON.parse(fileContent);
              resolve(json);
            } else {
              const message = Logging.error(LOG_CONF.ERROR_READ_JSON_FILE, file.name);
              reject(new Error(message));
            }
          } else {
            const message = Logging.error(LOG_CONF.ERROR_READ_JSON_FILE, file.name);
            reject(new Error(message));
          }
        };
        reader.onerror = () => {
          const message = Logging.error(LOG_CONF.ERROR_READ_JSON_FILE, file.name);
          reject(new Error(message));
        };
        reader.readAsText(file);
      }
    });
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  /**
   * 引数の値が3D座標のフォーマットの配列になっているか判定する
   * @param coord 判定対象
   * @returns 判定結果(true：正常フォーマット、false：異常フォーマット )
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  static is3DCoordFormatArray(coord: any): boolean {
    // 配列であるか確認
    if (!Array.isArray(coord)) {
      return false;
    }

    // 要素数が3の倍数であるか確認
    if (coord.length !== 3) {
      return false;
    }

    // 各要素が数値であるか確認
    for (let i = 0; i < coord.length; i++) {
      if (typeof coord[i] !== 'number') {
        return false;
      }
    }
    return true;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  /**
   * 引数の値が色情報のフォーマットになっているか判定する
   * @param color 判定対象
   * @returns 判定結果(true：正常フォーマット、false：異常フォーマット )
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  static isColorFormat(color: any): boolean {
    if (!color) {
      return false;
    }
    if (typeof color === 'string') {
      return /^(#|0x)([0-9A-Fa-f]{6})$/.test(color);
    }
    if (typeof color === 'number') {
      return 0x000000 <= color && color <= 0xffffff;
    }

    return false;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  /**
   * 平行移動、回転、スケーリングを組み合わせた変換行列を作成する
   * @param position 平行移動ベクトル
   * @param roll 回転角(ラジアン)
   * @param pitch 回転角(ラジアン)
   * @param yaw 回転角(ラジアン)
   * @param scale スケーリング係数
   * @returns 変換行列
   */
  static getTranslationMatrix(
    position: THREE.Vector3,
    roll: number,
    pitch: number,
    yaw: number,
    scale: number = 1,
  ): THREE.Matrix4 {
    const matrix = new THREE.Matrix4();
    const mTrans = new THREE.Matrix4();
    const mYaw = new THREE.Matrix4();
    const mPitch = new THREE.Matrix4();
    const mRoll = new THREE.Matrix4();
    const mScale = new THREE.Matrix4();

    mTrans.makeTranslation(position.x, position.y, position.z);
    mYaw.makeRotationZ((yaw * Math.PI) / 180);
    mPitch.makeRotationY((pitch * Math.PI) / 180);
    mRoll.makeRotationX((roll * Math.PI) / 180);
    mScale.makeScale(scale, scale, scale);

    matrix.multiply(mTrans);
    matrix.multiply(mYaw);
    matrix.multiply(mPitch);
    matrix.multiply(mRoll);
    matrix.multiply(mScale);

    return matrix;
  }
}
