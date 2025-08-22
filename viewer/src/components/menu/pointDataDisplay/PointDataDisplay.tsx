import {COPCViewer} from '../../../viewer/copcViewer';
import ColorMode from './colorMode/ColorMode';
import EyeControl from './eyeControl/EyeControl';
import LodMode from './lodMode/LodMode';
import PointDisplay from './pointDisplay/PointDisplay';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const PointDataDisplay = (props: Props) => {
  return (
    <>
      <fieldset>
        <details>
          <summary>【点群表示】</summary>
          <PointDisplay viewer={props.viewer}></PointDisplay>
        </details>
      </fieldset>
      <fieldset>
        <details>
          <summary>【視点制御】</summary>
          <EyeControl viewer={props.viewer}></EyeControl>
        </details>
      </fieldset>
      <fieldset>
        <details>
          <summary>【間引き表示】</summary>
          <LodMode viewer={props.viewer}></LodMode>
        </details>
      </fieldset>
      <fieldset>
        <details>
          <summary>【表示色変更】</summary>
          <ColorMode viewer={props.viewer}></ColorMode>
        </details>
      </fieldset>
    </>
  );
};

export default PointDataDisplay;
