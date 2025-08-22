import {COPCViewer} from '../../../viewer/copcViewer';
import GeoJsonDisplay from './geojsonDisplay/geojsonDisplay';
import ObjDisplay from './objDisplay/objDisplay';
import ObjectOperate from './objectOperate/objectOperate';
import PrimitiveDisplay from './primitiveDisplay/primitiveDisplay';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const Object3D = (props: Props) => {
  return (
    <>
      <fieldset>
        <details>
          <summary>【OBJ表示】</summary>
          <ObjDisplay viewer={props.viewer}></ObjDisplay>
        </details>
      </fieldset>
      <fieldset>
        <details>
          <summary>【GeoJSON表示】</summary>
          <GeoJsonDisplay viewer={props.viewer}></GeoJsonDisplay>
        </details>
      </fieldset>
      <fieldset>
        <details>
          <summary>【プリミティブオブジェクト表示】</summary>
          <PrimitiveDisplay viewer={props.viewer}></PrimitiveDisplay>
        </details>
      </fieldset>
      <fieldset>
        <details>
          <summary>【オブジェクト操作】</summary>
          <ObjectOperate viewer={props.viewer}></ObjectOperate>
        </details>
      </fieldset>
    </>
  );
};

export default Object3D;
