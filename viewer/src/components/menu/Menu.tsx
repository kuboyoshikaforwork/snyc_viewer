import {COPCViewer} from '../../viewer/copcViewer';
import PointDataCalculation from './pointDataCalculation/PointDataCalculation';
import PointDataDisplay from './pointDataDisplay/PointDataDisplay';

import Setting from './setting/setting';
import Object3D from './object3D/object3D';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const menuStyle = {
  fontSize: '12px',
  fontFamily: 'Monospace',
  overflow: 'hidden',
};

const Menu = (props: Props) => {
  return (
    <div style={menuStyle}>
      <PointDataDisplay viewer={props.viewer}></PointDataDisplay>
      <PointDataCalculation viewer={props.viewer}></PointDataCalculation>
      <Object3D viewer={props.viewer}></Object3D>
      <Setting viewer={props.viewer}></Setting>
    </div>
  );
};

export default Menu;
