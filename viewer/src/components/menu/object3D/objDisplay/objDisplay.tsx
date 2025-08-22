import {COPCViewer} from '../../../../viewer/copcViewer';
import ObjMtlRegist from './mtl/objmtlRegist';
import ObjRegist from './obj/objRegist';
import ObjAdd from './objAdd';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const ObjDisplay = (props: Props) => {
  return (
    <>
      <fieldset>
        <details>
          <summary>【モデル登録（OBJ）】</summary>
          <ObjRegist viewer={props.viewer}></ObjRegist>
        </details>
      </fieldset>
      <fieldset>
        <details>
          <summary>【モデル登録（OBJ & MTL）】</summary>
          <ObjMtlRegist viewer={props.viewer}></ObjMtlRegist>
        </details>
      </fieldset>
      <fieldset>
        <details>
          <summary>【オブジェクト表示】</summary>
          <ObjAdd viewer={props.viewer}></ObjAdd>
        </details>
      </fieldset>
    </>
  );
};

export default ObjDisplay;
