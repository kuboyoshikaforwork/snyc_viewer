import {ChangeEventHandler, Fragment} from 'react';

// ラジオボタン情報
export type RadioSelectionInfo = {
  name: string;
  value: number;
};

// Props定義
type Props = {
  groupName: string;
  initialValue: number;
  selection: number;
  selectionInfo: RadioSelectionInfo[];
  onChange: ChangeEventHandler<HTMLInputElement>;
};

// スタイル定義
const radioButtonStyle = {
  display: 'block',
};

const CustomRadioButton = (props: Props) => {
  return (
    <>
      {props.selectionInfo.map(selection => (
        <Fragment key={selection.value}>
          <label style={radioButtonStyle}>
            <input
              type="radio"
              name={props.groupName}
              value={selection.value}
              checked={props.selection === selection.value}
              onChange={props.onChange}
            />
            {selection.name}
          </label>
        </Fragment>
      ))}
    </>
  );
};
export default CustomRadioButton;
