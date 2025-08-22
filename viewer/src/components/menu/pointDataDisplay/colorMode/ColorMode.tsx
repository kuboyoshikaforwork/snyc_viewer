import * as THREE from 'three';
import {useEffect, useState} from 'react';

import {COPCViewer} from '../../../../viewer/copcViewer';
import {COLOR_INDEX_NO, COLOR_MODE} from '../../../../viewer/pointCloud/pointDef';
import CustomRangeSlider from '../../../common/CustomRangeSlider';
import CustomRadioButton, {RadioSelectionInfo} from '../../../common/CustomRadioButton';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

function createAnalyzescaleLUT() {
  const lut: THREE.Color[] = [];
  for (let i = 0; i < 256; i++) {
    const color = new THREE.Color();
    color.r = 0;
    color.g = 0;
    color.b = 0;
    lut.push(color);
  }
  lut[0].r = 1.0;
  lut[0].g = 1.0;
  lut[0].b = 1.0;

  lut[1].r = 10.0 / 255.0;
  lut[1].g = 10.0 / 255.0;
  lut[1].b = 220.0 / 255.0;

  lut[2].r = 1.0;
  lut[2].g = 1.0;
  lut[2].b = 1.0;

  lut[3].r = 255.0 / 255.0;
  lut[3].g = 100.0 / 255.0;
  lut[3].b = 0;

  lut[4].r = 255.0 / 255.0;
  lut[4].g = 0;
  lut[4].b = 255.0 / 255.0;

  return lut;
}

const ColorMode = (props: Props) => {
  // カラーモード選択方式一覧
  const [selectedColorMode, setSelectedColorMode] = useState(0);
  const colorModeAry: RadioSelectionInfo[] = [
    {name: 'RGB', value: COLOR_MODE.RGB},
    {name: 'Index', value: COLOR_MODE.INDEX},
    {name: 'Mix', value: COLOR_MODE.MIX},
    {name: 'Intensity', value: COLOR_MODE.INTENSITY},
  ];

  const changeColorMode = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedColorMode(Number(event.target.value));
    if (props.viewer) {
      props.viewer.getPointDef().setColorMode(Number(event.target.value));
    }
  };

  // カラーモードインデックス番号設定
  const [selectedColorIndexNo, setSelectedColorIndexNo] = useState(0);
  const colorModeIndexAry: RadioSelectionInfo[] = [
    {name: 'Index1', value: COLOR_INDEX_NO.I1},
    {name: 'Index2', value: COLOR_INDEX_NO.I2},
    {name: 'Index3', value: COLOR_INDEX_NO.I3},
  ];
  const changeColorIndexNo = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedColorIndexNo(Number(event.target.value));
    if (props.viewer) {
      props.viewer.getPointDef().setColorModeIndexNo(Number(event.target.value));
    }
  };

  // ガンマ変換設定
  const [gammaValue, setGammaValue] = useState(0);
  const changeGammaValue = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (props.viewer) {
      setGammaValue(Number(event.target.value));
      props.viewer.getPointDef().setGammaValue(Number(event.target.value));
    }
  };

  useEffect(() => {
    if (props.viewer) {
      // 設定状態反映
      setSelectedColorMode(props.viewer.getPointDef().getColorMode());
      setSelectedColorIndexNo(props.viewer.getPointDef().getColorModeIndexNo());
      setGammaValue(props.viewer.getPointDef().getGammaValue());

      // 赤色カラーテーブル設定
      // const lut: THREE.Color[] = [];
      // for (let i = 0; i < 256; i++) {
      //   const color = new THREE.Color();
      //   color.r = i / 255.0;
      //   color.g = 0;
      //   color.b = 0;
      //   lut.push(color);
      // }

      // サンプルLUT設定
      const lut = createAnalyzescaleLUT();
      props.viewer.getPointDef().setColorLookUpTable(lut);
    }
  }, [props.viewer]);

  return (
    <>
      <p>
        <b>[カラーモード]</b>
      </p>
      <CustomRadioButton
        groupName="color_mode-selection"
        initialValue={selectedColorMode}
        selection={selectedColorMode}
        selectionInfo={colorModeAry}
        onChange={changeColorMode}></CustomRadioButton>
      <p>
        <b>[インデックス番号]</b>
      </p>
      <CustomRadioButton
        groupName="color_mode-index-selection"
        initialValue={selectedColorIndexNo}
        selection={selectedColorIndexNo}
        selectionInfo={colorModeIndexAry}
        onChange={changeColorIndexNo}></CustomRadioButton>
      <p>
        <b>[ガンマ変換]</b>
      </p>
      <CustomRangeSlider theme="γ値" min={0} max={5} step={0.1} onChange={changeGammaValue} value={gammaValue} />
    </>
  );
};

export default ColorMode;
