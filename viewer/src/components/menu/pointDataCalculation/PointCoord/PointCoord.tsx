import * as THREE from 'three';

import {useState} from 'react';
import {COPCViewer} from '../../../../viewer/copcViewer';
import {COPCUtil} from '../../../../viewer/util/copcUtil';
import CustomButton from '../../../common/CustomButton';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

// スタイル定義
const textBoxStyle = {
  width: '300px',
  height: '200px',
  border: '1px solid #000',
  overflow: 'scroll',
  backgroundColor: 'white',
  margin: '10px',
  whiteSpace: 'pre-line',
};

const PointCoord = (props: Props) => {
  const [coordsNum, setCoordsNum] = useState('0');
  const [procTime, setProcTime] = useState('0');
  const [result, setResult] = useState('');

  // 点座標情報
  const [coordsInfo, setCoordsInfo] = useState('');
  const clickRangeSelectionStart = () => {
    if (props.viewer) {
      const start = performance.now();
      const coords: THREE.Vector3[] = [];
      const countOver = props.viewer.getMeasure().getSelectedPointCoords(coords);
      const end = performance.now();

      // 処理時間
      const time = COPCUtil.roundPrecision(end - start, 2);
      setProcTime(time.toString());

      // 取得座標表示
      let text = '';
      for (const coord of coords) {
        text += '(' + coord.x.toString() + ', ' + coord.y.toString() + ', ' + coord.z.toString() + ')\n';
      }
      setCoordsInfo(text);

      // 取得点数
      setCoordsNum(coords.length.toString());

      // 処理結果
      if (countOver) {
        setResult('最大点数超過');
      } else {
        setResult('正常');
      }
    }
  };

  return (
    <>
      <br></br>
      <CustomButton labelName="座標取得" onClick={clickRangeSelectionStart}></CustomButton>
      <div>&emsp;処理時間：{procTime} [ms]</div>
      <br></br>
      <div>&emsp;取得点数：{coordsNum} [点]</div>
      <br></br>
      <div>&emsp;取得結果：{result} </div>

      <div style={textBoxStyle}>{coordsInfo}</div>
    </>
  );
};

export default PointCoord;
