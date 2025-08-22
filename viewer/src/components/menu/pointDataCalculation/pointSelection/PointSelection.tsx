import * as THREE from 'three';
import {useCallback, useEffect, useState} from 'react';
import {POINT_SELECTION_MODE} from '../../../../viewer/pointCloud/pointMeasure';
import {COPCViewer} from '../../../../viewer/copcViewer';
import CustomRadioButton, {RadioSelectionInfo} from '../../../common/CustomRadioButton';
import {COPCUtil} from '../../../../viewer/util/copcUtil';
import CustomButton from '../../../common/CustomButton';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const PointSelection = (props: Props) => {
  // 点選択方式一覧
  const selectionModeAry: RadioSelectionInfo[] = [
    {name: '矩形選択', value: POINT_SELECTION_MODE.BOX},
    {name: '2点選択', value: POINT_SELECTION_MODE.DOUBLE},
    {name: '水平方向制限付き2点選択', value: POINT_SELECTION_MODE.HORIZONTAL_DOUBLE},
    {name: '垂直方向制限付き2点選択', value: POINT_SELECTION_MODE.VERTICAL_DOUBLE},
    {name: '1点選択', value: POINT_SELECTION_MODE.SINGLE},
  ];

  // 点選択方式設定
  const [pointSelectionMode, setPointSelectionMode] = useState(0);
  const chnageSelectionMode = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (props.viewer) {
      const mode = Number(event.target.value);
      setPointSelectionMode(mode);
      props.viewer.getMeasure().setPointSelectionMode(mode);
    }
  };

  // 点選択解除ボタン処理
  const clickPointSelectionCancel = () => {
    if (props.viewer) {
      props.viewer.getMeasure().clearPointSelection();
    }
  };

  // 距離計測開始ボタン処理
  const clickMeasureDistanceStart = () => {
    if (props.viewer) {
      props.viewer.getMeasure().showPointDistance();
    }
  };
  // 距離計測終了ボタン処理
  const clickMeasureDistanceEnd = () => {
    if (props.viewer) {
      props.viewer.getMeasure().hidePointDistance();
    }
  };

  // 鉛直距離計測処理
  const [vDistance, setVDistance] = useState('-');
  const [verticalMeasureState, setverticalMeasureState] = useState(0);
  const verticalMeasureAry: RadioSelectionInfo[] = [
    {name: '無効', value: 0},
    {name: '有効', value: 1},
  ];
  const chnageVerticalMeasureState = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (props.viewer) {
      const state = Number(event.target.value);
      setverticalMeasureState(state);
      if (state === 0) {
        // 無効
        props.viewer.getMeasure().setVerticalMeasureDisabled();
        setVDistance('-');
      } else {
        // 有効
        props.viewer.getMeasure().setVerticalMeasureEnabled();
      }
    }
  };

  // 水平角度計測ボタン処理
  const [angle, setAngle] = useState('-');
  const clickMeasureHorizontalAngle = () => {
    if (props.viewer) {
      try {
        const radian = props.viewer.getMeasure().getHorizontalAngle();
        const horizontalAngle = THREE.MathUtils.radToDeg(radian);
        setAngle(COPCUtil.getUnitValue(horizontalAngle, 1, '度'));
      } catch (e) {
        console.log(e);
        setAngle('-');
      }
    }
  };

  // 設定内容反映処理
  const reflectSetting = useCallback(() => {
    if (props.viewer) {
      setPointSelectionMode(props.viewer.getMeasure().getPointSelectionMode());
    }
  }, [props.viewer]);

  useEffect(() => {
    if (props.viewer) {
      // 設定値反映イベント登録
      props.viewer.getEventTarget().addEventListener('conf-change', reflectSetting);

      // 設定状態反映
      setPointSelectionMode(props.viewer.getMeasure().getPointSelectionMode());

      // 点選択処理完了コールバック登録
      props.viewer.getMeasure().setPointSelectCallback(() => {
        console.log('SELECTION END');
      });

      // 鉛直距離計測結果コールバック登録
      const verticalResultSet = (value: number) => {
        setVDistance(COPCUtil.getUnitValue(value, 1, 'm'));
      };
      props.viewer.getMeasure().setVerticalMeasureCallback(verticalResultSet);
    }
  }, [props.viewer, reflectSetting]);

  return (
    <>
      <p>
        <b>[選択モード]</b>
      </p>
      <CustomRadioButton
        groupName="point-selection"
        initialValue={POINT_SELECTION_MODE.BOX}
        selection={pointSelectionMode}
        selectionInfo={selectionModeAry}
        onChange={chnageSelectionMode}></CustomRadioButton>
      <br></br>
      <CustomButton labelName="点選択解除" onClick={clickPointSelectionCancel}></CustomButton>
      <hr></hr>
      <p>
        <b>[距離計測(縞模様表示)]</b>
      </p>
      <CustomButton labelName="距離計測開始" onClick={clickMeasureDistanceStart}></CustomButton>
      <CustomButton labelName="距離計測終了" onClick={clickMeasureDistanceEnd}></CustomButton>
      <hr></hr>
      <p>
        <b>[鉛直距離計測]</b>
      </p>
      <CustomRadioButton
        groupName="vertical-measure"
        initialValue={0}
        selection={verticalMeasureState}
        selectionInfo={verticalMeasureAry}
        onChange={chnageVerticalMeasureState}></CustomRadioButton>
      <p>鉛直距離：{vDistance}</p>
      <hr></hr>
      <p>
        <b>[水平角度計測]</b>
      </p>
      <CustomButton labelName="水平角度取得" onClick={clickMeasureHorizontalAngle}></CustomButton>
      <br></br>
      <p>Angle：{angle}</p>
    </>
  );
};

export default PointSelection;
