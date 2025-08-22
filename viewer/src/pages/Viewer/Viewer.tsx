import {useEffect, useRef, useState} from 'react';

import Menu from '../../components/menu/Menu';
import styles from './Viewer.module.scss';
import {COPCViewer} from '../../viewer/copcViewer';
import {SERVER_URL} from '../../shared/constant';

const Viewer = () => {
  // 点群表示HTML要素
  const container = useRef<HTMLDivElement>(null);

  // 点群表示ビューア
  const [viewer, setCOPCViewer] = useState<COPCViewer | null>(null);

  useEffect(() => {
    let copcViewer: COPCViewer | null = null;
    const init = async () => {
      if (container.current && null === viewer) {
        // 点群表示ビューアオブジェクト生成
        copcViewer = new COPCViewer(container.current, SERVER_URL, false);
        setCOPCViewer(copcViewer);
      }
    };

    // 初期化処理
    init().catch(e => {
      console.log(e);
    });

    // 後処理
    return () => {
      if (copcViewer) {
        copcViewer.clear();
        copcViewer = null;
      }
    };
  }, []);

  return (
    <>
      <div ref={container} className={styles.container}></div>
      <div className={styles.sideMenu}>
        <Menu viewer={viewer}></Menu>
      </div>
      <div id="info"></div>
    </>
  );
};

export default Viewer;
