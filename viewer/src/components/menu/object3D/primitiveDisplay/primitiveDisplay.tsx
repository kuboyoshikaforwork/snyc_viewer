import {useState} from 'react';

import * as THREE from 'three';
import {COPCViewer} from '../../../../viewer/copcViewer';
import CustomButton from '../../../common/CustomButton';
import CustomTextBox from '../../../common/CustomTextBox';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const PrimitiveDisplay = (props: Props) => {
  const [groupId, setGroupId] = useState('');
  const [x, setX] = useState<string>('');
  const [y, setY] = useState<string>('');
  const [z, setZ] = useState<string>('');
  const [roll, setRoll] = useState<string>('');
  const [pitch, setPitch] = useState<string>('');
  const [yaw, setYaw] = useState<string>('');
  const [radius, setRadius] = useState<string>('');
  const [width, setWidth] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [color, setColor] = useState<string>('');

  // オブジェクトID
  const [objId, setObjId] = useState<string>('');

  // 球のプリミティブオブジェクト表示
  const displaySphere = () => {
    if (props.viewer) {
      const position = new THREE.Vector3(Number(x), Number(y), Number(z));
      const id = props.viewer
        .getScene()
        .addPrimitiveSphere(groupId, position, Number(radius), new THREE.Color(Number(color)), true);
      setObjId(id.toString());
    }
  };
  // 三角錐のプリミティブオブジェクト表示
  const displayTrigonalPyramids = () => {
    if (props.viewer) {
      const position = new THREE.Vector3(Number(x), Number(y), Number(z));
      const id = props.viewer
        .getScene()
        .addPrimitiveTrigonalPyramids(
          groupId,
          position,
          Number(roll),
          Number(pitch),
          Number(yaw),
          Number(width),
          Number(height),
          new THREE.Color(Number(color)),
          true,
        );
      setObjId(id.toString());
    }
  };
  // 四角錐のプリミティブオブジェクト表示
  const displaySquarePyramids = () => {
    if (props.viewer) {
      const position = new THREE.Vector3(Number(x), Number(y), Number(z));
      const id = props.viewer
        .getScene()
        .addPrimitiveSquarePyramids(
          groupId,
          position,
          Number(roll),
          Number(pitch),
          Number(yaw),
          Number(width),
          Number(height),
          new THREE.Color(Number(color)),
          true,
        );
      setObjId(id.toString());
    }
  };
  // 正八面体のプリミティブオブジェクト表示
  const displayRegularOctahedron = () => {
    if (props.viewer) {
      const position = new THREE.Vector3(Number(x), Number(y), Number(z));
      const id = props.viewer
        .getScene()
        .addPrimitiveRegularOctahedron(
          groupId,
          position,
          Number(roll),
          Number(pitch),
          Number(yaw),
          Number(width),
          new THREE.Color(Number(color)),
          true,
        );
      setObjId(id.toString());
    }
  };

  // オブジェクト操作
  const visibleAll = () => {
    if (props.viewer) {
      props.viewer.getScene().setAllPrimitiveVisible();
    }
  };
  const invisibleAll = () => {
    if (props.viewer) {
      props.viewer.getScene().setAllPrimitiveInvisible();
    }
  };
  const removeAll = () => {
    if (props.viewer) {
      props.viewer.getScene().removeAllPrimitive();
    }
  };
  return (
    <>
      <p>
        <b>[オブジェクト表示]</b>
      </p>
      <CustomTextBox labelName="グループID 　" width={100} value={groupId} onChange={setGroupId}></CustomTextBox>{' '}
      <br></br>
      <CustomTextBox labelName="x座標　　　　" width={100} value={x} onChange={setX}></CustomTextBox> <br></br>
      <CustomTextBox labelName="y座標　　　　" width={100} value={y} onChange={setY}></CustomTextBox> <br></br>
      <CustomTextBox labelName="z座標　　　　" width={100} value={z} onChange={setZ}></CustomTextBox> <br></br>
      <CustomTextBox labelName="Roll 　　　　" width={100} value={roll} onChange={setRoll}></CustomTextBox> <br></br>
      <CustomTextBox labelName="Pitch　　　　" width={100} value={pitch} onChange={setPitch}></CustomTextBox> <br></br>
      <CustomTextBox labelName="Yaw　　　　　" width={100} value={yaw} onChange={setYaw}></CustomTextBox> <br></br>
      <CustomTextBox labelName="半径 　　　　" width={100} value={radius} onChange={setRadius}></CustomTextBox>{' '}
      <br></br>
      <CustomTextBox labelName="長さ 　　　　" width={100} value={width} onChange={setWidth}></CustomTextBox> <br></br>
      <CustomTextBox labelName="高さ 　　　　" width={100} value={height} onChange={setHeight}></CustomTextBox>{' '}
      <br></br>
      <CustomTextBox labelName="色 　　　　　" width={100} value={color} onChange={setColor}></CustomTextBox> <br></br>
      <CustomButton labelName="表示(球)" onClick={displaySphere}></CustomButton>
      <br></br>
      <CustomButton labelName="表示(三角錐)" onClick={displayTrigonalPyramids}></CustomButton>
      <br></br>
      <CustomButton labelName="表示(四角錐)" onClick={displaySquarePyramids}></CustomButton>
      <br></br>
      <CustomButton labelName="表示(正八面体)" onClick={displayRegularOctahedron}></CustomButton>
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

export default PrimitiveDisplay;
