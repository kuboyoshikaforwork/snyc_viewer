import {COPCViewer} from '../../../viewer/copcViewer';
import Conf from './conf/conf';

type Props = {
  viewer: COPCViewer | null;
};

const Setting = (props: Props) => {
  return (
    <>
      <fieldset>
        <details>
          <summary>【設定関連】</summary>
          <Conf viewer={props.viewer}></Conf>
        </details>
      </fieldset>
    </>
  );
};

export default Setting;
