import * as THREE from 'three';

import {useEffect, useState} from 'react';
import {OBJECT_CONTROL_MODE, RANGE_SELECT_TYPE} from '../../../../viewer/pointCloud/pointMeasure';
import {COPCViewer} from '../../../../viewer/copcViewer';
import CustomRadioButton, {RadioSelectionInfo} from '../../../common/CustomRadioButton';
import CustomRangeSlider from '../../../common/CustomRangeSlider';
import CustomButton from '../../../common/CustomButton';
import {COPCUtil} from '../../../../viewer/util/copcUtil';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const RangeSelection = (props: Props) => {
  // 範囲選択方式設定
  const rangeSelectionObjectAry: RadioSelectionInfo[] = [
    {name: '直方体', value: RANGE_SELECT_TYPE.BOX},
    {name: '円柱', value: RANGE_SELECT_TYPE.CYLINDER},
    {name: '球', value: RANGE_SELECT_TYPE.SPHERE},
  ];
  const [rangeSelectionObject, setRangeSelectionObject] = useState(RANGE_SELECT_TYPE.BOX);
  const chnageRangeSelectionObject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const type = Number(event.target.value);
    setRangeSelectionObject(type);
  };
  const clickRangeSelectionStart = () => {
    if (props.viewer) {
      props.viewer.getMeasure().startRangeSelection(rangeSelectionObject);
    }
  };
  const clickRangeSelectionStop = () => {
    if (props.viewer) {
      props.viewer.getMeasure().stopRangeSelection();
    }
  };

  // 範囲選択 回転パラメータ
  const [xRotate, setXRotate] = useState<number>(0);
  const changeXRotate = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (props.viewer) {
      setXRotate(Number(event.target.value));
      props.viewer.getMeasure().setRangeSelectionXRotate(Number(event.target.value));
    }
  };
  const [yRotate, setYRotate] = useState(0);
  const changeYRotate = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (props.viewer) {
      setYRotate(Number(event.target.value));
      props.viewer.getMeasure().setRangeSelectionYRotate(Number(event.target.value));
    }
  };
  const [zRotate, setZRotate] = useState(0);
  const changeZRotate = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (props.viewer) {
      setZRotate(Number(event.target.value));
      props.viewer.getMeasure().setRangeSelectionZRotate(Number(event.target.value));
    }
  };
  const [xSize, setXSize] = useState(0);
  const changeXSize = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (props.viewer) {
      setXSize(Number(event.target.value));
      props.viewer.getMeasure().setRangeSelectionXSize(Number(event.target.value));
    }
  };
  const [ySize, setYSize] = useState(0);
  const changeYSize = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (props.viewer) {
      setYSize(Number(event.target.value));
      props.viewer.getMeasure().setRangeSelectionYSize(Number(event.target.value));
    }
  };
  const [zSize, setZSize] = useState(0);
  const changeZSize = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (props.viewer) {
      setZSize(Number(event.target.value));
      props.viewer.getMeasure().setRangeSelectionZSize(Number(event.target.value));
    }
  };
  const [radius, setRadius] = useState(0);
  const changeRadius = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (props.viewer) {
      setRadius(Number(event.target.value));
      props.viewer.getMeasure().setRangeSelectionRadius(Number(event.target.value));
    }
  };
  const [thetaLength, setThetaLength] = useState(0);
  const changeThetaLength = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (props.viewer) {
      setThetaLength(Number(event.target.value));
      const thetaLength = Number(event.target.value) * ((2 * Math.PI) / 360);
      props.viewer.getMeasure().setRangeSelectionThetaLength(thetaLength);
    }
  };
  const [thetaStart, setThetaStart] = useState(0);
  const changeThetaStart = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (props.viewer) {
      setThetaStart(Number(event.target.value));
      const thetaStart = Number(event.target.value) * ((2 * Math.PI) / 360);
      props.viewer.getMeasure().setRangeSelectionThetaStart(thetaStart);
    }
  };

  // 範囲選択オブジェクト操作設定
  const objectControlModeAry: RadioSelectionInfo[] = [
    {name: '移動', value: OBJECT_CONTROL_MODE.TRANSLATE},
    {name: '回転', value: OBJECT_CONTROL_MODE.ROTATE},
    {name: '拡縮', value: OBJECT_CONTROL_MODE.SCALE},
  ];
  const [objectControlMode, setObjectControlMode] = useState(OBJECT_CONTROL_MODE.TRANSLATE);
  const chnageObjectControlMode = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (props.viewer) {
      const type = Number(event.target.value);
      setObjectControlMode(type);
      props.viewer.pointMeasure.setObjectControlMode(type);
    }
  };

  useEffect(() => {
    if (props.viewer) {
      // ビューアの現在設定値(初期値)を設定
      setXRotate(props.viewer.getMeasure().getRangeSelectionXRotate());
      setYRotate(props.viewer.getMeasure().getRangeSelectionYRotate());
      setZRotate(props.viewer.getMeasure().getRangeSelectionZRotate());
      setXSize(props.viewer.getMeasure().getRangeSelectionXSize());
      setYSize(props.viewer.getMeasure().getRangeSelectionYSize());
      setZSize(props.viewer.getMeasure().getRangeSelectionZSize());
      setRadius(props.viewer.getMeasure().getRangeSelectionRadius());
      setThetaLength(
        COPCUtil.roundPrecision(THREE.MathUtils.radToDeg(props.viewer.getMeasure().getRangeSelectionThetaLength()), 1),
      );
      setThetaStart(
        COPCUtil.roundPrecision(THREE.MathUtils.radToDeg(props.viewer.getMeasure().getRangeSelectionThetaStart()), 1),
      );

      // 範囲選択処理のオブジェクトのサイズ設定用コールバック設定
      const objectSizeCallback = (
        xSize: number,
        ySize: number,
        zSize: number,
        radius: number,
        thetaLength: number,
        thetaStart: number,
      ) => {
        setXSize(COPCUtil.roundPrecision(xSize, 1));
        setYSize(COPCUtil.roundPrecision(ySize, 1));
        setZSize(COPCUtil.roundPrecision(zSize, 1));
        setRadius(COPCUtil.roundPrecision(radius, 1));
        setThetaLength(COPCUtil.roundPrecision(THREE.MathUtils.radToDeg(thetaLength), 1));
        setThetaStart(COPCUtil.roundPrecision(THREE.MathUtils.radToDeg(thetaStart), 1));
      };
      props.viewer.getMeasure().setRangeSelectObjectSizeCallback(objectSizeCallback);

      // 範囲選択処理のオブジェクトの回転状態設定用のコールバック設定
      const objectRotateCallback = (x: number, y: number, z: number) => {
        setXRotate(COPCUtil.roundPrecision(x, 1));
        setYRotate(COPCUtil.roundPrecision(y, 1));
        setZRotate(COPCUtil.roundPrecision(z, 1));
      };
      props.viewer.getMeasure().setRangeSelectObjectRotateCallback(objectRotateCallback);
    }
  }, [props.viewer]);

  return (
    <>
      <p>
        <b>[選択オブジェクト]</b>
      </p>
      <CustomRadioButton
        groupName="range-selection"
        initialValue={RANGE_SELECT_TYPE.BOX}
        selection={rangeSelectionObject}
        selectionInfo={rangeSelectionObjectAry}
        onChange={chnageRangeSelectionObject}></CustomRadioButton>
      <br></br>
      <CustomButton labelName="範囲選択実行" onClick={clickRangeSelectionStart}></CustomButton>
      <CustomButton labelName="範囲選択終了" onClick={clickRangeSelectionStop}></CustomButton>
      <hr></hr>
      <p>
        <b>[オブジェクト操作]</b>
      </p>
      <CustomRadioButton
        groupName="control-mode"
        initialValue={OBJECT_CONTROL_MODE.TRANSLATE}
        selection={objectControlMode}
        selectionInfo={objectControlModeAry}
        onChange={chnageObjectControlMode}></CustomRadioButton>
      <br></br>
      <hr></hr>
      <p>
        <b>[オブジェクトパラメータ]</b>
      </p>
      <CustomRangeSlider theme="X SIZE" min={1} max={500} step={1} onChange={changeXSize} value={xSize} />
      <CustomRangeSlider theme="Y SIZE" min={1} max={500} step={1} onChange={changeYSize} value={ySize} />
      <CustomRangeSlider theme="Z SIZE" min={1} max={500} step={1} onChange={changeZSize} value={zSize} />
      <CustomRangeSlider theme="RADIUS" min={1} max={500} step={1} onChange={changeRadius} value={radius} />
      <CustomRangeSlider
        theme="THETA LENGTH"
        min={0}
        max={360}
        step={1}
        onChange={changeThetaLength}
        value={thetaLength}
      />
      <CustomRangeSlider
        theme="THETA START"
        min={0}
        max={360}
        step={1}
        onChange={changeThetaStart}
        value={thetaStart}
      />
      <br></br>
      <CustomRangeSlider theme="X ROTATE" min={-180} max={180} step={1} onChange={changeXRotate} value={xRotate} />
      <CustomRangeSlider theme="Y ROTATE" min={-180} max={180} step={1} onChange={changeYRotate} value={yRotate} />
      <CustomRangeSlider theme="Z ROTATE" min={-180} max={180} step={1} onChange={changeZRotate} value={zRotate} />
      <br></br>
    </>
  );
};

export default RangeSelection;
