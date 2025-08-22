import {useEffect, useState} from 'react';

import {COPCViewer} from '../../../../viewer/copcViewer';
import CustomButton from '../../../common/CustomButton';
import CustomTextBox from '../../../common/CustomTextBox';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const ObjectOperate = (props: Props) => {
  // 操作対象オブジェクトID
  const [targetObjId, settargetObjId] = useState<string>('');
  // 操作対象グループID
  const [targetGroupId, settargetGroupId] = useState<string>('');
  // 選択オブジェクトID
  const [selectObjId, setSelectObjId] = useState<string>('-');
  // 表示制御閾値
  const [visibleThreshold, setVisibleThreshold] = useState<string>('');

  // オブジェクト表示
  const clickVisibleObject = () => {
    if (props.viewer && targetObjId) {
      props.viewer.getScene().setObjectVisible(Number(targetObjId));
    }
  };

  // オブジェクト非表示
  const clickInvisibleObject = () => {
    if (props.viewer && targetObjId) {
      props.viewer.getScene().setObjectInvisible(Number(targetObjId));
    }
  };

  // オブジェクト削除
  const clickDeleteObject = () => {
    if (props.viewer && targetObjId) {
      props.viewer.getScene().removeObject(Number(targetObjId));
    }
  };

  // グループオブジェクト表示
  const clickVisibleGroupObject = () => {
    if (props.viewer && targetObjId) {
      props.viewer.getScene().setGroupObjectVisible(targetGroupId);
    }
  };

  // オブジェクト非表示
  const clickInvisibleGroupObject = () => {
    if (props.viewer && targetObjId) {
      props.viewer.getScene().setGroupObjectInvisible(targetGroupId);
    }
  };

  // オブジェクト削除
  const clickDeleteGroupObject = () => {
    if (props.viewer && targetObjId) {
      props.viewer.getScene().removeGroupObject(targetGroupId);
    }
  };

  // 表示制御閾値反映
  const clickSetThreshold = () => {
    if (props.viewer && visibleThreshold) {
      props.viewer.getScene().setVisibleLimitThreshold(Number(visibleThreshold));
    }
  };

  useEffect(() => {
    if (props.viewer) {
      // 選択オブジェクトID設定処理
      const objClickedCallback = (id: number) => {
        setSelectObjId(id.toString());
      };
      props.viewer.setObjClickedCallback(objClickedCallback);
    }
  }, [props.viewer]);

  return (
    <>
      <p>
        <b>[オブジェクト取得]</b>
      </p>
      <label>選択オブジェクトID：{selectObjId}</label>
      <br></br>
      <hr></hr>
      <p>
        <b>[個別IDオブジェクト操作]</b>
      </p>
      <CustomTextBox
        labelName="オブジェクトID "
        width={100}
        value={targetObjId}
        onChange={settargetObjId}></CustomTextBox>
      <br></br>
      <br></br>
      <CustomButton labelName="オブジェクト表示　" onClick={clickVisibleObject}></CustomButton>
      <br></br>
      <CustomButton labelName="オブジェクト非表示" onClick={clickInvisibleObject}></CustomButton>
      <br></br>
      <CustomButton labelName="オブジェクト破棄　" onClick={clickDeleteObject}></CustomButton>
      <br></br>
      <hr></hr>
      <p>
        <b>[グループIDオブジェクト操作]</b>
      </p>
      <CustomTextBox
        labelName="グループID "
        width={100}
        value={targetGroupId}
        onChange={settargetGroupId}></CustomTextBox>
      <br></br>
      <br></br>
      <CustomButton labelName="オブジェクト表示　" onClick={clickVisibleGroupObject}></CustomButton>
      <br></br>
      <CustomButton labelName="オブジェクト非表示" onClick={clickInvisibleGroupObject}></CustomButton>
      <br></br>
      <CustomButton labelName="オブジェクト破棄　" onClick={clickDeleteGroupObject}></CustomButton>
      <br></br>
      <hr></hr>
      <CustomTextBox
        labelName="表示制御閾値 "
        width={100}
        value={visibleThreshold}
        onChange={setVisibleThreshold}></CustomTextBox>
      <CustomButton labelName="反映" onClick={clickSetThreshold}></CustomButton>
      <br></br>
    </>
  );
};

export default ObjectOperate;
