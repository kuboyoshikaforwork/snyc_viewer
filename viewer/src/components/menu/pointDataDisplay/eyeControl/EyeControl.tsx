import {useEffect, useState, useCallback} from 'react';
import * as THREE from 'three';

import {COPCViewer} from '../../../../viewer/copcViewer';
import {COPCUtil} from '../../../../viewer/util/copcUtil';
import CustomButton from '../../../common/CustomButton';
import CustomTextBox from '../../../common/CustomTextBox';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const EyeControl = (props: Props) => {
  // 視点位置
  const [eyeX, setEyeX] = useState('');
  const [eyeY, setEyeY] = useState('');
  const [eyeZ, setEyeZ] = useState('');
  const clickSetEye = () => {
    if (props.viewer) {
      if (eyeX && eyeY && eyeZ) {
        const eye = new THREE.Vector3(Number(eyeX), Number(eyeY), Number(eyeZ));
        props.viewer.getControls().setEye(eye);
      }
    }
  };

  // 注視点位置
  const [focusX, setfocusX] = useState('');
  const [focusY, setfocusY] = useState('');
  const [focusZ, setfocusZ] = useState('');
  const clickSetFocus = () => {
    if (props.viewer) {
      if (focusX && focusY && focusZ) {
        const focus = new THREE.Vector3(Number(focusX), Number(focusY), Number(focusZ));
        props.viewer.getControls().setFocus(focus);
      }
    }
  };

  // 視点・注視点制御
  const clickEyeMoveEnable = () => {
    if (props.viewer) {
      props.viewer.getControls().setEyeMoveEnabled();
    }
  };
  const clickEyeMoveDisable = () => {
    if (props.viewer) {
      props.viewer.getControls().setEyeMoveDisabled();
    }
  };

  // 視点・注視点制御
  const clickFocusMoveEnable = () => {
    if (props.viewer) {
      props.viewer.getControls().setDblclickFocusMoveEnabled();
    }
  };
  const clickFocusMoveDisable = () => {
    if (props.viewer) {
      props.viewer.getControls().setDblclickFocusMoveDisabled();
    }
  };

  // 視点・注視点位置
  const [nowEyeX, setNowEyeX] = useState('');
  const [nowEyeY, setNowEyeY] = useState('');
  const [nowEyeZ, setNowEyeZ] = useState('');
  const [nowFocusX, setNowFocusX] = useState('');
  const [nowFocusY, setNowFocusY] = useState('');
  const [nowFocusZ, setNowFocusZ] = useState('');

  const updateEyeFocus = useCallback(() => {
    if (props.viewer) {
      const eye = props.viewer.getControls().getEye();
      const focus = props.viewer.getControls().getFocus();
      setNowEyeX(COPCUtil.roundPrecision(eye.x, 1).toString());
      setNowEyeY(COPCUtil.roundPrecision(eye.y, 1).toString());
      setNowEyeZ(COPCUtil.roundPrecision(eye.z, 1).toString());
      setNowFocusX(COPCUtil.roundPrecision(focus.x, 1).toString());
      setNowFocusY(COPCUtil.roundPrecision(focus.y, 1).toString());
      setNowFocusZ(COPCUtil.roundPrecision(focus.z, 1).toString());
    }
  }, [props.viewer]);

  useEffect(() => {
    if (props.viewer) {
      // updateEyeFocus();
      props.viewer.getControls().addEventListener('change', updateEyeFocus);
    }
  }, [props.viewer, updateEyeFocus]);

  return (
    <>
      <p>
        <b>[視点位置設定]</b>
      </p>
      <CustomTextBox labelName="X" width={100} value={eyeX} onChange={setEyeX}></CustomTextBox> ({nowEyeX})<br></br>
      <CustomTextBox labelName="Y" width={100} value={eyeY} onChange={setEyeY}></CustomTextBox> ({nowEyeY})<br></br>
      <CustomTextBox labelName="Z" width={100} value={eyeZ} onChange={setEyeZ}></CustomTextBox> ({nowEyeZ})<br></br>
      <CustomButton labelName="視点位置変更" onClick={clickSetEye}></CustomButton>
      <p>
        <b>[注視点位置設定]</b>
      </p>
      <CustomTextBox labelName="X" width={100} value={focusX} onChange={setfocusX}></CustomTextBox> ({nowFocusX})
      <br></br>
      <CustomTextBox labelName="Y" width={100} value={focusY} onChange={setfocusY}></CustomTextBox> ({nowFocusY})
      <br></br>
      <CustomTextBox labelName="Z" width={100} value={focusZ} onChange={setfocusZ}></CustomTextBox> ({nowFocusZ})
      <br></br>
      <CustomButton labelName="注視点位置変更" onClick={clickSetFocus}></CustomButton>
      <hr></hr>
      <p>
        <b>[視点移動制御設定]</b>
      </p>
      <CustomButton labelName="視点制御有効化" onClick={clickEyeMoveEnable}></CustomButton>
      <CustomButton labelName="視点制御無効化" onClick={clickEyeMoveDisable}></CustomButton>
      <p>
        <b>[ダブルクリック注視点移動設定]</b>
      </p>
      <CustomButton labelName="視点移動有効化" onClick={clickFocusMoveEnable}></CustomButton>
      <CustomButton labelName="視点移動無効化" onClick={clickFocusMoveDisable}></CustomButton>
    </>
  );
};

export default EyeControl;
