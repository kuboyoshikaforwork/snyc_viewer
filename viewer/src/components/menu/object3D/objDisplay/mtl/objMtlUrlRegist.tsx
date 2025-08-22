import {useState} from 'react';

import {COPCViewer} from '../../../../../viewer/copcViewer';
import CustomButton from '../../../../common/CustomButton';
import CustomTextBox from '../../../../common/CustomTextBox';

// Props定義
type Props = {
  viewer: COPCViewer | null;
  setModelId: React.Dispatch<React.SetStateAction<string>>;
};

const ObjMtlUrlRegist = (props: Props) => {
  // URLファイル登録
  const [objUrl, setObjUrl] = useState('');
  const [mtlUrl, setMtlUrl] = useState('');
  const clickLoadObj = () => {
    if (props.viewer && objUrl && mtlUrl) {
      props.viewer
        .getScene()
        .loadTextureOBJModel(objUrl, mtlUrl)
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
      <CustomTextBox labelName="OBJファイル" width={200} value={objUrl} onChange={setObjUrl}></CustomTextBox>
      <br></br>
      <CustomTextBox labelName="MTLファイル" width={200} value={mtlUrl} onChange={setMtlUrl}></CustomTextBox>
      <br></br>
      <CustomButton labelName="登録" onClick={clickLoadObj}></CustomButton>
    </>
  );
};

export default ObjMtlUrlRegist;
