import {useState} from 'react';

import {COPCViewer} from '../../../../viewer/copcViewer';
import CustomButton from '../../../common/CustomButton';
import {DownloadStatus} from '../../../../viewer/pointCloud/lasDownload';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const DownLoadLas = (props: Props) => {
  // ダウンロード点群表示ファイルパス
  const [filePathText, setFilePathText] = useState('');
  const changeFilepath = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFilePathText(event.target.value);
  };

  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState('-');
  const [filepath, setFilePath] = useState('-');
  const clickDownloadStart = () => {
    if (props.viewer) {
      function setResult(downloadStatus: DownloadStatus[]) {
        let showTarget: DownloadStatus | undefined = undefined;
        for (const status of downloadStatus) {
          if (status.result === 1) {
            showTarget = status;
          }
        }

        if (showTarget) {
          setFilePath(showTarget.filePath);
          setProgress(showTarget.progress.toString());
          setStatus(showTarget.result.toString());
        } else {
          setFilePath('-');
          setProgress('-');
          setStatus('');
        }
      }

      const filepaths = filePathText.split(/\r?\n/);
      const filepathList: string[] = [];
      for (const filepath of filepaths) {
        if (filepath !== '') {
          filepathList.push(filepath);
        }
      }
      if (0 < filepathList.length) {
        props.viewer.getMeasure().downloadLas(setResult, filepathList);
      } else {
        props.viewer.getMeasure().downloadLas(setResult);
      }
    }
  };

  return (
    <>
      <p>
        <b>[LASファイル]</b>
      </p>
      <textarea rows={4} cols={45} value={filePathText} onChange={changeFilepath} />

      <CustomButton labelName="ダウンロード" onClick={clickDownloadStart}></CustomButton>
      <div>&emsp;ファイル：{filepath} </div>
      <br></br>
      <div>&emsp;進捗状況：{progress} [％]</div>
      <br></br>
      <div>&emsp;取得状態：{status} </div>
    </>
  );
};

export default DownLoadLas;
