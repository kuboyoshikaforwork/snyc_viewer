import {useEffect, useState, useRef} from 'react';
import {FileInfo} from '../../../../viewer/pointCloud/pointSet';

import {COPCViewer} from '../../../../viewer/copcViewer';
import {COPCUtil} from '../../../../viewer/util/copcUtil';
import CustomButton from '../../../common/CustomButton';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const PointDisplay = (props: Props) => {
  // ロード点群ファイルパス
  const [loadFilePathText, setLoadFilePathText] = useState('');
  const changeLoadFilepath = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLoadFilePathText(event.target.value);

    // FOR DEBUG(ロード対象のパスを表示テキストエリアにも反映)
    setDisplayFilePathText(event.target.value);
  };

  // ロードボタン実行処理
  const clickLoad = () => {
    if (props.viewer) {
      const filepaths = loadFilePathText.split(/\r?\n/);
      const filepathList: string[] = [];
      for (const filepath of filepaths) {
        if (filepath !== '') {
          filepathList.push(filepath);
        }
      }
      props.viewer.load(filepathList, 'AccessToken').catch(e => {
        console.log(e);
      });
    }
  };
  const clickUnload = () => {
    if (props.viewer) {
      const filepaths = loadFilePathText.split(/\r?\n/);
      if (filepaths[0] !== '') {
        // ファイルパスの指定あり
      const filepathList: string[] = [];
      for (const filepath of filepaths) {
        if (filepath !== '') {
          filepathList.push(filepath);
        }
      }
      props.viewer.unload(filepathList);
      } else {
        // ファイルパスの指定なし
        props.viewer.unload();
      }
    }
  };

  // ロード状態
  const timerId = useRef<number>(0);
  const [loadInfo, setLoadInfo] = useState('-');
  const [loadFailedInfo, setLoadFailedInfo] = useState('');

  // 表示点群ファイルパス
  const [displayFilePathText, setDisplayFilePathText] = useState('');
  const changeDisplayFilepath = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDisplayFilePathText(event.target.value);
  };

  //  表示ボタン実行処理
  const clickDisplay = () => {
    if (props.viewer) {
      const filepaths = displayFilePathText.split(/\r?\n/);
      const filepathList: string[] = [];
      for (const filepath of filepaths) {
        if (filepath !== '') {
          filepathList.push(filepath);
        }
      }
      props.viewer.display(filepathList);
    }
  };
  const clickUndisplay = () => {
    if (props.viewer) {
      const filepaths = displayFilePathText.split(/\r?\n/);
      const filepathList: string[] = [];
      for (const filepath of filepaths) {
        if (filepath !== '') {
          filepathList.push(filepath);
        }
      }
      props.viewer.undisplay(filepathList);
    }
  };

  // 視点自動調整
  const clickAutoFocus = () => {
    if (props.viewer) {
      props.viewer.autoFocus([]);
    }
  };

  useEffect(() => {
    // 定周期でロード状態を取得
    timerId.current = window.setInterval(() => {
      if (props.viewer) {
        const infos: FileInfo[] = props.viewer.getPCInfo();
        if (0 < infos.length) {
          let loadedPointNum = 0;
          let totalPointNum = 0;
          let loadFailedPath = '';
          for (const info of infos) {
            if (info.loadRate < 0) {
              loadFailedPath += info.filePath + '\n';
            } else {
            loadedPointNum += (info.pointNum * info.loadRate) / 100;
            totalPointNum += info.pointNum;
          }
          }
          const rate = COPCUtil.roundPrecision((loadedPointNum / totalPointNum) * 100, 1);
          setLoadInfo(
            rate.toString() + ' % (' + COPCUtil.roundPrecision(loadedPointNum, 0) + ' / ' + totalPointNum + ')',
          );
          setLoadFailedInfo(loadFailedPath);
        } else {
          setLoadInfo('-');
        }
      }
    }, 2000);

    // 後処理
    return () => {
      clearTimeout(timerId.current);
    };
  }, [props.viewer]);

  return (
    <>
      <p>
        <b>[ロードする点群を指定]</b>
      </p>
      <textarea rows={7} cols={45} value={loadFilePathText} onChange={changeLoadFilepath} />
      <CustomButton labelName="ロード" onClick={clickLoad}></CustomButton>
      <CustomButton labelName="アンロード" onClick={clickUnload}></CustomButton>
      <div>【ロード率】{loadInfo}</div>
      <div>【ロード失敗】</div>
      <pre>{loadFailedInfo}</pre>

      <hr></hr>
      <p>
        <b>[表示する点群を指定]</b>
      </p>
      <textarea rows={7} cols={45} value={displayFilePathText} onChange={changeDisplayFilepath} />
      <CustomButton labelName="表示" onClick={clickDisplay}></CustomButton>
      <CustomButton labelName="非表示" onClick={clickUndisplay}></CustomButton>
      <br></br>
      <CustomButton labelName="自動調整" onClick={clickAutoFocus}></CustomButton>
    </>
  );
};

export default PointDisplay;
