import {useState} from 'react';
import {COPCViewer} from '../../../../../viewer/copcViewer';
import ObjFileRegist from './objFileRegist';
import ObjUrlRegist from './objUrlRegist';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const ObjRegist = (props: Props) => {
  const [modelId, setModelId] = useState('');
  return (
    <>
      <ObjFileRegist viewer={props.viewer} setModelId={setModelId}></ObjFileRegist>
      <hr></hr>
      <ObjUrlRegist viewer={props.viewer} setModelId={setModelId}></ObjUrlRegist>
      <hr></hr>
      <label>&emsp;登録ID：{modelId}</label>
    </>
  );
};

export default ObjRegist;
