import {useState} from 'react';

import * as THREE from 'three';

import {COPCViewer} from '../../../../../viewer/copcViewer';
import CustomButton from '../../../../common/CustomButton';
import CustomTextBox from '../../../../common/CustomTextBox';

// Props定義
type Props = {
  viewer: COPCViewer | null;
  setModelId: React.Dispatch<React.SetStateAction<string>>;
};

const ObjUrlRegist = (props: Props) => {
  // 表示色
  const [color, setColor] = useState('');

  // URLファイル登録
  const [url, setUrl] = useState('');
  const clickLoadObj = () => {
    if (props.viewer && color) {
      const objColor = new THREE.Color(Number(color));
      props.viewer
        .getScene()
        .loadOBJModel(url, objColor, 1.0)
        .then((modelId: number) => {
          props.setModelId(modelId.toString());
        })
        .catch(() => {
          console.log('Load Obj File Error');
        });
    }
  };

  return (
    <>
      <p>
        <b>[URLファイル登録]</b>
      </p>
      <CustomTextBox labelName="表示色" width={100} value={color} onChange={setColor}></CustomTextBox>
      <br></br>
      <CustomTextBox labelName="URL 　" width={200} value={url} onChange={setUrl}></CustomTextBox>
      <br></br>
      <CustomButton labelName="登録" onClick={clickLoadObj}></CustomButton>
    </>
  );
};

export default ObjUrlRegist;
