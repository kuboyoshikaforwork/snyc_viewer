/**
 * @fileoverview 点群の見た目を管理するクラスの定義
 * @author Kota Kubota(SEQ)
 * @created 2025/05/16
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import * as THREE from 'three';

import {RANGE_SELECT_TYPE} from './pointMeasure';
import {IUniform} from 'three';
import {LOG_CONF} from '../log/logConf';
import {Logging} from '../log/logging';
import {COPCConf} from '../conf/copcConf';

// シェーダ定義
import vertexSource from '../shader/pcVertex.glsl?raw';
import fragmentSource from '../shader/pcFragment.glsl?raw';
import {COPCUtil} from '../util/copcUtil';

/** カラーモード */
export const COLOR_MODE = {
  RGB: 0,
  INDEX: 1,
  MIX: 2,
  INTENSITY: 3,
};
Object.freeze(COLOR_MODE);

/** カラーモードインデックス番号 */
export const COLOR_INDEX_NO = {
  I1: 1,
  I2: 2,
  I3: 3,
};
Object.freeze(COLOR_INDEX_NO);

/**
 * 点群の見た目を管理するクラス
 */
export class PointDef {
  /** 点群のシェーダ処理用の変数情報 */
  private materialUniforms: {[uniform: string]: IUniform} = {
    pointSize: {value: 1.0}, // 点サイズ
    scalePointSize: {value: false}, // 点サイズの自動調整有無
    scale: {value: 1.0}, // 点サイズの自動調整スケール
    selectedColor: {value: new THREE.Vector4(0.0, 1.0, 1.0, 1.0)}, // 選択点の色
    colorMode: {value: COLOR_MODE.RGB}, // 表示色モード
    colorIndexNo: {value: COLOR_INDEX_NO.I1}, // 表示色インデックス番号
    lut: {value: new THREE.DataTexture(new Uint8Array(256 * 4), 256, 1, THREE.RGBAFormat)}, // ルックアップテーブル
    gammaValue: {value: 3.0}, // ガンマ値
    rsType: {value: RANGE_SELECT_TYPE.NONE}, // 範囲選択のオブジェクト種別
    rangeSelectionMatrix: {value: new Float32Array(16)}, // 範囲選択の変換行列
    thetaLength: {value: 2 * Math.PI}, // 範囲選択の円柱の円周の角度
  };

  /** 点群のマテリアル定義 */
  private material = new THREE.ShaderMaterial({
    uniforms: this.materialUniforms,
    vertexShader: vertexSource,
    fragmentShader: fragmentSource,
  });

  /** 3D空間を表示するHTML要素 */
  private container: HTMLElement;

  /**
   * PointDefオブジェクトを生成する。
   * @param container 3D空間を表示するHTML要素
   */
  constructor(container: HTMLElement) {
    this.container = container;

    // 点サイズの自動調整スケール設定
    const scale = this.container.clientHeight / 2.0;
    this.material.uniforms.scale.value = scale;

    // 設定値反映
    this.applyConfig();
  }

  /**
   * 点群のシェーダ処理用の変数に設定ファイルの定義を反映する。
   */
  public applyConfig(): void {
    this.material.uniforms.gammaValue.value = COPCConf.conf.GAMMA_VALUE;
    this.material.uniforms.pointSize.value = COPCConf.conf.POINT_SIZE;
    this.material.uniforms.scalePointSize.value = COPCConf.conf.ADJUSTMENT_POINT_SIZE;
    this.material.uniforms.colorMode.value = COPCConf.conf.COLOR_MODE;
    this.material.uniforms.colorIndexNo.value = COPCConf.conf.COLOR_MODE_INDEX_NO;
    const c = new THREE.Color(COPCConf.conf.SELECT_POINT_COLOR);
    this.material.uniforms.selectedColor.value = new THREE.Vector4(c.r, c.g, c.b, 1.0);
  }

  /**
   * 点群のマテリアル定義を取得する。
   * @returns 点群のマテリアル定義
   */
  public getMaterial(): THREE.ShaderMaterial {
    return this.material;
  }

  /**
   * ウィンドウサイズの変更時に点サイズの自動調整スケールを変更する。
   */
  public updatePointScale(): void {
    const scale = this.container.clientHeight / 2.0;
    this.material.uniforms.scale.value = scale;
  }

  /**
   * シェーダ処理用の変数に表示色変更の方式を設定する。
   * @param colorMode 表示色変更の表示(0: RGB、1: Index、2: Mix、3: Intensity)
   * @throws 設定可能方式以外の数値を設定
   */
  public setColorMode(colorMode: number): void {
    const colorModes: number[] = Object.values(COLOR_MODE);
    if (!colorModes.includes(colorMode)) {
      const message = Logging.error(LOG_CONF.ERROR_COLOR_MODE, colorMode.toString());
      throw new Error(message);
    }
    this.material.uniforms.colorMode.value = colorMode;
    Logging.info(LOG_CONF.INFO_SET_COLOR_MODE, colorMode.toString());
  }

  /**
   * シェーダ処理用の変数の表示色変更の方式を取得する。
   * @returns 表示色変更の方式
   */
  public getColorMode(): number {
    return this.material.uniforms.colorMode.value;
  }

  /**
   *  シェーダ処理用の変数に表示色変更のIndex方式で参照するインデックス番号を設定する。
   * @param indexNo インデックス番号(範囲：整数値1～3)
   * @throws 設定可能番号以外の数値を設定
   */
  public setColorModeIndexNo(indexNo: number): void {
    const colorIndexNos: number[] = Object.values(COLOR_INDEX_NO);
    if (!colorIndexNos.includes(indexNo)) {
      const message = Logging.error(LOG_CONF.ERROR_COLOR_MODE_INDEX_NO, indexNo.toString());
      throw new Error(message);
    }
    this.material.uniforms.colorIndexNo.value = indexNo;
    Logging.info(LOG_CONF.INFO_SET_COLOR_NUMBER, indexNo.toString());
  }

  /**
   * シェーダ処理用の変数の表示色変更のIndex方式で参照するインデックス番号を取得する。
   * @returns インデックス番号
   */
  public getColorModeIndexNo(): number {
    return this.material.uniforms.colorIndexNo.value;
  }

  /**
   *  シェーダ処理用の変数に表示色変更のIndex方式で使用するカラーテーブルを設定する。
   * @param lut カラーテーブル(要素数: 256)
   * @throws 異常カラーテーブルを設定
   */
  public setColorLookUpTable(lut: THREE.Color[]): void {
    if (lut.length !== 256) {
      const message = Logging.error(LOG_CONF.ERROR_COLOR_MODE_LUT, lut.length.toString());
      throw new Error(message);
    }
    const data = new Uint8Array(4 * 256);
    for (let i = 0; i < 256; i++) {
      const idx = i * 4;
      data[idx + 0] = Math.floor(lut[i].r * 255.0);
      data[idx + 1] = Math.floor(lut[i].g * 255.0);
      data[idx + 2] = Math.floor(lut[i].b * 255.0);
      data[idx + 3] = 255.0;
    }
    const texture = new THREE.DataTexture(data, 256, 1, THREE.RGBAFormat);
    texture.needsUpdate = true;

    this.material.uniforms.lut.value = texture;
    Logging.info(LOG_CONF.INFO_SET_COLOR_TABLE);
  }

  /**
   *  シェーダ処理用の変数にガンマ補正に使用するガンマ値を設定する。
   * @param gammaValue ガンマ補正用パラメータ
   * @throws 0以下の値を設定
   */
  public setGammaValue(gammaValue: number): void {
    if (gammaValue <= 0.0) {
      const message = Logging.error(LOG_CONF.ERROR_GAMMA_VALUE, gammaValue.toString());
      throw new Error(message);
    }
    this.material.uniforms.gammaValue.value = gammaValue;
    Logging.info(LOG_CONF.INFO_SET_GAMMA_VALUE, gammaValue.toString());
  }

  /**
   * シェーダ処理用の変数のガンマ補正に使用するガンマ値を取得する。
   * @returns ガンマ補正用の値
   */
  public getGammaValue(): number {
    return this.material.uniforms.gammaValue.value;
  }

  /**
   * シェーダ処理用の変数に範囲選択のオブジェクト種別を設定する。
   * @param type オブジェクト種別の番号(0: 直方体、1: 円柱、2: 球)
   */
  public setRangeSelectionType(type: number): void {
    this.material.uniforms.rsType.value = type;
  }

  /**
   * シェーダ処理用の変数に範囲選択の変換行列を設定する。
   * @param matrix 変換行列
   */
  public setRangeSelectionMatrix(matrix: THREE.Matrix4): void {
    const matrixAry = new Float32Array(16);
    matrix.toArray(matrixAry);
    this.material.uniforms.rangeSelectionMatrix.value.set(matrixAry, 0);
  }

  /**
   * シェーダ処理用の変数に範囲選択の円柱の円周の角度を設定する。
   * @param thetaLength 円柱の円周の角度
   */
  public setRangeSelectionThetaLength(thetaLength: number): void {
    thetaLength = COPCUtil.normalizeRadian(thetaLength);
    this.material.uniforms.thetaLength.value = thetaLength;
  }
}
