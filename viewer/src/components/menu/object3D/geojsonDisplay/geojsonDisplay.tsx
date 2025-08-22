import {useState} from 'react';

import {COPCViewer} from '../../../../viewer/copcViewer';
import CustomButton from '../../../common/CustomButton';
import CustomTextBox from '../../../common/CustomTextBox';

// Props定義
type Props = {
  viewer: COPCViewer | null;
};

const GeoJsonDisplay = (props: Props) => {
  // オブジェクトID
  const [objId, setObjId] = useState<string>('');
  // グループID
  const [groupId, setGroupId] = useState<string>('');

  const getIdsText = (ids: number[]) => {
    let text = '';
    for (const id of ids) {
      text += id.toString() + ' ';
    }
    return text;
  };

  // ファイル選択表示
  const [geoJsonjFile, setGeoJsonFile] = useState<File | null>(null);
  const fileGeoJsonSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target && event.target.files) {
      const file: File = event.target.files[0];
      setGeoJsonFile(file);
    }
  };
  const clickdisplayFileGooJSON = () => {
    if (props.viewer && geoJsonjFile) {
      props.viewer
        .getScene()
        .addGeoJSONObject(geoJsonjFile, groupId, true)
        .then(ids => {
          setObjId(getIdsText(ids));
        })
        .catch(error => {
          console.log(error);
        });
    }
  };

  // URLファイル表示
  const [geoJsonUrl, setGeoJsonUrl] = useState('');
  const clickdisplayUrlGooJSON = () => {
    if (props.viewer) {
      props.viewer
        .getScene()
        .addGeoJSONObject(geoJsonUrl, groupId, true)
        .then(ids => {
          setObjId(getIdsText(ids));
        })
        .catch(error => {
          console.log(error);
        });
    }
  };

  // オブジェクト操作
  const visibleAll = () => {
    if (props.viewer) {
      props.viewer.getScene().setAllGeoJSONVisible();
    }
  };
  const invisibleAll = () => {
    if (props.viewer) {
      props.viewer.getScene().setAllGeoJSONInvisible();
    }
  };
  const removeAll = () => {
    if (props.viewer) {
      props.viewer.getScene().removeAllGeoJSON();
    }
  };

  return (
    <>
      <p>
        <b>[GeoJSONファイル選択]</b>
      </p>
      <CustomTextBox labelName="グループID" width={100} value={groupId} onChange={setGroupId}></CustomTextBox> <br></br>
      <hr></hr>
      <input type="file" accept=".geojson" onChange={fileGeoJsonSelect} />
      <CustomButton labelName="GeoJson表示" onClick={clickdisplayFileGooJSON}></CustomButton>
      <hr></hr>
      <CustomTextBox labelName="URL 　" width={200} value={geoJsonUrl} onChange={setGeoJsonUrl}></CustomTextBox>
      <br></br>
      <CustomButton labelName="GeoJson表示" onClick={clickdisplayUrlGooJSON}></CustomButton>
      <br></br>
      <hr></hr>
      <label>&emsp;オブジェクトID：{objId}</label>
      <hr></hr>
      <p>
        <b>[オブジェクト操作]</b>
      </p>
      <CustomButton labelName="全表示　" onClick={visibleAll}></CustomButton>
      <CustomButton labelName="全非表示" onClick={invisibleAll}></CustomButton>
      <CustomButton labelName="全削除　" onClick={removeAll}></CustomButton>
    </>
  );
};

export default GeoJsonDisplay;
