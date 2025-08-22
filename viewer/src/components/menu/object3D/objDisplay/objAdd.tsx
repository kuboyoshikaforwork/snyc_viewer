import {useState} from 'react';

import * as THREE from 'three';
import {COPCViewer} from '../../../../viewer/copcViewer';
import CustomButton from '../../../common/CustomButton';
import CustomTextBox from '../../../common/CustomTextBox';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const ObjAdd = (props: Props) => {
  // 登録パラメータ
  const [modelId, setModelId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [modelX, setModelX] = useState('');
  const [modelY, setModelY] = useState('');
  const [modelZ, setModelZ] = useState('');
  const [modelRoll, setModelRoll] = useState('');
  const [modelPitch, setModelPitch] = useState('');
  const [modelYaw, setNodelYaw] = useState('');

  // オブジェクトID
  const [objId, setObjId] = useState<string>('');

  const clickAddObj = () => {
    if (props.viewer) {
      if (modelId && modelX && modelY && modelZ && modelRoll && modelPitch && modelYaw) {
        const position = new THREE.Vector3(Number(modelX), Number(modelY), Number(modelZ));
        const roll = Number(modelRoll);
        const pitch = Number(modelPitch);
        const yaw = Number(modelYaw);
        const id = props.viewer.getScene().addOBJ(Number(modelId), groupId, position, roll, pitch, yaw, true);
        setObjId(id.toString());
      }
    }
  };

  // オブジェクト操作
  const visibleAll = () => {
    if (props.viewer) {
      props.viewer.getScene().setAllObjVisible();
    }
  };
  const invisibleAll = () => {
    if (props.viewer) {
      props.viewer.getScene().setAllObjInvisible();
    }
  };
  const removeAll = () => {
    if (props.viewer) {
      props.viewer.getScene().removeAllObj();
    }
  };

  return (
    <>
      <p>
        <b>[OBJ登録]</b>
      </p>
      <CustomTextBox labelName="表示モデルID " width={100} value={modelId} onChange={setModelId}></CustomTextBox>{' '}
      <br></br>
      <CustomTextBox labelName="グループID 　" width={100} value={groupId} onChange={setGroupId}></CustomTextBox>{' '}
      <br></br>
      <CustomTextBox labelName="x座標　　　　" width={100} value={modelX} onChange={setModelX}></CustomTextBox>{' '}
      <br></br>
      <CustomTextBox labelName="y座標　　　　" width={100} value={modelY} onChange={setModelY}></CustomTextBox>{' '}
      <br></br>
      <CustomTextBox labelName="z座標　　　　" width={100} value={modelZ} onChange={setModelZ}></CustomTextBox>{' '}
      <br></br>
      <CustomTextBox
        labelName="Roll 　　　　"
        width={100}
        value={modelRoll}
        onChange={setModelRoll}></CustomTextBox>{' '}
      <br></br>
      <CustomTextBox
        labelName="Pitch　　　　"
        width={100}
        value={modelPitch}
        onChange={setModelPitch}></CustomTextBox>{' '}
      <br></br>
      <CustomTextBox labelName="Yaw　　　　　" width={100} value={modelYaw} onChange={setNodelYaw}></CustomTextBox>{' '}
      <br></br>
      <CustomButton labelName="表示実行" onClick={clickAddObj}></CustomButton>
      <br></br>
      <hr></hr>
      <label>&emsp;オブジェクトID：{objId}</label>
      <hr></hr>
      <p>
        <b>[オブジェクト操作]</b>
      </p>
      <CustomButton labelName="全表示　" onClick={visibleAll}></CustomButton>
      <CustomButton labelName="全非表示" onClick={invisibleAll}></CustomButton>
      <CustomButton labelName="全削除　" onClick={removeAll}></CustomButton>
    </>
  );
};

export default ObjAdd;
