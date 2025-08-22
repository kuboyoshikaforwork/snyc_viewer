import {COPCViewer} from '../../../../viewer/copcViewer';
import CustomButton from '../../../common/CustomButton';

type Props = {
  viewer: COPCViewer | null;
};

const Conf = (props: Props) => {
  const clickSettingConf = () => {
    const server = location.href;
    fetch(server + '/client.conf')
      .then(response => response.json())
      .then(data => {
        if (props.viewer) {
          // ## 設定反映未対応 ##
          props.viewer.setConfig(data);
        }
      })
      .catch(error => {
        console.log(error);
      });
  };

  return (
    <>
      <p>
        <b>[設定ファイル]</b>
      </p>
      <CustomButton labelName="更新" onClick={clickSettingConf}></CustomButton>
    </>
  );
};

export default Conf;
