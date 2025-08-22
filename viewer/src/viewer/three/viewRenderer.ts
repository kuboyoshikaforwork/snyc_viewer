/**
 * @fileoverview 3D空間のレンダラーを提供するクラスの定義
 * @author Kota Kubota(SEQ)
 * @created 2025/05/02
 * @copyright (C) 2025 MITSUBISHI ELECTRIC CORPORATION ALL RIGHTS RESERVED
 */

import * as THREE from 'three';

/**
 * @interface レンダリング情報
 */
export interface RenderingInfo {
  calls: number;
  frame: number;
  lines: number;
  points: number;
  triangles: number;
}

/**
 * 3D空間のレンダラーを提供するクラス
 */
export class ViewRenderer {
  /** 3D空間を表示するHTML要素 */
  private container: HTMLElement;

  /** 3D空間のレンダラー */
  private renderer: THREE.WebGLRenderer;

  /** レンダリング情報 */
  private renderingInfo: RenderingInfo;

  /**
   * 3D空間のレンダラーを生成する
   * @param container 3D空間を表示するHTML要素
   */
  constructor(container: HTMLElement) {
    this.container = container;

    // レンダラー生成
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      depth: true,
    });

    // フレームバッファのクリア無効化
    this.renderer.autoClear = false;

    // レンダラーサイズ設定
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);

    // 初期レンダリング情報設定
    this.renderingInfo = this.renderer.info.render;

    container.appendChild(this.renderer.domElement);
  }

  /**
   * レンダラーオブジェクトを取得する
   * @returns レンダラーオブジェクト
   */
  public get(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * 3D空間を表示するHTML要素からレンダラーのDOM要素を破棄する
   */
  public clear(): void {
    this.container.removeChild(this.renderer.domElement);
  }

  /**
   * HTML要素のサイズに合わせてレンダラーをリサイズする
   */
  public resize(): void {
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  /**
   * テクスチャサイズがGPUでサポートされているか判定する
   * @param textureSize テクスチャサイズ
   * @returns サポート要否(true：サポート対象、false：サポート対象外)
   */
  public isSupportTextureSize(textureSize: number): boolean {
    const maxTextureSize = this.renderer.capabilities.maxTextureSize;
    if (textureSize < maxTextureSize) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * レンダリングの情報を保持する
   */
  public saveRenderingInfo(): void {
    this.renderingInfo = structuredClone(this.renderer.info.render);
  }

  /**
   * レンダリングの情報を取得する
   * @returns レンダリング情報
   */
  public getRenderingInfo(): RenderingInfo {
    return this.renderingInfo;
  }
}
