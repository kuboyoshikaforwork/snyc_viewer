import {useState} from 'react';

import * as THREE from 'three';

import {COPCViewer} from '../../../../../viewer/copcViewer';
import CustomTextBox from '../../../../common/CustomTextBox';

// Props定義
type Props = {
  viewer: COPCViewer | null;
  setModelId: React.Dispatch<React.SetStateAction<string>>;
};

const ObjFileRegist = (props: Props) => {
  // 表示色
  const [color, setColor] = useState('');

  // 選択ファイル登録
  const fileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target && event.target.files) {
      const file: File = event.target.files[0];
      if (props.viewer && color) {
        const objColor = new THREE.Color(Number(color));
        props.viewer
          .getScene()
          .loadOBJModel(file, objColor, 1.0)
          .then((modelId: number) => {
            props.setModelId(modelId.toString());
          })
          .catch(() => {
            console.log('load obj error');
          });
      }
    }
  };

  return (
    <>
      <p>
        <b>[選択ファイル登録]</b>
      </p>
      <CustomTextBox labelName="表示色" width={100} value={color} onChange={setColor}></CustomTextBox>
      <br></br>
      <br></br>
      <input type="file" accept=".obj" onChange={fileSelect} />
    </>
  );
};

export default ObjFileRegist;
