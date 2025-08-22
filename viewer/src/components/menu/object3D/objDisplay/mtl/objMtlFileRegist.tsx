import {useState} from 'react';
import {COPCViewer} from '../../../../../viewer/copcViewer';
import CustomButton from '../../../../common/CustomButton';
import CustomTextBox from '../../../../common/CustomTextBox';

// Props定義
type Props = {
  viewer: COPCViewer | null;
  setModelId: React.Dispatch<React.SetStateAction<string>>;
};

const ObjMtlFileRegist = (props: Props) => {
  // 選択OBJファイル
  const [objFile, setObjFile] = useState<File | null>(null);
  const fileObjSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target && event.target.files) {
      const file: File = event.target.files[0];
      setObjFile(file);
    }
  };

  // 選択MTLファイル

  const [mtlUrl, setMtlUrl] = useState('');
  // const [mtlFile, setMtlFile] = useState<File | null>(null);
  // const fileMtlSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   if (event.target && event.target.files) {
  //     const file: File = event.target.files[0];
  //     setMtlFile(file);
  //   }
  // };

  // モデル登録
  const clickRegistObj = () => {
    if (props.viewer && objFile && mtlUrl) {
      props.viewer
        .getScene()
        .loadTextureOBJModel(objFile, mtlUrl)
        .then((modelId: number) => {
          props.setModelId(modelId.toString());
        })
        .catch(() => {
          console.log('load obj mtl error');
        });
    }
  };

  return (
    <>
      <p>
        <b>[選択ファイル登録]</b>
      </p>
      <br></br>
      ＜OBJファイル＞
      <input type="file" accept=".obj" onChange={fileObjSelect} />
      <br></br>
      ＜MTLファイル＞
      <br></br>
      <CustomTextBox labelName="" width={200} value={mtlUrl} onChange={setMtlUrl}></CustomTextBox>
      <br></br>
      <CustomButton labelName="登録" onClick={clickRegistObj}></CustomButton>
    </>
  );
};

export default ObjMtlFileRegist;
