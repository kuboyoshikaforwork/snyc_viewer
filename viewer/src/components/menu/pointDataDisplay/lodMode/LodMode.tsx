import {useEffect, useState} from 'react';
import {COPCViewer, LOD_MODE} from '../../../../viewer/copcViewer';
import CustomRadioButton, {RadioSelectionInfo} from '../../../common/CustomRadioButton';
import CustomRangeSlider from '../../../common/CustomRangeSlider';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const LodMode = (props: Props) => {
  // 点選択方式一覧
  const lodModeAry: RadioSelectionInfo[] = [
    {name: '間引きなし(デバッグ用)', value: -1},
    {name: '動的間引き表示', value: LOD_MODE.DYNAMIC},
    {name: '広域間引き表示', value: LOD_MODE.WIDE_AREA},
    {name: '深さ指定間引き表示', value: LOD_MODE.DEPTH},
  ];

  // 間引き表示設定
  const [selectedLodMode, setLodMode] = useState(0);
  const chnageLodMode = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (props.viewer) {
      setLodMode(Number(event.target.value));
      const mode = Number(event.target.value);
      props.viewer.setLodMode(mode);
      props.viewer.setLodCopcDepth(copcDepth);
    }
  };

  // 表示レベル設定
  const [copcDepth, setCopcDepth] = useState(0);
  const changeCopcDepth = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (props.viewer) {
      setCopcDepth(Number(event.target.value));
      props.viewer.setLodCopcDepth(Number(event.target.value));
    }
  };

  useEffect(() => {
    if (props.viewer) {
      // 設定状態反映
      setLodMode(props.viewer.getLodMode());
      setCopcDepth(props.viewer.getLodCopcDepth());
    }
  }, [props.viewer]);

  return (
    <>
      <p>
        <b>[間引きモード]</b>
      </p>
      <CustomRadioButton
        groupName="lod-selection"
        initialValue={LOD_MODE.DYNAMIC}
        selection={selectedLodMode}
        selectionInfo={lodModeAry}
        onChange={chnageLodMode}></CustomRadioButton>
      <p>
        <b>[表示レベル]</b>
      </p>
      <CustomRangeSlider theme="COPC DEPTH" min={0} max={10} step={1} onChange={changeCopcDepth} value={copcDepth} />
    </>
  );
};

export default LodMode;
