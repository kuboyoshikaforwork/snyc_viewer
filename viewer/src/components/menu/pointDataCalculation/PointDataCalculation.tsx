import {COPCViewer} from '../../../viewer/copcViewer';
import DownLoadLas from './downloadLas/DownloadLas';
import PointCoord from './PointCoord/PointCoord';
import PointSelection from './pointSelection/PointSelection';
import RangeSelection from './rangeSelection/RangeSelection';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const PointDataCalculation = (props: Props) => {
  return (
    <>
      <fieldset>
        <details>
          <summary>【点選択】</summary>
          <PointSelection viewer={props.viewer}></PointSelection>
        </details>
      </fieldset>
      <fieldset>
        <details>
          <summary>【範囲選択】</summary>
          <RangeSelection viewer={props.viewer}></RangeSelection>
        </details>
      </fieldset>
      <fieldset>
        <details>
          <summary>【点座標取得】</summary>
          <PointCoord viewer={props.viewer}></PointCoord>
        </details>
      </fieldset>
      <fieldset>
        <details>
          <summary>【ダウンロード】</summary>
          <DownLoadLas viewer={props.viewer}></DownLoadLas>
        </details>
      </fieldset>
    </>
  );
};

export default PointDataCalculation;
