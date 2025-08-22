import {useState} from 'react';

import {COPCViewer} from '../../../../../viewer/copcViewer';
import ObjMtlFileRegist from './objMtlFileRegist';
import ObjMtlUrlRegist from './objMtlUrlRegist';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const ObjMtlRegist = (props: Props) => {
  const [modelId, setModelId] = useState('');
  return (
    <>
      <ObjMtlFileRegist viewer={props.viewer} setModelId={setModelId}></ObjMtlFileRegist>
      <hr></hr>
      <ObjMtlUrlRegist viewer={props.viewer} setModelId={setModelId}></ObjMtlUrlRegist>
      <hr></hr>
      <label>&emsp;登録ID：{modelId}</label>
    </>
  );
};

export default ObjMtlRegist;
