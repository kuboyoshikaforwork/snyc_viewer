import {useEffect, useState} from 'react';

import styles from './MultiViewer.module.scss';
import {MultiViewerControl} from '../../viewer/multiViewerControl';
import {COPCViewer} from '../../viewer/copcViewer';
import {SERVER_URL} from '../../shared/constant';
import CustomButton from '../../components/common/CustomButton';

const menuStyle = {
  fontSize: '12px',
  fontFamily: 'Monospace',
  overflow: 'hidden',
};

const MultiViewer = () => {
  // コンテナ
  let container1: HTMLElement;
  let container2: HTMLElement;

  // 点群ビューア
  const [viewer1, setViewer1] = useState<COPCViewer | null>(null);
  const [viewer2, setViewer2] = useState<COPCViewer | null>(null);

  // 2画面表示制御コントローラー
  const [syncController, setSyncController] = useState<MultiViewerControl | null>(null);

  // 点群表示ファイルパス
  const [filePathText, setFilePathText] = useState('');
  const changeFilepath = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFilePathText(event.target.value);
  };

  // 表示ボタン実行処理
  const clickDisplay = () => {
    if (viewer1 && viewer2) {
      const filepaths = filePathText.split(/\r?\n/);
      const filepathList: string[] = [];
      for (const filepath of filepaths) {
        if (filepath !== '') {
          filepathList.push(filepath);
        }
      }
      viewer1
        .load(filepathList, 'AccessToken')
        .then(() => {
          viewer1.display(filepathList);
          viewer1.autoFocus(filepathList);
        })
        .catch(e => {
          console.log(e);
        });
      viewer2
        .load(filepathList, 'AccessToken')
        .then(() => {
          viewer2.display(filepathList);
          viewer2.autoFocus(filepathList);
        })
        .catch(e => {
          console.log(e);
        });
    }
  };

  //
  let modeSync = true;
  const clickChangeMode = () => {
    if (syncController) {
      modeSync = !modeSync;
      if (modeSync) {
        syncController.syncOn();
      } else {
        syncController.syncOff();
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      if (container1) {
        return;
      }

      // コンテナ取得取得
      container1 = document.getElementById('container1')!;
      container2 = document.getElementById('container2')!;

      // ビューア生成
      const copcViewer1 = new COPCViewer(container1, SERVER_URL, false);
      const copcViewer2 = new COPCViewer(container2, SERVER_URL, false);
      setViewer1(copcViewer1);
      setViewer2(copcViewer2);

      // 2画面表示制御設定
      const multiViewerControl = new MultiViewerControl(copcViewer1, copcViewer2);
      multiViewerControl.setMainViewer(1);
      setSyncController(multiViewerControl);
    };

    // 初期化処理
    init().catch(e => {
      console.log(e);
    });

    // 後処理
    return () => {
      if (viewer1) {
        viewer1.clear();
      }
      if (viewer2) {
        viewer2.clear();
      }
    };
  }, []);

  return (
    <>
      <div style={menuStyle}>
        <p>
          <b>[表示する点群を指定]</b>
        </p>
      </div>
      <textarea rows={6} cols={45} value={filePathText} onChange={changeFilepath} />
      <br></br>
      <CustomButton labelName="表示" onClick={clickDisplay}></CustomButton>
      <CustomButton labelName="連動・独立切替" onClick={clickChangeMode}></CustomButton>
      <br></br>
      <div id="container1" className={styles.container1}></div>
      <div id="container2" className={styles.container2}></div>
      <div id="info"></div>
    </>
  );
};

export default MultiViewer;
